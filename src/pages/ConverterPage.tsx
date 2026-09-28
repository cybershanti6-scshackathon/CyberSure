import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPaste,
  Copy,
  Download,
  FileCode2,
  HelpCircle,
  Loader2,
  Plug,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import type { ConversionResult, PlatformId } from '@/types';
import { useCyberSure } from '@/lib/store';
import {
  ApiError,
  CONVERSION_STATE,
  API_BASE_URL,
  conversionStateHint,
  conversionStateLabel,
  convertConfiguration,
  getReport,
  uploadConfiguration,
  validateConfiguration,
  type ApiReport,
  type ConversionStatus,
} from '@/lib/api';
import { toConversionResult, withValidation } from '@/lib/conversionAdapter';
import { PLATFORM_BY_ID, platformFileName, platformName } from '@/data/platforms';
import { DEMO_UPLOADS, defaultSample, samplesFor } from '@/data/demoConfigurations';
import { cx } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { ProgressBar, Spinner, Tooltip } from '@/components/ui/Primitives';
import { useNotify } from '@/components/ui/Toast';
import { ConfigEditor } from '@/components/converter/ConfigEditor';
import {
  CommandMapping,
  ConversionSummary,
  ConversionValidation,
  PlatformChip,
} from '@/components/converter/ConversionResultPanels';
import { SectionHeading } from '@/components/common/Bits';
import { useBackendStatus, usePlatformOptions } from '@/hooks/useBackendStatus';

/** The stages the backend walks through, mirrored here for the progress meter. */
const CONVERSION_PHASES = [
  'Sending configuration to the conversion API',
  'Parsing platform syntax',
  'Building the normalized network model',
  'Rendering target-platform syntax',
  'Validating the generated configuration',
] as const;

const UPLOAD_ACCEPT = '.cfg,.conf,.txt,.rsc,.ios,.junos,.config,.rcf';

/** Resolves the optional device binding used in the session history. */
function deviceLabel(deviceId: string, devices: { id: string; name: string }[]): string | null {
  if (!deviceId) return null;
  return devices.find((device) => device.id === deviceId)?.name ?? null;
}

export function ConverterPage() {
  const { devices, recordConversion, conversions, notify } = useCyberSure();
  const notifyRef = useNotify();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const backend = useBackendStatus();
  const platformOptions = usePlatformOptions(backend.devices);

  const [from, setFrom] = useState<PlatformId>('cisco-nxos');
  const [to, setTo] = useState<PlatformId>('juniper-junos');
  const [source, setSource] = useState(() => defaultSample('cisco-nxos').config);
  const [sourceSampleId, setSourceSampleId] = useState(() => defaultSample('cisco-nxos').id);
  const [deviceId, setDeviceId] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [converted, setConverted] = useState(false);
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState(-1);
  const [validating, setValidating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const lastAppliedSignature = useRef<string>('');

  /** Records a finished run so the session history and reports see it. */
  const record = useCallback(
    (next: ConversionResult) => {
      recordConversion(next, deviceLabel(deviceId, devices));
    },
    [recordConversion, deviceId, devices],
  );

  // Deep link from the assistant / reports: ?from=&to=
  useEffect(() => {
    const nextFrom = searchParams.get('from');
    const nextTo = searchParams.get('to');
    if (nextFrom) {
      setFrom(nextFrom as PlatformId);
      setSource(defaultSample(nextFrom as PlatformId).config);
      setSourceSampleId(defaultSample(nextFrom as PlatformId).id);
    }
    if (nextTo) setTo(nextTo as PlatformId);
  }, [searchParams]);

  // Cancel any in-flight request if the operator navigates away.
  useEffect(() => () => requestRef.current?.abort(), []);

  const handleFromChange = (value: PlatformId) => {
    setFrom(value);
    const sample = defaultSample(value);
    setSource(sample.config);
    setSourceSampleId(sample.id);
    setResult(null);
    setError(null);
    setConverted(false);
    lastAppliedSignature.current = '';
  };

  const handleToChange = (value: PlatformId) => {
    setTo(value);
    setResult(null);
    setError(null);
    lastAppliedSignature.current = '';
  };

  const swapPlatforms = () => {
    const previousFrom = from;
    const previousTo = to;
    setTo(previousFrom);
    setFrom(previousTo);
    setSource(defaultSample(previousTo).config);
    setSourceSampleId(defaultSample(previousTo).id);
    setResult(null);
    setError(null);
    lastAppliedSignature.current = '';
  };

  /** Drives the phase meter while the request is in flight. */
  const startPhaseMeter = useCallback(() => {
    setPhase(0);
    CONVERSION_PHASES.slice(1).forEach((_, index) => {
      window.setTimeout(() => setPhase(index + 1), (index + 1) * 520);
    });
  }, []);

  const stopPhaseMeter = useCallback(() => {
    setPhase(-1);
  }, []);

  const runConversion = useCallback(async () => {
    if (running || source.trim().length === 0) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setRunning(true);
    setError(null);
    setResult(null);
    startPhaseMeter();

    try {
      const response = await convertConfiguration(
        { sourcePlatform: from, targetPlatform: to, configuration: source },
        controller.signal,
      );
      const next = toConversionResult(response, { sourceConfig: source, from, to });
      lastAppliedSignature.current = `${from}|${to}|${source}`;
      setResult(next);
      setConverted(true);
      record(next);
      notifyRef.success(
        conversionStateLabel(response.status),
        `${next.processed} commands processed · ${next.converted} converted · ${next.needsReview} need review · ${next.unsupported} not converted.`,
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === 'aborted') return;
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError('unavailable', 'The conversion could not be completed.');
      setError(apiError);
      setConverted(false);
      notify({
        kind: 'conversion',
        title: 'Conversion failed',
        detail: apiError.message,
        tone: 'critical',
        link: { to: '/converter', label: 'Open converter' },
      });
    } finally {
      stopPhaseMeter();
      setRunning(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [running, source, from, to, startPhaseMeter, stopPhaseMeter, notifyRef, notify, record]);

  // Once a conversion has run, editing the source re-runs it so the two panels
  // can never disagree. Debounced, and cancelled if another edit arrives.
  useEffect(() => {
    if (!converted || running || source.trim().length === 0) return;
    const signature = `${from}|${to}|${source}`;
    if (lastAppliedSignature.current === signature) return;
    const timer = window.setTimeout(() => void runConversion(), 700);
    return () => window.clearTimeout(timer);
  }, [converted, running, source, from, to, runConversion]);

  /**
   * Uploads a configuration file. The backend parses, converts and validates it
   * in one call; the local read is only so the editor can show the same text.
   */
  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const text = await file.text();
      const response = await uploadConfiguration({
        file,
        sourcePlatform: from,
        targetPlatform: to,
      });
      const next = toConversionResult(response, { sourceConfig: text, from, to });
      setSource(text);
      setSourceSampleId('');
      setResult(next);
      setConverted(true);
      lastAppliedSignature.current = `${from}|${to}|${text}`;
      record(next);
      notifyRef.success(
        conversionStateLabel(response.status),
        `${file.name} uploaded as ${platformName(from)} → ${platformName(to)} — ${next.converted} commands translated, ${next.unsupported} not converted.`,
      );
    } catch (caught) {
      const apiError =
        caught instanceof ApiError ? caught : new ApiError('rejected', 'The file could not be uploaded.');
      setError(apiError);
      notifyRef.error('Upload failed', apiError.message);
    } finally {
      setUploading(false);
    }
  };

  const runValidation = async () => {
    if (!result) return;
    setValidating(true);
    try {
      const response = await validateConfiguration(to, result.targetConfig);
      setResult(withValidation(result, response.stages));
      const tone =
        response.status === 'invalid' ? 'critical' : response.status === 'valid_with_review' ? 'warning' : 'ok';
      notify({
        kind: 'validation',
        title:
          response.status === 'valid'
            ? 'Configuration validation completed'
            : response.status === 'valid_with_review'
              ? 'Configuration validation completed with review'
              : 'Configuration validation failed',
        detail: `${platformName(to)}: ${response.stages.map((stage) => `${stage.label} ${stage.status}`).join(' · ')}.`,
        tone,
        link: { to: '/converter', label: 'Open converter' },
      });
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : new ApiError('rejected', 'Validation failed.');
      notifyRef.error('Validation failed', apiError.message);
    } finally {
      setValidating(false);
    }
  };

  /** Downloads the backend-generated JSON report. JSON is the only format. */
  const downloadReport = async () => {
    if (!result?.reportId) return;
    setDownloading(true);
    try {
      const report: ApiReport = await getReport(result.reportId);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'configuration-report.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      notifyRef.success('Report downloaded', 'configuration-report.json');
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : new ApiError('rejected', 'The report could not be fetched.');
      notifyRef.error('Report unavailable', apiError.message);
    } finally {
      setDownloading(false);
    }
  };

  const copyTarget = async () => {
    if (!result?.targetConfig) return;
    try {
      await navigator.clipboard.writeText(result.targetConfig);
      notifyRef.success('Copied to clipboard', `${platformName(to)} candidate configuration copied.`);
    } catch {
      notifyRef.error('Clipboard unavailable', 'Select the converted configuration and copy it manually.');
    }
  };

  const downloadText = (content: string, filename: string, label: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    notifyRef.success(label, `Saved ${filename}`);
  };

  const highlightLines = useMemo(() => {
    if (!result) return undefined;
    return result.mapping
      .filter((entry) => entry.status !== 'converted')
      .map((entry) => ({
        line: entry.line,
        tone: entry.status === 'unsupported' ? ('fail' as const) : ('warn' as const),
      }));
  }, [result]);

  const reviewEntries = result?.mapping.filter((entry) => entry.status !== 'converted') ?? [];
  const stateLabel = result ? conversionStateLabel((result.backendStatus ?? 'success') as ConversionStatus) : null;
  const stateTone: Record<string, 'ok' | 'medium' | 'critical' | 'neutral' | 'info'> = {
    [CONVERSION_STATE.success]: 'ok',
    [CONVERSION_STATE.partial]: 'medium',
    [CONVERSION_STATE.requiresReview]: 'medium',
    [CONVERSION_STATE.unsupported]: 'critical',
    [CONVERSION_STATE.invalid]: 'critical',
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
            Configuration Converter
          </h1>
          <p className="mt-1 text-[12.5px] text-dimmer">
            Convert network configuration between any two supported platforms, on the CYBERSURE conversion service.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setHowItWorksOpen(true)} icon={<HelpCircle className="h-3.5 w-3.5" aria-hidden />}>
            How It Works
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExplainOpen(true)}
            icon={<Bot className="h-3.5 w-3.5" aria-hidden />}
            disabled={!result}
          >
            Explain Conversion
          </Button>
        </div>
      </header>

      {/* ---------------- Backend connection ---------------- */}
      <BackendBanner
        state={backend.state}
        platformCount={backend.health?.platforms_supported ?? null}
        devicesFromApi={backend.devicesFromApi}
        error={backend.error}
        onRetry={() => void backend.refresh()}
      />

      {/* ---------------- Platform selector ---------------- */}
      <Card>
        <CardBody>
          <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Field label="From device" htmlFor="converter-from">
              <Select
                id="converter-from"
                value={from}
                onChange={(event) => handleFromChange(event.target.value as PlatformId)}
                options={platformOptions}
              />
            </Field>

            <div className="flex items-center justify-center pb-1">
              <Tooltip content="Swap source and target" side="bottom">
                <button
                  type="button"
                  onClick={swapPlatforms}
                  aria-label="Swap source and target platform"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-600 bg-ink-850 text-ink-200 transition-colors hover:border-accent-500/50 hover:text-accent-300 [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-700"
                >
                  <ArrowRightLeft className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            </div>

            <Field label="To device" htmlFor="converter-to">
              <Select
                id="converter-to"
                value={to}
                onChange={(event) => handleToChange(event.target.value as PlatformId)}
                options={platformOptions}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">
              <PlugZap className="mr-1 inline h-3 w-3" aria-hidden />
              {platformOptions.length} platforms · normalized IR engine
            </Badge>
            <span className="text-[11.5px] text-dimmer">
              Every platform pair is convertible. What varies is how much of the configuration can be translated
              faithfully.
            </span>

            <div className="ml-auto flex items-center gap-2">
              <span className="eyebrow">Session history</span>
              {conversions.length > 0 ? (
                <Badge tone="neutral">
                  {conversions.length} run{conversions.length === 1 ? '' : 's'}
                </Badge>
              ) : (
                <span className="text-[11.5px] text-dimmer">No conversions yet</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ---------------- Source / target panels ---------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Source */}
        <Card className="flex flex-col">
          <CardHeader
            title="Source Configuration"
            description="Edit the sample configuration — the conversion re-runs automatically once one has succeeded."
            icon={<FileCode2 className="h-4 w-4" aria-hidden />}
            action={PlatformChip({ platformId: from, label: platformName(from) })}
          />
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-700/70 px-4 py-2 [html.light_&]:border-ink-100">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              icon={uploading ? undefined : <Upload className="h-3.5 w-3.5" aria-hidden />}
            >
              {uploading ? 'Uploading…' : 'Upload File'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSource('');
                setSourceSampleId('');
                setResult(null);
                setConverted(false);
                notifyRef.info('Editor cleared', 'Paste a configuration into the source editor, or upload a file.');
                setTimeout(() => sourceRef.current?.focus(), 40);
              }}
              icon={<ClipboardPaste className="h-3.5 w-3.5" aria-hidden />}
            >
              Paste Configuration
            </Button>
            <Select
              aria-label="Load a sample configuration"
              value={sourceSampleId}
              onChange={(event) => {
                const sample = samplesFor(from).find((entry) => entry.id === event.target.value);
                if (sample) {
                  setSource(sample.config);
                  setSourceSampleId(sample.id);
                  setResult(null);
                  notifyRef.info('Configuration loaded', sample.description);
                }
              }}
              className="h-8 w-auto min-w-[190px] py-0 text-[12px]"
              options={[
                { value: '', label: 'Paste / custom…' },
                ...samplesFor(from).map((sample) => ({ value: sample.id, label: `Sample: ${sample.name}` })),
              ]}
            />
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-dimmer">
              <FlaskChip />
              CONFIGURATION
            </span>
          </div>
          <CardBody className="flex-1">
            <ConfigEditor
              value={source}
              onChange={(value) => {
                setSource(value);
                setSourceSampleId('');
              }}
              platform={from}
              label="Source configuration"
              minHeight={300}
              highlightLines={highlightLines}
              textareaRef={sourceRef}
              emptyHint="Paste a configuration here, or load one of the samples above."
            />
            <p className="mt-2 text-[11px] leading-relaxed text-dimmer">
              {source.split('\n').length} lines · {source.trim().length === 0 ? 'empty' : 'ready to convert'}. Uploads are
              sent to the conversion service and processed as untrusted text.
            </p>
          </CardBody>
        </Card>

        {/* Target */}
        <Card className="flex flex-col">
          <CardHeader
            title="Converted Configuration"
            description="Generated by the CYBERSURE conversion service from the source above."
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            action={PlatformChip({ platformId: to, label: platformName(to) })}
          />
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-700/70 px-4 py-2 [html.light_&]:border-ink-100">
            <Button
              size="sm"
              variant="secondary"
              onClick={copyTarget}
              disabled={!result?.targetConfig}
              icon={<Copy className="h-3.5 w-3.5" aria-hidden />}
            >
              Copy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!result?.targetConfig}
              onClick={() =>
                result &&
                downloadText(
                  result.targetConfig,
                  platformFileName(to, 'converted'),
                  'Converted configuration downloaded',
                )
              }
              icon={<Download className="h-3.5 w-3.5" aria-hidden />}
            >
              Download
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!result?.reportId}
              loading={downloading}
              onClick={() => void downloadReport()}
              icon={<FileCode2 className="h-3.5 w-3.5" aria-hidden />}
            >
              Download JSON Report
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!result?.targetConfig}
              onClick={() =>
                result &&
                downloadText(
                  result.targetConfig,
                  `cybersure-${result.id.toLowerCase()}.${PLATFORM_BY_ID[to]?.fileExtension ?? 'cfg'}`,
                  'File saved',
                )
              }
              icon={<Save className="h-3.5 w-3.5" aria-hidden />}
            >
              Save as File
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setSource(defaultSample(from).config);
                setSourceSampleId(defaultSample(from).id);
                setResult(null);
                setConverted(false);
                setError(null);
                lastAppliedSignature.current = '';
              }}
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
            >
              Reset sample
            </Button>
          </div>
          <CardBody className="flex-1">
            {running ? (
              <div className="space-y-3 rounded-lg border border-ink-700/70 bg-ink-850 px-4 py-6 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-100 [html.light_&]:text-ink-800">
                  <Loader2 className="h-4 w-4 animate-spin text-accent-400 [html.light_&]:text-accent-600" aria-hidden />
                  {CONVERSION_STATE.converting}
                </div>
                <ProgressBar
                  value={((Math.max(0, phase) + 1) / CONVERSION_PHASES.length) * 100}
                  label="Conversion progress"
                />
                <ol className="space-y-1">
                  {CONVERSION_PHASES.map((entry, index) => (
                    <li
                      key={entry}
                      className={cx(
                        'flex items-center gap-2 text-[11.5px]',
                        index < phase
                          ? 'text-emerald-400 [html.light_&]:text-emerald-600'
                          : index === phase
                            ? 'text-ink-100 [html.light_&]:text-ink-800'
                            : 'text-dimmer',
                      )}
                    >
                      {index < phase ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
                      )}
                      {entry}
                    </li>
                  ))}
                </ol>
              </div>
            ) : error && !result ? (
              <ErrorPanel error={error} onRetry={() => void runConversion()} />
            ) : result?.targetConfig ? (
              result.status === 'invalid' ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-red-500/35 bg-red-500/[0.06] px-6 text-center">
                  <XCircle className="h-5 w-5 text-red-400 [html.light_&]:text-red-600" aria-hidden />
                  <p className="text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                    {CONVERSION_STATE.invalid}
                  </p>
                  <p className="max-w-sm text-[11.5px] leading-relaxed text-dimmer">
                    The generated configuration failed structural validation. Review the highlighted commands in the
                    source editor — the line numbers in amber and red mark the statements that could not be translated.
                    Fix or remove them and convert again.
                  </p>
                  <ConfigEditor
                    value={result.targetConfig}
                    readOnly
                    platform={to}
                    label="Rejected conversion output"
                    minHeight={140}
                    className="mt-2 w-full"
                  />
                </div>
              ) : (
                <ConfigEditor value={result.targetConfig} readOnly platform={to} label="Converted configuration" minHeight={300} />
              )
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 bg-ink-850/50 px-6 text-center [html.light_&]:border-ink-300 [html.light_&]:bg-ink-50/60">
                <ArrowRight className="h-5 w-5 text-dimmer" aria-hidden />
                <p className="text-[12.5px] font-medium text-ink-200 [html.light_&]:text-ink-800">No conversion yet</p>
                <p className="max-w-xs text-[11.5px] leading-relaxed text-dimmer">
                  Press{' '}
                  <span className="font-medium text-accent-400 [html.light_&]:text-accent-600">Convert Configuration</span>{' '}
                  to translate the source into {platformName(to)} syntax.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ---------------- Convert action ---------------- */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="primary"
          size="lg"
          onClick={() => void runConversion()}
          loading={running}
          disabled={running || source.trim().length === 0 || uploading}
          icon={running ? undefined : <Sparkles className="h-4 w-4" aria-hidden />}
        >
          {running ? 'Converting…' : 'Convert Configuration'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void runValidation()}
          loading={validating}
          disabled={!result?.targetConfig || validating}
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
        >
          Validate Converted Configuration
        </Button>
      </div>

      {/* ---------------- Result state banner ---------------- */}
      {result && stateLabel ? (
        <Card>
          <CardBody className="flex flex-wrap items-start gap-3">
            <span
              className={cx(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                result.backendStatus === 'success'
                  ? 'border-emerald-500/35 bg-emerald-500/10'
                  : result.backendStatus === 'invalid' || result.backendStatus === 'unsupported'
                    ? 'border-red-500/35 bg-red-500/10'
                    : 'border-amber-500/35 bg-amber-500/10',
              )}
            >
              {result.backendStatus === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 [html.light_&]:text-emerald-600" aria-hidden />
              ) : result.backendStatus === 'invalid' || result.backendStatus === 'unsupported' ? (
                <XCircle className="h-4 w-4 text-red-400 [html.light_&]:text-red-600" aria-hidden />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400 [html.light_&]:text-amber-600" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{stateLabel}</p>
                <Badge tone={stateTone[stateLabel] ?? 'neutral'}>
                  {result.converted} translated · {result.needsReview} review · {result.unsupported} not converted
                </Badge>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-dimmer">
                {conversionStateHint((result.backendStatus ?? 'success') as ConversionStatus)}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* ---------------- Conversion detail ---------------- */}
      {result ? (
        <>
          <ConversionSummary result={result} />
          <ConversionValidation result={result} validating={validating} onValidate={() => void runValidation()} />
          <CommandMapping result={result} />
        </>
      ) : null}

      {/* ---------------- Sample files ---------------- */}
      <Card>
        <CardHeader
          title="Configuration files"
          description="Sample files you can load into the source editor to see a different conversion."
          icon={<Upload className="h-4 w-4" aria-hidden />}
        />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_UPLOADS.map((upload) => (
              <li key={upload.filename}>
                <button
                  type="button"
                  onClick={() => {
                    const platformSwitched = upload.platform !== from;
                    if (platformSwitched) handleFromChange(upload.platform);
                    setSource(upload.config);
                    setSourceSampleId('');
                    setResult(null);
                    setConverted(false);
                    notifyRef.info(
                      'File loaded',
                      platformSwitched
                        ? `${upload.filename} — From device set to ${platformName(upload.platform)} so the sample matches its syntax.`
                        : upload.filename,
                    );
                  }}
                  className="w-full rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 text-left transition-colors hover:border-accent-500/40 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[12px] font-medium text-ink-100 [html.light_&]:text-ink-800">{upload.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-dimmer">{upload.config.split('\n').length} lines</span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10.5px] text-dimmer">{upload.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Device binding (optional, keeps the converter connected to the estate) */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <p className="eyebrow">Optional: link this run to a device</p>
            <p className="mt-0.5 text-[11.5px] text-dimmer">
              The chosen device is recorded with the conversion in the session history and reports.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select
              aria-label="Link conversion to a device"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              options={[{ value: '', label: 'Not linked' }, ...devices.map((device) => ({ value: device.id, label: device.name }))]}
            />
          </div>
        </CardBody>
      </Card>

      {/* ---------------- How it works ---------------- */}
      <Modal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        title="How the configuration converter works"
        description="Every conversion runs on the CYBERSURE conversion service through one pipeline — not a table of finished files."
        icon={<HelpCircle className="h-4 w-4" aria-hidden />}
        size="lg"
        footer={<Button variant="primary" onClick={() => setHowItWorksOpen(false)}>Got it</Button>}
      >
        <ol className="space-y-3">
          {[
            {
              step: '01',
              title: 'Pick any two platforms',
              body: 'The platform list comes from the conversion service. There is no allow-list of pairs — every supported platform can be a source or a target.',
            },
            {
              step: '02',
              title: 'Load or paste a source configuration',
              body: 'Paste text or upload a .cfg/.conf/.txt/.rsc file. The service reads it with a platform-aware parser: Cisco-style block indentation, Junos set and brace blocks, FortiOS config/edit blocks, PAN-OS set statements, RouterOS paths, Huawei VRP and VyOS.',
            },
            {
              step: '03',
              title: 'Normalize, then render',
              body: 'The source is parsed into a single normalized network model — hostname, interfaces, addressing, VLANs, routing, ACLs, services. The target renderer then emits that model in the target platform syntax, including interface-name translation and prefix-to-mask conversion.',
            },
            {
              step: '04',
              title: 'Review what could not be carried over',
              body: 'Where a concept has no equivalent on the target — a Cisco ACL against a Junos firewall filter, for example — it is reported as UNSUPPORTED with the original command, or REQUIRES REVIEW. Nothing is invented to fill the gap.',
            },
            {
              step: '05',
              title: 'Validate the output',
              body: 'Syntax, command mapping, required parameters and potential conflicts are checked on the generated candidate. The result is Valid, Valid with Review, or Invalid.',
            },
            {
              step: '06',
              title: 'Download the JSON report',
              body: 'Every run produces a structured report containing the converted configuration, the warnings, the unsupported commands, the review items and the validation stages. JSON is the only report format.',
            },
          ].map((entry) => (
            <li key={entry.step} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3.5 py-3 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
              <p className="font-mono text-[11px] text-accent-400 [html.light_&]:text-accent-600">{entry.step}</p>
              <p className="mt-1 text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{entry.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-dimmer">{entry.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <SectionHeading
            title="Supported platforms"
            description="Served live by GET /api/v1/devices. Adding one to the service makes it selectable here."
          />
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {(backend.devices.length > 0
              ? backend.devices.map((device) => ({ id: device.id, name: device.name, note: device.vendor }))
              : [
                  { id: 'cisco-ios', name: 'Cisco IOS', note: 'Cisco' },
                  { id: 'cisco-iosxe', name: 'Cisco IOS XE', note: 'Cisco' },
                  { id: 'cisco-nxos', name: 'Cisco NX-OS', note: 'Cisco' },
                  { id: 'cisco-asa', name: 'Cisco ASA', note: 'Cisco' },
                  { id: 'juniper-junos', name: 'Juniper Junos', note: 'Juniper' },
                  { id: 'fortinet-fortios', name: 'Fortinet FortiOS', note: 'Fortinet' },
                  { id: 'paloalto-panos', name: 'Palo Alto PAN-OS', note: 'Palo Alto Networks' },
                  { id: 'mikrotik-routeros', name: 'MikroTik RouterOS', note: 'MikroTik' },
                  { id: 'arista-eos', name: 'Arista EOS', note: 'Arista' },
                  { id: 'huawei-vrp', name: 'Huawei VRP', note: 'Huawei' },
                  { id: 'aruba-aoscx', name: 'Aruba AOS-CX', note: 'Aruba' },
                  { id: 'vyos', name: 'VyOS', note: 'Vyatta' },
                ]).map((device) => (
              <li
                key={device.id}
                className="flex items-center gap-2 rounded-md border border-ink-700/60 bg-ink-850 px-2.5 py-1.5 text-[11.5px] [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
              >
                <span className="font-medium text-ink-100 [html.light_&]:text-ink-800">{device.name}</span>
                <span className="ml-auto text-[10.5px] text-dimmer">{device.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* Explain with the assistant */}
      <Modal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        title="Explain this conversion"
        description="Hand the current conversion to the CYBERSURE assistant."
        icon={<Bot className="h-4 w-4" aria-hidden />}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExplainOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setHowItWorksOpen(false);
                setExplainOpen(false);
                navigate(`/assistant?context=conversion&from=${from}&to=${to}`);
              }}
              iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
            >
              Open in Assistant
            </Button>
          </>
        }
      >
        {result ? (
          <div className="space-y-3 text-[12.5px] leading-relaxed text-dim">
            <p>
              <span className="font-medium text-ink-50 [html.light_&]:text-ink-900">CYBERSURE</span> will walk through the{' '}
              {platformName(result.from)} → {platformName(result.to)} mapping: {result.converted} converted commands,{' '}
              {result.needsReview} flagged for review, {result.unsupported} not converted, and{' '}
              {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}.
            </p>
            {reviewEntries.slice(0, 3).map((entry) => (
              <p key={`${entry.line}-${entry.ruleId}`} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 text-[11.5px] text-dimmer [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                <span className="font-mono text-ink-200 [html.light_&]:text-ink-700">Line {entry.line}</span> —{' '}
                {entry.note ?? entry.ruleLabel}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-dimmer">Run a conversion first.</p>
        )}
      </Modal>
    </div>
  );
}

/* =============================================================================
 * Backend connection banner
 * ========================================================================== */

function BackendBanner({
  state,
  platformCount,
  devicesFromApi,
  error,
  onRetry,
}: {
  state: 'checking' | 'online' | 'degraded' | 'offline';
  platformCount: number | null;
  devicesFromApi: boolean;
  error: ApiError | null;
  onRetry: () => void;
}) {
  if (state === 'online') {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center gap-2.5">
          <PlugZap className="h-4 w-4 shrink-0 text-emerald-400 [html.light_&]:text-emerald-600" aria-hidden />
          <p className="text-[12px] text-ink-200 [html.light_&]:text-ink-800">
            <span className="font-semibold text-emerald-400 [html.light_&]:text-emerald-600">Conversion service connected.</span>{' '}
            {platformCount !== null ? `${platformCount} platforms registered.` : 'Ready.'}{' '}
            {devicesFromApi
              ? 'Platform list loaded from the service.'
              : 'Using the built-in platform list until the service responds.'}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (state === 'checking') {
    return (
      <Card>
        <CardBody className="flex items-center gap-2.5">
          <Spinner className="text-accent-400 [html.light_&]:text-accent-600" />
          <p className="text-[12px] text-ink-200 [html.light_&]:text-ink-800">
            Checking the CYBERSURE conversion service at{' '}
            <span className="font-mono text-[11.5px] text-dimmer">{API_BASE_URL}</span>…
          </p>
        </CardBody>
      </Card>
    );
  }

  const tone = state === 'degraded' ? 'medium' : 'critical';
  // When the health probe itself works but the API is still unusable, the cause
  // is almost always origin/CORS rather than a dead server. Say so.
  const blocked = error?.diagnosis?.reason === 'blocked';
  return (
    <Card>
      <CardBody className="space-y-2.5">
        <div className="flex flex-wrap items-start gap-2.5">
          <Plug className="mt-0.5 h-4 w-4 shrink-0 text-amber-400 [html.light_&]:text-amber-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
              {blocked
                ? 'The browser blocked the request'
                : state === 'degraded'
                  ? 'The conversion service stopped responding'
                  : 'Conversion service is unavailable. Please start the CyberSure backend.'}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-dimmer">
              {error?.message ?? 'The service did not respond.'} The converter cannot run without it — no
              conversion is attempted locally, and no result is invented.
            </p>
            {error?.hint ? (
              <p className="mt-1.5 rounded-md border border-ink-700/70 bg-ink-850 px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-ink-200 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-800">
                {error.hint}
              </p>
            ) : null}
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-dimmer">
              API base URL <span className="font-mono">{API_BASE_URL}</span> · page origin{' '}
              <span className="font-mono">{typeof window !== 'undefined' ? window.location.origin : '(unknown)'}</span>
            </p>
          </div>
          <Badge tone={tone}>{state === 'degraded' ? 'Reconnecting' : blocked ? 'CORS' : 'Offline'}</Badge>
          <Button size="sm" variant="secondary" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
            Retry
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* =============================================================================
 * Conversion error panel
 * ========================================================================== */

const ERROR_TITLE: Record<string, string> = {
  unavailable: CONVERSION_STATE.invalid,
  timeout: 'Conversion timed out',
  'server-error': 'The conversion service returned an error',
  rejected: 'The conversion service rejected the request',
  parse: 'Unexpected response from the conversion service',
  aborted: 'Conversion cancelled',
};

function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  // A blocked cross-origin request is the single most common cause here, and it
  // is worth naming explicitly rather than leaving the operator guessing.
  const blocked = error.diagnosis?.reason === 'blocked';
  const title = blocked ? 'The browser blocked the request' : (ERROR_TITLE[error.kind] ?? 'Conversion error');
  const status = error.status ? `HTTP ${error.status}` : null;
  // Offline needs an instruction, not just a diagnosis: name the fix up front.
  const offline = !blocked && error.kind === 'unavailable';
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-2.5 rounded-lg border border-red-500/35 bg-red-500/[0.06] px-6 text-center">
      <XCircle className="h-5 w-5 text-red-400 [html.light_&]:text-red-600" aria-hidden />
      <p className="text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{title}</p>
      {status ? (
        <span className="rounded-md border border-ink-700/70 bg-ink-850 px-2 py-0.5 font-mono text-[10.5px] text-ink-200 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-800">
          {status}
        </span>
      ) : null}
      {offline ? (
        <p className="max-w-md text-[12px] font-semibold text-amber-400 [html.light_&]:text-amber-600">
          Conversion service is unavailable. Please start the CyberSure backend.
        </p>
      ) : null}
      <p className="max-w-md text-[11.5px] leading-relaxed text-dimmer">{error.message}</p>
      {error.hint ? (
        <p className="max-w-lg rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-ink-200 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-800">
          {error.hint}
        </p>
      ) : null}
      <p className="max-w-lg text-[10.5px] leading-relaxed text-dimmer">
        API base URL <span className="font-mono">{API_BASE_URL}</span> · page origin{' '}
        <span className="font-mono">{typeof window !== 'undefined' ? window.location.origin : '(unknown)'}</span>
      </p>
      {error.retryable ? (
        <Button size="sm" variant="secondary" className="mt-1" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

function FlaskChip() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />;
}
