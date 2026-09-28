import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Info,
  Pencil,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ConfigItem, Device, ValidationReport, ValidationStage } from '@/types';
import { validateChange } from '@/lib/validation';
import { isValueCompliant } from '@/lib/analysis';
import { normaliseValue, validateSyntax } from '@/utils/validators';
import { cx } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Field, Segmented, Select, Switch, TextInput } from '@/components/ui/Form';
import { ProgressBar } from '@/components/ui/Primitives';
import { useNotify } from '@/components/ui/Toast';

/* -------------------------------------------------------------------------- */
/* Value control — the right widget per setting type                          */
/* -------------------------------------------------------------------------- */

export function ValueControl({
  item,
  value,
  onChange,
  invalid,
  id,
}: {
  item: ConfigItem;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  switch (item.type) {
    case 'toggle':
      return (
        <Switch
          id={id}
          checked={value === 'Enabled' || value === 'Present'}
          onChange={(checked) => onChange(checked ? 'Enabled' : 'Disabled')}
          label={value === 'Enabled' || value === 'Present' ? 'Enabled' : 'Disabled'}
        />
      );

    case 'action':
      return (
        <Segmented
          name={item.setting}
          value={value}
          onChange={onChange}
          options={[
            { value: 'DENY', label: 'Deny', tone: 'ok' },
            { value: 'ALLOW', label: 'Allow', tone: 'danger' },
          ]}
        />
      );

    case 'select':
      return (
        <Select
          id={id}
          value={value}
          invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          options={item.options ?? []}
        />
      );

    case 'number':
      return (
        <TextInput
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          suffix={item.unit}
        />
      );

    case 'port':
      return (
        <TextInput
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          suffix="port"
        />
      );

    case 'ip':
    case 'cidr':
    case 'text':
      return (
        <TextInput
          id={id}
          value={value}
          invalid={invalid}
          mono={item.type !== 'text'}
          placeholder={item.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'list':
      return (
        <TextInput
          id={id}
          value={value}
          invalid={invalid}
          mono
          placeholder={item.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    default:
      return (
        <TextInput id={id} value={value} invalid={invalid} onChange={(event) => onChange(event.target.value)} />
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Validation stage list                                                      */
/* -------------------------------------------------------------------------- */

const STAGE_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />,
  fail: <XCircle className="h-4 w-4 text-red-500" aria-hidden />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />,
  pending: <Info className="h-4 w-4 text-dimmer" aria-hidden />,
  running: <Info className="h-4 w-4 animate-pulse text-accent-400" aria-hidden />,
};

function StageRow({ stage, index }: { stage: ValidationStage; index: number }) {
  return (
    <li className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
      <div className="flex items-center gap-2.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-800 text-[10px] font-semibold tabular-nums text-dimmer [html.light_&]:bg-white">
          {index + 1}
        </span>
        {STAGE_ICON[stage.status]}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink-100 [html.light_&]:text-ink-800">
          {stage.label}
        </span>
        <Badge
          tone={
            stage.status === 'pass'
              ? 'ok'
              : stage.status === 'fail'
                ? 'critical'
                : stage.status === 'warn'
                  ? 'medium'
                  : 'neutral'
          }
        >
          {stage.status === 'pass'
            ? 'Pass'
            : stage.status === 'fail'
              ? 'Fail'
              : stage.status === 'warn'
                ? 'Warning'
                : 'Pending'}
        </Badge>
      </div>
      <p className="mt-1.5 pl-[3.1rem] text-[11.5px] leading-relaxed text-dimmer">{stage.detail}</p>
      {stage.messages.length > 0 ? (
        <ul className="mt-1.5 space-y-1 pl-[3.1rem]">
          {stage.messages.map((message, messageIndex) => (
            <li
              key={`${message}-${messageIndex}`}
              className="font-mono text-[11px] leading-relaxed text-ink-300 [html.light_&]:text-ink-600"
            >
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit + validate modal — the core remediation workflow                       */
/* -------------------------------------------------------------------------- */

export interface EditSettingModalProps {
  device: Device;
  item: ConfigItem | null;
  open: boolean;
  onClose: () => void;
  onApply: (payload: { newValue: string; note?: string }) => void;
}

export function EditSettingModal({ device, item, open, onClose, onApply }: EditSettingModalProps) {
  const notify = useNotify();
  const [draft, setDraft] = useState('');
  const [stageVisibility, setStageVisibility] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (open && item) {
      setDraft(item.value);
      setReport(null);
      setStageVisibility(0);
      setRunning(false);
      setApplied(false);
    }
  }, [open, item]);

  const syntax = useMemo(
    () => (item ? validateSyntax(item, draft) : { ok: true, message: '' }),
    [item, draft],
  );

  const proposedCompliant = item ? isValueCompliant(item, normaliseValue(item, draft)) : false;
  const isDifferent = item ? normaliseValue(item, draft) !== item.value : false;

  if (!item) return null;

  const runValidation = () => {
    setRunning(true);
    setReport(null);
    setStageVisibility(0);
    let step = 0;
    const advance = () => {
      step += 1;
      setStageVisibility(step as 0 | 1 | 2 | 3 | 4);
      if (step < 4) {
        setTimeout(advance, 320);
        return;
      }
      const result = validateChange({ device, item, rawValue: draft });
      setReport(result);
      setRunning(false);
      if (result.valid) {
        notify.success('Configuration validated successfully', 'All four validation stages passed.');
      } else {
        notify.warning(
          'Validation blocked this change',
          `${result.blocking.length} blocking issue${result.blocking.length === 1 ? '' : 's'} must be resolved.`,
        );
      }
    };
    setTimeout(advance, 320);
  };

  const handleApply = () => {
    if (!report?.valid) return;
    onApply({ newValue: report.proposedValue });
    setApplied(true);
  };

  const visibleStages = report
    ? report.stages.map((stage, index) => ({ stage, index })).slice(0, stageVisibility)
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Pencil className="h-4 w-4" aria-hidden />}
      title={`Edit configuration · ${item.setting}`}
      description={
        <>
          {device.name} · {device.vendor} {device.ipAddress} · {item.category}
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {applied ? 'Close' : 'Cancel'}
          </Button>
          {!report ? (
            <Button
              variant="primary"
              onClick={runValidation}
              loading={running}
              disabled={!isDifferent}
              icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
            >
              Validate Configuration
            </Button>
          ) : applied ? (
            <Button variant="success" onClick={onClose} icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={runValidation} disabled={running}>
                Re-validate
              </Button>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={!report.valid}
                icon={<FlaskConical className="h-3.5 w-3.5" aria-hidden />}
              >
                Apply Change
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Current vs proposed */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
            <p className="eyebrow">Current value</p>
            <p className="mt-1 font-mono text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{item.value}</p>
          </div>
          <div className="hidden justify-center text-dimmer sm:flex" aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </div>
          <div
            className={cx(
              'rounded-lg border px-3 py-2.5',
              proposedCompliant
                ? 'border-emerald-500/40 bg-emerald-500/8'
                : 'border-amber-500/40 bg-amber-500/8',
            )}
          >
            <p className="eyebrow">Proposed value</p>
            <p
              className={cx(
                'mt-1 font-mono text-[13px] font-semibold',
                proposedCompliant
                  ? 'text-emerald-300 [html.light_&]:text-emerald-700'
                  : 'text-amber-300 [html.light_&]:text-amber-700',
              )}
            >
              {draft.length === 0 ? '—' : normaliseValue(item, draft)}
            </p>
          </div>
        </div>

        {/* Editor */}
        <div className="surface-2 space-y-3 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{item.label}</p>
            <SeverityBadge severity={item.severity} size="sm" />
            {!isDifferent ? <Badge tone="neutral">Unchanged</Badge> : null}
          </div>
          <p className="text-[12px] leading-relaxed text-dimmer">{item.description}</p>

          <Field
            label="New value"
            htmlFor="cybersure-new-value"
            error={!syntax.ok ? syntax.message : undefined}
            hint={
              syntax.ok
                ? `Recommended: ${item.recommended}${item.range ? ` (${item.range.min}–${item.range.max} ${item.range.unit})` : ''}`
                : undefined
            }
          >
            <ValueControl
              id="cybersure-new-value"
              item={item}
              value={draft}
              onChange={setDraft}
              invalid={!syntax.ok}
            />
          </Field>

          {item.complianceRefs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow">Baseline refs</span>
              {item.complianceRefs.map((ref) => (
                <Badge key={`${ref.framework}-${ref.control}`} tone="violet" title={ref.label}>
                  {ref.control}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Why it matters */}
        {!isValueCompliant(item, item.value) ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-red-300 [html.light_&]:text-red-700">Why this matters</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-200 [html.light_&]:text-ink-700">{item.finding.why}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-dimmer">
              <span className="font-semibold text-ink-300 [html.light_&]:text-ink-600">Recommended fix:</span>{' '}
              {item.finding.fix}
            </p>
          </div>
        ) : null}

        {/* Validation output */}
        {running || report ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <p className="eyebrow">Configuration validation</p>
              {running ? (
                <span className="text-[11.5px] text-accent-400">running checks…</span>
              ) : null}
            </div>
            {running ? <ProgressBar value={(stageVisibility / 4) * 100} label="Validation progress" /> : null}
            <ol className="space-y-1.5">
              {visibleStages.map(({ stage, index }) => (
                <StageRow key={stage.id} stage={stage} index={index} />
              ))}
              {running && stageVisibility === 0 ? (
                <li className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 text-[12px] text-dimmer [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                  Preparing validation pipeline…
                </li>
              ) : null}
            </ol>

            {report ? (
              <div
                className={cx(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
                  report.valid
                    ? 'border-emerald-500/40 bg-emerald-500/8'
                    : 'border-red-500/40 bg-red-500/8',
                )}
                role="status"
              >
                {report.valid ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
                )}
                <div className="min-w-0">
                  <p
                    className={cx(
                      'text-[13px] font-semibold',
                      report.valid
                        ? 'text-emerald-300 [html.light_&]:text-emerald-700'
                        : 'text-red-300 [html.light_&]:text-red-700',
                    )}
                  >
                    {report.valid ? 'Valid configuration' : 'Invalid configuration'}
                  </p>
                  {report.valid ? (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">
                      The proposed value is safe to apply against the {device.name} baseline.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {report.blocking.map((message) => (
                        <li key={message} className="text-[11.5px] leading-relaxed text-ink-200 [html.light_&]:text-ink-700">
                          • {message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {report.advisories.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {report.advisories.map((message) => (
                        <li key={message} className="text-[11.5px] leading-relaxed text-amber-300 [html.light_&]:text-amber-700">
                          ⚠ {message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {applied ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-200 [html.light_&]:text-amber-700">
            <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Change applied to the simulated configuration. No real device was contacted — the change is recorded in
            the configuration audit trail and the affected finding is now resolved.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 text-[11.5px] leading-relaxed text-dimmer [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Applying a change simulates the write locally. Nothing is pushed to {device.name}.
          </p>
        )}
      </div>
    </Modal>
  );
}
