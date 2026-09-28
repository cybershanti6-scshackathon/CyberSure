/* =============================================================================
 * Conversion result adapter
 * -----------------------------------------------------------------------------
 * Maps the backend's wire format onto the `ConversionResult` the rest of the app
 * already renders. Kept separate from `api.ts` so the transport layer stays
 * free of any interpretation.
 *
 * Nothing here invents data: every field comes from a field the backend sent.
 * ========================================================================== */

import type { ApiConversionIssue, ApiConversionResult, ApiLineMapping, ApiValidationStage } from '@/lib/api';
import type { ConversionResult, ConversionWarning, MappedCommand, PlatformId, ValidationOutcome } from '@/types';

/** Backend `requires_review` is the app's `review`; everything else is verbatim. */
function mapMappedStatus(status: ApiLineMapping['status']): MappedCommand['status'] {
  if (status === 'converted') return 'converted';
  if (status === 'requires_review') return 'review';
  return 'unsupported';
}

function mapValidation(stage: ApiValidationStage): ValidationOutcome {
  return {
    id: stage.id,
    label: stage.label,
    status: stage.status,
    detail: stage.detail,
  };
}

function mapWarning(issue: ApiConversionIssue, index: number): ConversionWarning {
  return {
    id: issue.id || `warning-${index}`,
    // `unsupported` is the more serious of the two, so it reads as medium.
    severity: issue.status === 'unsupported' ? 'medium' : 'low',
    title: issue.concept,
    detail: issue.source_command ? `${issue.detail} Source: \`${issue.source_command}\`` : issue.detail,
  };
}

/** Derives the app's validation status from the stage list. */
function mapStatus(stages: ApiValidationStage[]): ConversionResult['status'] {
  if (stages.length === 0) return 'not-run';
  if (stages.some((stage) => stage.status === 'fail')) return 'invalid';
  if (stages.some((stage) => stage.status === 'warn')) return 'valid-with-review';
  return 'valid';
}

export interface AdapterContext {
  /** The exact configuration text that was sent, so the UI can show the source. */
  sourceConfig: string;
  from: PlatformId;
  to: PlatformId;
}

/** Converts a backend conversion response into the app's result shape. */
export function toConversionResult(response: ApiConversionResult, context: AdapterContext): ConversionResult {
  const validation = response.validation.map(mapValidation);
  return {
    id: response.id,
    from: context.from,
    to: context.to,
    sourceConfig: context.sourceConfig,
    targetConfig: response.converted_configuration,
    processed: response.commands_processed,
    converted: response.commands_converted,
    needsReview: response.requires_review,
    unsupported: response.unsupported,
    warnings: response.warnings.map(mapWarning),
    mapping: response.mapping.map((entry) => ({
      line: entry.line,
      source: entry.source,
      target: entry.target ?? [],
      status: mapMappedStatus(entry.status),
      ruleId: entry.rule_id,
      ruleLabel: entry.rule_label,
      ...(entry.note ? { note: entry.note } : {}),
    })),
    validation: validation.length > 0 ? validation : null,
    status: mapStatus(response.validation),
    createdAt: response.created_at,
    backendStatus: response.status,
    reportId: response.id,
  };
}

/** Replaces only the validation half of a result, after a re-validation run. */
export function withValidation(
  result: ConversionResult,
  stages: ApiValidationStage[],
): ConversionResult {
  const validation = stages.map(mapValidation);
  return {
    ...result,
    validation: validation.length > 0 ? validation : null,
    status: mapStatus(stages),
  };
}

/**
 * Whether any warning means a construct could not be translated at all.
 * Used to separate "not converted" from "converted but check it".
 */
export function hasUnsupportedItems(result: ConversionResult): boolean {
  return result.warnings.some((warning) => warning.title.length > 0) && result.unsupported > 0;
}
