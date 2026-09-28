import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Info, ShieldCheck, Wrench } from 'lucide-react';
import { useCyberSure } from '@/lib/store';
import { COMPLIANCE_CHECKS, FRAMEWORK_META } from '@/data/complianceChecks';
import { cx } from '@/utils/format';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, Tooltip } from '@/components/ui/Primitives';
import { MiniBar, toneForScore } from '@/components/common/Charts';
import { EditSettingModal } from '@/components/config/EditSettingModal';
import type { ConfigItem } from '@/types';
import { useNotify } from '@/components/ui/Toast';

const TONE_BAR: Record<string, string> = {
  ok: 'bg-emerald-500',
  low: 'bg-accent-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function CompliancePage() {
  const { analysis, devices, applyChange } = useCyberSure();
  const navigate = useNavigate();
  const notify = useNotify();
  const [onlyFailing, setOnlyFailing] = useState(true);
  const [editTarget, setEditTarget] = useState<{ item: ConfigItem; deviceId: string } | null>(null);

  const rows = useMemo(() => {
    return analysis.compliance.results
      .filter((result) => result.status !== 'na')
      .map((result) => ({
        result,
        check: COMPLIANCE_CHECKS.find((check) => check.id === result.checkId)!,
        device: devices.find((device) => device.id === result.deviceId),
      }))
      .filter((row) => (onlyFailing ? row.result.status === 'fail' : true))
      .sort((a, b) => {
        if (a.result.status !== b.result.status) return a.result.status === 'fail' ? -1 : 1;
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.result.severity) - order.indexOf(b.result.severity);
      });
  }, [analysis.compliance.results, devices, onlyFailing]);

  const failingCount = analysis.compliance.results.filter((result) => result.status === 'fail').length;
  const overallTone = toneForScore(analysis.compliance.overall);

  const handleFix = (deviceId: string, configItemId: string) => {
    const item = analysis.itemsByDevice[deviceId]?.find((candidate) => candidate.id === configItemId);
    if (!item) {
      notify.error('Setting not found', 'The failing control does not map to an editable setting on this device.');
      return;
    }
    setEditTarget({ item, deviceId });
  };

  const handleApply = ({ newValue }: { newValue: string }) => {
    if (!editTarget) return;
    const change = applyChange({
      deviceId: editTarget.deviceId,
      configItemId: editTarget.item.id,
      newValue,
      source: 'remediation',
      note: `Remediation of a failing compliance control (${editTarget.item.finding.reference}).`,
    });
    if (!change) {
      notify.warning('No change recorded', 'The proposed value matches the current configuration.');
      return;
    }
    notify.success(
      'Configuration change applied',
      `${change.deviceName} · ${change.setting}: ${change.oldValue} → ${change.newValue} (${change.id}).`,
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">Compliance</h1>
          <p className="mt-1 text-[12.5px] text-dimmer">
            Control mapping across the estate. CYBERSURE is not certified against any framework.
          </p>
        </div>
        <Tooltip content="CYBERSURE is a prototype. Framework mappings are illustrative and imply no certification.">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300 [html.light_&]:border-amber-200 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-700">
            <Info className="h-3 w-3" aria-hidden />
            Mapping only
          </span>
        </Tooltip>
      </header>

      {/* Overall + frameworks */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader title="Overall compliance" description="Weighted control pass rate." icon={<ShieldCheck className="h-4 w-4" aria-hidden />} />
          <CardBody>
            <p
              className={cx(
                'metric text-[38px]',
                overallTone === 'ok'
                  ? 'text-emerald-400 [html.light_&]:text-emerald-600'
                  : overallTone === 'low'
                    ? 'text-accent-400 [html.light_&]:text-accent-600'
                    : overallTone === 'medium'
                      ? 'text-amber-400 [html.light_&]:text-amber-600'
                      : overallTone === 'high'
                        ? 'text-orange-400 [html.light_&]:text-orange-600'
                        : 'text-red-400 [html.light_&]:text-red-600',
              )}
            >
              {analysis.compliance.overall}%
            </p>
            <MiniBar
              value={analysis.compliance.overall}
              tone={
                overallTone === 'ok'
                  ? TONE_BAR.ok
                  : overallTone === 'low'
                    ? TONE_BAR.low
                    : overallTone === 'medium'
                      ? TONE_BAR.medium
                      : overallTone === 'high'
                        ? TONE_BAR.high
                        : TONE_BAR.critical
              }
            />
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-dimmer">
              {failingCount} failing control{failingCount === 1 ? '' : 's'} out of{' '}
              {analysis.compliance.results.filter((result) => result.status !== 'na').length} applicable across{' '}
              {devices.length} devices.
            </p>
          </CardBody>
        </Card>

        {analysis.compliance.frameworks.map((framework) => {
          const meta = FRAMEWORK_META[framework.id];
          const tone = toneForScore(framework.score);
          return (
            <Card key={framework.id}>
              <CardHeader title={meta.name} description={meta.description} />
              <CardBody>
                <p className="flex items-baseline gap-1.5">
                  <span
                    className={cx(
                      'metric text-[30px]',
                      tone === 'ok'
                        ? 'text-emerald-400 [html.light_&]:text-emerald-600'
                        : tone === 'low'
                          ? 'text-accent-400 [html.light_&]:text-accent-600'
                          : tone === 'medium'
                            ? 'text-amber-400 [html.light_&]:text-amber-600'
                            : tone === 'high'
                              ? 'text-orange-400 [html.light_&]:text-orange-600'
                              : 'text-red-400 [html.light_&]:text-red-600',
                    )}
                  >
                    {framework.score}%
                  </span>
                </p>
                <MiniBar
                  value={framework.score}
                  tone={
                    tone === 'ok'
                      ? TONE_BAR.ok
                      : tone === 'low'
                        ? TONE_BAR.low
                        : tone === 'medium'
                          ? TONE_BAR.medium
                          : tone === 'high'
                            ? TONE_BAR.high
                            : TONE_BAR.critical
                  }
                />
                <dl className="mt-3 space-y-1 text-[11.5px]">
                  <div className="flex items-center justify-between">
                    <dt className="text-dimmer">Passed</dt>
                    <dd className="font-semibold tabular-nums text-emerald-400 [html.light_&]:text-emerald-600">
                      {framework.passed}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-dimmer">Failed</dt>
                    <dd className="font-semibold tabular-nums text-red-400 [html.light_&]:text-red-600">{framework.failed}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-dimmer">Not applicable</dt>
                    <dd className="font-semibold tabular-nums text-ink-300 [html.light_&]:text-ink-600">{framework.na}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Compliance checks */}
      <Card>
        <CardHeader
          title="Compliance checks"
          description="Each control is evaluated against the collected configuration on every device."
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          action={
            <div className="flex items-center gap-2">
              <Badge tone={onlyFailing ? 'critical' : 'neutral'}>
                {onlyFailing ? 'Failing only' : 'All controls'}
              </Badge>
              <Button variant="secondary" size="sm" onClick={() => setOnlyFailing((value) => !value)}>
                {onlyFailing ? 'Show all' : 'Show failures'}
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-2.5">
          {rows.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="All checks passed"
              description="The current configuration has no detected compliance issues."
            />
          ) : (
            rows.map(({ result, check, device }) => {
              const passing = result.status === 'pass';
              const finding = analysis.findings.find((candidate) => candidate.id === result.findingId);
              return (
                <article
                  key={`${result.checkId}-${result.deviceId}`}
                  className={cx(
                    'rounded-lg border px-3.5 py-3',
                    passing
                      ? 'border-ink-700/60 [html.light_&]:border-ink-100'
                      : 'border-red-500/30 bg-red-500/[0.04]',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {passing ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{check.name}</p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">{check.requirement}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {check.frameworks.map((framework) => (
                        <Badge key={framework} tone="violet">
                          {FRAMEWORK_META[framework].short}
                        </Badge>
                      ))}
                      {passing ? (
                        <Badge tone="ok">Pass</Badge>
                      ) : (
                        <SeverityBadge severity={result.severity} size="sm" />
                      )}
                    </div>
                  </div>

                  <dl className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="eyebrow">Device</dt>
                      <dd className="mt-0.5 text-[12px] text-ink-200 [html.light_&]:text-ink-700">
                        {device ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/devices/${device.id}`)}
                            className="font-medium hover:text-accent-400 hover:underline [html.light_&]:hover:text-accent-600"
                          >
                            {device.name}
                          </button>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Current state</dt>
                      <dd
                        className={cx(
                          'mt-0.5 font-mono text-[11.5px]',
                          passing ? 'text-ink-200 [html.light_&]:text-ink-700' : 'text-red-300 [html.light_&]:text-red-600',
                        )}
                      >
                        {result.currentState}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Expected state</dt>
                      <dd className="mt-0.5 font-mono text-[11.5px] text-emerald-300 [html.light_&]:text-emerald-600">
                        {check.expectedState}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Control</dt>
                      <dd className="mt-0.5 text-[11.5px] text-dimmer">{check.id}</dd>
                    </div>
                  </dl>

                  {!passing ? (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/50 pt-2.5 [html.light_&]:border-ink-100">
                      <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-dim">
                        <span className="font-semibold text-ink-200 [html.light_&]:text-ink-700">
                          Recommended correction:
                        </span>{' '}
                        {check.remediation}
                      </p>
                      {finding ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleFix(finding.deviceId, finding.configItemId)}
                          icon={<Wrench className="h-3.5 w-3.5" aria-hidden />}
                        >
                          Review &amp; fix
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </CardBody>
      </Card>

      <p className="text-[11px] leading-relaxed text-dimmer">
        Framework names are used only to illustrate how CYBERSURE maps configuration findings to control catalogues.
        CYBERSURE makes no certification claim and holds no accreditation.
      </p>

      {editTarget ? (
        <EditSettingModal
          device={devices.find((device) => device.id === editTarget.deviceId)!}
          item={editTarget.item}
          open
          onClose={() => setEditTarget(null)}
          onApply={handleApply}
        />
      ) : null}
    </div>
  );
}
