import { CheckCircle2, ClipboardCheck, FileCode2, HelpCircle, XCircle } from 'lucide-react';
import type { ConversionResult, PlatformId, ValidationOutcome } from '@/types';
import { PLATFORM_ACCENT, PLATFORM_BY_ID, platformName } from '@/data/platforms';
import { cx, formatDateTime } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Primitives';

/* =============================================================================
 * Conversion result panels
 * -----------------------------------------------------------------------------
 * Summary figures, the manual-review warning list, the validation report and the
 * line-by-line command mapping table. Split out of the page so the converter
 * route reads as a workflow rather than a wall of markup.
 * ========================================================================== */

/** Vendor-tinted platform chip used in the summary tiles and panel headers. */
export function PlatformChip({ platformId, label }: { platformId: PlatformId; label: string }) {
  const accent = PLATFORM_BY_ID[platformId]?.accent ?? 'sky';
  const palette = PLATFORM_ACCENT[accent];
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium',
        palette.bg,
        palette.border,
        palette.text,
      )}
    >
      {label}
    </span>
  );
}

function ValidationRow({ outcome }: { outcome: ValidationOutcome }) {
  const Icon = outcome.status === 'pass' ? CheckCircle2 : outcome.status === 'warn' ? HelpCircle : XCircle;
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
      <Icon
        className={cx(
          'mt-0.5 h-4 w-4 shrink-0',
          outcome.status === 'pass' && 'text-emerald-500',
          outcome.status === 'warn' && 'text-amber-500',
          outcome.status === 'fail' && 'text-red-500',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
          {outcome.label}{' '}
          <span
            className={cx(
              'ml-1 text-[11px] font-medium',
              outcome.status === 'pass' && 'text-emerald-400 [html.light_&]:text-emerald-600',
              outcome.status === 'warn' && 'text-amber-400 [html.light_&]:text-amber-600',
              outcome.status === 'fail' && 'text-red-400 [html.light_&]:text-red-600',
            )}
          >
            {outcome.status === 'pass' ? 'Passed' : outcome.status === 'warn' ? 'Warning' : 'Failed'}
          </span>
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">{outcome.detail}</p>
      </div>
    </li>
  );
}

function MappingRow({ entry }: { entry: ConversionResult['mapping'][number] }) {
  const tone =
    entry.status === 'converted'
      ? 'text-emerald-400 [html.light_&]:text-emerald-600'
      : entry.status === 'review'
        ? 'text-amber-400 [html.light_&]:text-amber-600'
        : 'text-red-400 [html.light_&]:text-red-600';
  const label = entry.status === 'converted' ? 'Converted' : entry.status === 'review' ? 'Review' : 'Not converted';
  return (
    <tr className="border-b border-ink-800/60 last:border-0 hover:bg-ink-850/60 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50">
      <td className="w-10 py-1.5 pl-2 pr-1 text-right font-mono text-[10.5px] text-dimmer">{entry.line}</td>
      <td className="py-1.5 pr-2 font-mono text-[11px] text-ink-100 [html.light_&]:text-ink-800">{entry.source}</td>
      <td className="py-1.5 pr-2 font-mono text-[11px] text-accent-300 [html.light_&]:text-accent-700">
        {entry.target.length > 0 ? entry.target.join('  ·  ') : <span className="text-dimmer">—</span>}
      </td>
      <td className="w-32 py-1.5 pr-2">
        <span className={cx('inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide', tone)}>
          {entry.status === 'converted' ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden />
          ) : (
            <HelpCircle className="h-3 w-3" aria-hidden />
          )}
          {label}
        </span>
      </td>
      <td className="hidden py-1.5 pr-2 text-[11px] leading-relaxed text-dimmer lg:table-cell">
        {entry.note ?? entry.ruleLabel}
      </td>
    </tr>
  );
}

const STATUS_TONE = {
  valid: 'ok',
  'valid-with-review': 'medium',
  invalid: 'critical',
  'not-run': 'neutral',
} as const;

const STATUS_LABEL = {
  valid: 'Valid',
  'valid-with-review': 'Valid with Review',
  invalid: 'Invalid',
  'not-run': 'Not validated',
} as const;

export function ConversionSummary({ result }: { result: ConversionResult }) {
  return (
    <Card>
      <CardHeader
        title="Conversion Summary"
        description={`${result.id} · ${formatDateTime(result.createdAt)} · source ${result.processed} commands`}
        icon={<FileCode2 className="h-4 w-4" aria-hidden />}
        action={<Badge tone={STATUS_TONE[result.status]}>{STATUS_LABEL[result.status]}</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Source', value: platformName(result.from), chip: true, platform: result.from },
            { label: 'Target', value: platformName(result.to), chip: true, platform: result.to },
            {
              label: 'Commands processed',
              value: String(result.processed),
              tone: 'text-ink-50 [html.light_&]:text-ink-900',
            },
            { label: 'Converted', value: String(result.converted), tone: 'text-emerald-400 [html.light_&]:text-emerald-600' },
            { label: 'Needs review', value: String(result.needsReview), tone: 'text-amber-400 [html.light_&]:text-amber-600' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
            >
              <p className="eyebrow">{stat.label}</p>
              {stat.chip ? (
                <div className="mt-1.5">
                  <PlatformChip platformId={stat.platform as PlatformId} label={stat.value} />
                </div>
              ) : (
                <p className={cx('mt-1 text-[20px] font-semibold leading-none tabular-nums', stat.tone)}>{stat.value}</p>
              )}
            </div>
          ))}
        </div>

        {result.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/[0.07] px-3.5 py-3">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-200 [html.light_&]:text-amber-700">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'} — some vendor-specific commands may
              require manual review
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.warnings.map((warning) => (
                <li key={warning.id} className="text-[11.5px] leading-relaxed text-ink-200 [html.light_&]:text-ink-700">
                  <span className="font-medium text-amber-300 [html.light_&]:text-amber-700">{warning.title}.</span>{' '}
                  {warning.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function ConversionValidation({
  result,
  validating,
  onValidate,
}: {
  result: ConversionResult;
  validating: boolean;
  onValidate: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Conversion Validation"
        description="Checks the candidate output before it is treated as usable."
        icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
        action={
          <Button size="sm" variant="secondary" onClick={onValidate} loading={validating}>
            {result.validation ? 'Re-run validation' : 'Validate'}
          </Button>
        }
      />
      <CardBody>
        {validating ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-accent-500/30 bg-accent-500/[0.06] px-3.5 py-3 text-[12.5px] text-ink-200 [html.light_&]:text-ink-800">
            <Spinner className="text-accent-400 [html.light_&]:text-accent-600" />
            Running syntax, mapping, parameter and conflict checks…
          </div>
        ) : result.validation ? (
          <div className="space-y-2.5">
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.validation.map((outcome) => (
                <ValidationRow key={outcome.id} outcome={outcome} />
              ))}
            </ul>
            <div
              className={cx(
                'flex items-center gap-2 rounded-lg border px-3.5 py-3 text-[12.5px]',
                result.status === 'valid'
                  ? 'border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-200 [html.light_&]:border-emerald-200 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700'
                  : result.status === 'valid-with-review'
                    ? 'border-amber-500/35 bg-amber-500/[0.07] text-amber-200 [html.light_&]:border-amber-200 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-700'
                    : 'border-red-500/35 bg-red-500/[0.07] text-red-200 [html.light_&]:border-red-200 [html.light_&]:bg-red-50 [html.light_&]:text-red-700',
              )}
            >
              {result.status === 'valid' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              ) : result.status === 'valid-with-review' ? (
                <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>
                <span className="font-semibold">Conversion Validation Complete</span> — status{' '}
                {STATUS_LABEL[result.status]}. Unable to treat this as production-ready without reviewing the flagged
                lines.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ink-600 px-4 py-8 text-center [html.light_&]:border-ink-300">
            <ClipboardCheck className="h-5 w-5 text-dimmer" aria-hidden />
            <p className="text-[12.5px] font-medium text-ink-200 [html.light_&]:text-ink-800">Validation not run yet</p>
            <p className="max-w-sm text-[11.5px] leading-relaxed text-dimmer">
              Run validation to check syntax, command mapping, required parameters and potential conflicts on the
              converted output.
            </p>
            <Button size="sm" variant="secondary" onClick={onValidate}>
              Validate Converted Configuration
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function CommandMapping({ result }: { result: ConversionResult }) {
  const flagged = result.mapping.filter((entry) => entry.status !== 'converted').length;
  return (
    <Card>
      <CardHeader
        title="Command Mapping"
        description={`${flagged} of ${result.mapping.length} commands need attention. Click a line number in the source editor to locate a command.`}
        icon={<FileCode2 className="h-4 w-4" aria-hidden />}
      />
      <CardBody className="p-0">
        <div className="max-h-[420px] overflow-auto scroll-thin">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-ink-900 [html.light_&]:bg-white">
              <tr className="border-b border-ink-700/70 text-[10.5px] uppercase tracking-[0.1em] text-dimmer [html.light_&]:border-ink-100">
                <th scope="col" className="py-2 pl-2 pr-1 text-right font-semibold">
                  Ln
                </th>
                <th scope="col" className="py-2 pr-2 font-semibold">
                  Source command
                </th>
                <th scope="col" className="py-2 pr-2 font-semibold">
                  Converted output
                </th>
                <th scope="col" className="py-2 pr-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="hidden py-2 pr-2 font-semibold lg:table-cell">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {result.mapping.map((entry) => (
                <MappingRow key={`${entry.line}-${entry.ruleId}`} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
      <CardFooter>
        <p className="text-[11px] leading-relaxed text-dimmer">
          Mapping engine — {result.mapping.length} commands evaluated against the{' '}
          <span className="font-medium text-ink-200 [html.light_&]:text-ink-700">CYBERSURE</span> rule catalogue. No
          configuration is written to any device.
        </p>
      </CardFooter>
    </Card>
  );
}
