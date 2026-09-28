/* =============================================================================
 * CYBERSURE API client
 * -----------------------------------------------------------------------------
 * The configuration converter runs on the FastAPI backend. This module is the
 * only place in the frontend that talks to it.
 *
 * Design rules:
 *   - No engine logic lives here. This file moves data, nothing else.
 *   - Every failure becomes an `ApiError` with a machine-readable `kind`, so the
 *     UI can show a specific, human message instead of a stack trace.
 *   - No secret ever appears in this file or in any `VITE_*` variable, which are
 *     inlined into the public bundle at build time.
 * ========================================================================== */

import type { PlatformId } from '@/types';

/* -------------------------------------------------------------------------- */
/* Configuration                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Reads Vite's build-time environment.
 *
 * `import.meta.env` is replaced by the bundler in a browser build and is absent
 * when the module is loaded outside Vite (the verification harnesses), so the
 * lookup is defensive and falls back to the documented defaults.
 */
function readEnv(): Record<string, string | undefined> {
  try {
    return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
      string,
      string | undefined
    >;
  } catch {
    return {};
  }
}

const env = readEnv();

/**
 * Path prefix every endpoint is called under.
 *
 * Declared before `API_BASE_URL` on purpose: `normaliseBaseUrl` reads it
 * while `API_BASE_URL` is still being initialised, and a `const` accessed
 * during its own module's initialisation throws a temporal-dead-zone
 * ReferenceError in native ESM (the browser), which takes the whole module
 * graph - and therefore the entire app - down with it.
 */
const API_PREFIX = '/api/v1';

/**
 * Base URL of the FastAPI backend, from `VITE_API_BASE_URL`.
 *
 * The `/api/v1` prefix is appended per request, so a value that already ends
 * with it is trimmed - otherwise the path becomes `/api/v1/api/v1/...`.
 */
export const API_BASE_URL: string = normaliseBaseUrl(
  // Empty string → relative URLs (/api/v1/...).
  // • Production: fetch resolves against window.location.origin (same host).
  // • Local dev: Vite's server.proxy forwards /api → http://localhost:8000.
  // VITE_API_BASE_URL in .env can still override this for any other setup.
  env.VITE_API_BASE_URL ?? '',
);

/** Request timeout in milliseconds, from `VITE_API_TIMEOUT_MS`. */
export const API_TIMEOUT_MS: number = Number(env.VITE_API_TIMEOUT_MS ?? 30000) || 30000;

function normaliseBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.toLowerCase().endsWith(API_PREFIX)) {
    return trimmed.slice(0, -API_PREFIX.length);
  }
  return trimmed;
}

/** The origin the app is being served from, used in diagnostics. */
export const PAGE_ORIGIN: string =
  typeof window !== 'undefined' && window.location ? window.location.origin : '(unknown)';

/* -------------------------------------------------------------------------- */
/* Errors                                                                    */
/* -------------------------------------------------------------------------- */

export type ApiErrorKind =
  /**
   * The browser could not complete the request. This is deliberately broad
   * because the browser will not tell us why: the server may be down, the URL
   * may be wrong, or the response may have been blocked by CORS. Callers use
   * `diagnose` to narrow it down.
   */
  | 'unavailable'
  /** The backend answered, but rejected the request as malformed (4xx). */
  | 'rejected'
  /** The backend answered 5xx. */
  | 'server-error'
  /** The request exceeded the client timeout. */
  | 'timeout'
  /** The request was aborted by the caller. */
  | 'aborted'
  /** The response body was not the JSON we expected. */
  | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Operator-facing next step, when one is known. */
  readonly hint?: string;
  /**
   * Extra context gathered *after* a failure, so a generic transport error can
   * be reported precisely rather than guessed at. See `diagnoseUnreachable`.
   */
  readonly diagnosis?: ReachabilityDiagnosis;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status?: number,
    hint?: string,
    diagnosis?: ReachabilityDiagnosis,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.hint = hint;
    this.diagnosis = diagnosis;
  }

  /** True when retrying later could plausibly succeed. */
  get retryable(): boolean {
    return (
      this.kind === 'unavailable' ||
      this.kind === 'timeout' ||
      this.kind === 'server-error' ||
      (this.status ?? 0) >= 500
    );
  }
}

// `--reload-dir app` keeps the reloader off backend.log, which would otherwise
// restart the server on every request and eventually kill it.
const START_COMMAND =
  'uvicorn app.main:app --reload --port 8000 --reload-dir app';

/** What a failed transport turned out to actually be. */
export interface ReachabilityDiagnosis {
  /** Whether the API base URL is reachable at all. */
  reachable: boolean;
  /** Whether `/api/v1/health` answered. */
  healthOk: boolean;
  /** The raw outcome, for the details panel. */
  reason: 'unreachable' | 'blocked' | 'ok';
  /** Status returned by the health probe, when there was one. */
  healthStatus?: number;
  /** Actionable next step for this specific cause. */
  advice: string;
}

function startCommandHint(): string {
  return `Start the backend: cd backend && ${START_COMMAND}`;
}

/**
 * Narrow down a transport failure.
 *
 * The browser reports a refused connection and a CORS-blocked response
 * identically, so a plain re-probe cannot separate them: when the origin is
 * refused the probe is blocked too, and a healthy backend looks dead.
 *
 * A `mode: 'no-cors'` request resolves for *any* server response, even one
 * carrying no CORS headers, and still rejects when nothing is listening.
 * Resolution versus rejection is therefore the exact discriminator between
 * "the backend is down" and "the backend is up but refusing this origin".
 */
async function diagnoseUnreachable(): Promise<ReachabilityDiagnosis> {
  const healthUrl = `${API_BASE_URL}${API_PREFIX}/health`;

  // 1. Is anything listening at all? This probe is exempt from CORS.
  try {
    await fetch(`${healthUrl}?probe=${Date.now()}`, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
  } catch {
    return {
      reachable: false,
      healthOk: false,
      reason: 'unreachable',
      advice:
        `Nothing is listening at ${healthUrl}. The service is not running, or it is bound to a ` +
        `different address or port. ${startCommandHint()}. Also confirm VITE_API_BASE_URL ` +
        `(${API_BASE_URL}) matches where it is actually bound.`,
    };
  }

  // 2. Something answered. Can this origin read it, or is it being blocked?
  try {
    const response = await fetch(`${healthUrl}?probe=${Date.now()}`, { method: 'GET', cache: 'no-store' });
    if (response.ok) {
      return {
        reachable: true,
        healthOk: true,
        reason: 'ok',
        healthStatus: response.status,
        advice:
          'The backend is healthy but the request still failed. Check for a proxy or service ' +
          'worker intercepting API calls, and confirm the arriving request in the backend log.',
      };
    }
    return {
      reachable: true,
      healthOk: false,
      reason: 'unreachable',
      healthStatus: response.status,
      advice:
        `The backend answered ${healthUrl} with HTTP ${response.status}. It is running but not ` +
        'healthy - check the backend log for startup errors.',
    };
  } catch {
    return {
      reachable: true,
      healthOk: false,
      reason: 'blocked',
      advice:
        `The backend is running on ${API_BASE_URL} and answered the probe, but the browser blocked ` +
        `the response: it carried no access-control-allow-origin header for ${PAGE_ORIGIN}. This is ` +
        'a CORS configuration problem, not an outage. Either serve the frontend from an allowed ' +
        'origin, or add this origin to CYBERSURE_CORS_ORIGINS. Any port on localhost / 127.0.0.1 / ' +
        '[::1] is allowed by default, so a non-loopback origin here usually means the app is being ' +
        'served from somewhere other than the dev server.',
    };
  }
}

/** Wraps a transport failure, attaching a diagnosis of what actually went wrong. */
async function unreachableError(what: string): Promise<ApiError> {
  const diagnosis = await diagnoseUnreachable();
  return new ApiError(
    'unavailable',
    diagnosis.reachable
      ? `${what} The request was blocked by the browser before it reached React.`
      : `${what} ${diagnosis.advice.split('. ')[0]}.`,
    undefined,
    diagnosis.advice,
    diagnosis,
  );
}

const STATUS_ADVICE: Record<number, string> = {
  400: 'The request was rejected as malformed. Check the source configuration and try again.',
  404: 'The endpoint was not found. The API base URL may point at the wrong server or version.',
  405: 'That method is not allowed on this endpoint.',
  413: 'The file is larger than the backend accepts. Use a smaller configuration.',
  415: 'That file type is not accepted. Use .cfg, .conf, .txt or .rsc.',
  422: 'The request could not be processed. Check the source configuration and the platform selection.',
  500: 'The conversion service hit an internal error. Check the backend log for the traceback.',
  503: 'The conversion service is starting up or overloaded. Retry in a moment.',
};

function httpAdvice(status: number): string {
  const specific = STATUS_ADVICE[status];
  if (specific) return specific;
  if (status >= 500) return 'The conversion service returned a server error. Retry, then check the backend log.';
  return `The conversion service returned HTTP ${status}.`;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                 */
/* -------------------------------------------------------------------------- */

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Caller-supplied cancellation, e.g. an unmounted component. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = API_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onExternalAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new ApiError('aborted', 'The request was cancelled.');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new ApiError('aborted', 'The request was cancelled.');
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    if (isTimeout) {
      throw new ApiError(
        'timeout',
        `The conversion service did not respond within ${Math.round(timeoutMs / 1000)}s.`,
        undefined,
        'The request was abandoned, not failed. Retry, or check the backend log for a long-running conversion.',
      );
    }
    // The browser throws the same opaque TypeError for a refused connection and
    // for a CORS-blocked response, so probe to find out which it was.
    throw await unreachableError('The conversion request could not be completed.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const raw = await response.text();
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      if (response.ok) {
        throw new ApiError(
          'parse',
          'The conversion service returned a response that is not JSON.',
          response.status,
          `Check that the API base URL (${API_BASE_URL}) points at the CYBERSURE API and not another server.`,
        );
      }
    }
  }

  if (!response.ok) {
    const detail = extractDetail(payload) ?? `Request failed with status ${response.status}.`;
    throw new ApiError(
      response.status >= 500 ? 'server-error' : 'rejected',
      detail,
      response.status,
      httpAdvice(response.status),
    );
  }

  return payload as T;
}

/** Pulls FastAPI's `detail` out of an error body, whatever shape it arrived in. */
function extractDetail(payload: unknown): string | undefined {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.detail === 'string') return record.detail;
  if (Array.isArray(record.detail)) {
    // FastAPI validation errors: [{loc, msg, type}, ...]
    const messages = record.detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const entry = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(entry.loc) ? entry.loc[entry.loc.length - 1] : null;
        const fieldName = typeof field === 'string' ? `${field}: ` : '';
        return entry.msg ? `${fieldName}${entry.msg}` : null;
      })
      .filter((value): value is string => Boolean(value));
    if (messages.length) return messages.join(' ');
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Wire types                                                                */
/* -------------------------------------------------------------------------- */

export type ConversionStatus =
  | 'success'
  | 'partial'
  | 'requires_review'
  | 'unsupported'
  | 'invalid'
  | 'error';

export type IssueStatus = 'unsupported' | 'requires_review';

export interface ApiValidationStage {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ApiConversionIssue {
  id: string;
  status: IssueStatus;
  concept: string;
  detail: string;
  source_command?: string | null;
  original_line?: string | null;
}

export interface ApiLineMapping {
  line: number;
  source: string;
  target: string[];
  status: IssueStatus | 'converted';
  rule_id: string;
  rule_label: string;
  note?: string | null;
}

export interface ApiConversionResult {
  id: string;
  source_platform: string;
  target_platform: string;
  status: ConversionStatus;
  converted_configuration: string;
  commands_processed: number;
  commands_converted: number;
  requires_review: number;
  unsupported: number;
  warnings: ApiConversionIssue[];
  validation: ApiValidationStage[];
  mapping: ApiLineMapping[];
  ignored_lines: number;
  created_at: string;
}

export interface ApiDevice {
  id: string;
  name: string;
  vendor: string;
  family: string;
  cli_label: string;
  file_extension: string;
  description: string;
  capabilities: string[];
}

export interface ApiDevicesResponse {
  count: number;
  platforms: ApiDevice[];
}

export interface ApiHealth {
  status: string;
  service: string;
  version: string;
  platforms_supported: number;
  platform_ids: string[];
  engine: string;
  report_formats: string[];
}

export interface ApiDetectionResult {
  platform: string | null;
  confidence: number;
  reasons: string[];
  candidates: { platform: string; score: number; reasons: string[] }[];
}

export interface ApiValidationResult {
  platform: string;
  valid: boolean;
  status: 'valid' | 'valid_with_review' | 'invalid';
  stages: ApiValidationStage[];
  unparsed_count: number;
}

export interface ApiReport {
  report_id: string;
  report_type: string;
  generated_at: string;
  source_platform: string;
  target_platform: string;
  status: string;
  summary: Record<string, number>;
  converted_configuration: string;
  warnings: ApiConversionIssue[];
  unsupported_commands: { source_command?: string | null; concept: string; detail: string }[];
  requires_review: { source_command?: string | null; concept: string; detail: string }[];
  validation: { status: string; stages: ApiValidationStage[] };
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                 */
/* -------------------------------------------------------------------------- */

/** Liveness plus what the engine can currently do. */
export function getHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return request<ApiHealth>('/health', { signal, timeoutMs: 8000 });
}

/** The platform catalogue the converter dropdowns are built from. */
export function getDevices(signal?: AbortSignal): Promise<ApiDevicesResponse> {
  return request<ApiDevicesResponse>('/devices', { signal, timeoutMs: 8000 });
}

export interface ConvertPayload {
  sourcePlatform: PlatformId;
  targetPlatform: PlatformId;
  configuration: string;
  validate?: boolean;
}

export function convertConfiguration(payload: ConvertPayload, signal?: AbortSignal): Promise<ApiConversionResult> {
  return request<ApiConversionResult>('/conversions', {
    method: 'POST',
    signal,
    body: {
      source_platform: payload.sourcePlatform,
      target_platform: payload.targetPlatform,
      configuration: payload.configuration,
      validate: payload.validate ?? true,
    },
  });
}

export interface UploadPayload {
  file: File;
  sourcePlatform: PlatformId;
  targetPlatform: PlatformId;
  validate?: boolean;
  signal?: AbortSignal;
}

/**
 * Uploads a configuration file for conversion.
 *
 * The file is sent as multipart; the backend size-checks it, checks the
 * extension and decodes it as untrusted text.
 */
export async function uploadConfiguration(payload: UploadPayload): Promise<ApiConversionResult> {
  const { file, sourcePlatform, targetPlatform, validate = true, signal } = payload;
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('source_platform', sourcePlatform);
  form.append('target_platform', targetPlatform);
  form.append('validate', String(validate));

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('timeout', 'TimeoutError')),
    API_TIMEOUT_MS,
  );
  const onExternalAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new ApiError('aborted', 'The request was cancelled.');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}/conversions/upload`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new ApiError('aborted', 'The request was cancelled.');
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    if (isTimeout) {
      throw new ApiError(
        'timeout',
        `The upload did not complete within ${Math.round(API_TIMEOUT_MS / 1000)}s.`,
        undefined,
        'The request was abandoned, not failed. Retry, or upload a smaller file.',
      );
    }
    throw await unreachableError('The upload could not be completed.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (response.ok) {
        throw new ApiError(
          'parse',
          'The conversion service returned a response that is not JSON.',
          response.status,
          `Check that the API base URL (${API_BASE_URL}) points at the CYBERSURE API.`,
        );
      }
    }
  }
  if (!response.ok) {
    const detail = extractDetail(parsed) ?? `Upload failed with status ${response.status}.`;
    throw new ApiError(
      response.status >= 500 ? 'server-error' : 'rejected',
      detail,
      response.status,
      httpAdvice(response.status),
    );
  }
  return parsed as ApiConversionResult;
}

/** Best-effort platform detection with a confidence score. */
export function detectPlatform(
  configuration: string,
  signal?: AbortSignal,
): Promise<ApiDetectionResult> {
  return request<ApiDetectionResult>('/detect', {
    method: 'POST',
    signal,
    body: { configuration },
  });
}

/** Validates a configuration in its own platform syntax. */
export function validateConfiguration(
  platform: PlatformId,
  configuration: string,
  signal?: AbortSignal,
): Promise<ApiValidationResult> {
  return request<ApiValidationResult>('/validate', {
    method: 'POST',
    signal,
    body: { platform, configuration },
  });
}

/** Fetches the stored JSON report for a conversion id. */
export function getReport(reportId: string, signal?: AbortSignal): Promise<ApiReport> {
  return request<ApiReport>(`/reports/${encodeURIComponent(reportId)}`, { signal });
}

/* -------------------------------------------------------------------------- */
/* Status vocabulary                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The operator-facing states the converter shows.
 *
 * There is no longer a "pair is unavailable" case: every platform pair is
 * convertible. What varies is how much of the configuration could be
 * translated safely, and that is what these labels report.
 */
export const CONVERSION_STATE = {
  converting: 'CONVERTING…',
  success: 'CONVERSION SUCCESSFUL',
  partial: 'PARTIAL CONVERSION',
  requiresReview: 'REQUIRES REVIEW',
  unsupported: 'UNSUPPORTED CONFIGURATION',
  invalid: 'CONVERSION ERROR',
} as const;

export type ConversionStateLabel = (typeof CONVERSION_STATE)[keyof typeof CONVERSION_STATE];

export function conversionStateLabel(status: ConversionStatus): ConversionStateLabel {
  switch (status) {
    case 'success':
      return CONVERSION_STATE.success;
    case 'partial':
      return CONVERSION_STATE.partial;
    case 'requires_review':
      return CONVERSION_STATE.requiresReview;
    case 'unsupported':
      return CONVERSION_STATE.unsupported;
    case 'invalid':
    case 'error':
    default:
      return CONVERSION_STATE.invalid;
  }
}

/** A plain-language explanation of what a status means for the operator. */
export function conversionStateHint(status: ConversionStatus): string {
  switch (status) {
    case 'success':
      return 'Every recognised statement was translated and the generated configuration passed structural validation.';
    case 'partial':
      return 'Most of the configuration was translated. Some constructs have no equivalent on the target and are listed below — they were deliberately not invented.';
    case 'requires_review':
      return 'The configuration was translated, but some translations cannot be proven equivalent. Review each flagged item before deploying.';
    case 'unsupported':
      return 'Nothing in this configuration could be expressed in the target platform syntax. Check that both platform selectors are correct.';
    case 'invalid':
    case 'error':
    default:
      return 'The generated configuration failed structural validation. Review the validation stages below.';
  }
}
