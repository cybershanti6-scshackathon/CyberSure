import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileClock,
  Gauge,
  History,
  Radar,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { ConfigItem } from '@/types';
import { useCyberSure } from '@/lib/store';
import { deviceComplianceStatus } from '@/lib/analysis';
import { validateDevice } from '@/lib/validation';
import { CHECK_BY_ID } from '@/data/complianceChecks';
import { cx, DEVICE_TYPE_LABEL, formatDateTime, relativeTime } from '@/utils/format';
import { ComplianceStatusBadge, DeviceStatusBadge, SecurityStatusBadge, SeverityBadge } from '@/components/ui/Badge';import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, KeyValue, ProgressBar, TabPanel, Tabs, Tooltip } from '@/components/ui/Primitives';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { VendorAvatar } from '@/components/common/Bits';
import { ConfigSectionList } from '@/components/config/ConfigSectionList';
import { EditSettingModal } from '@/components/config/EditSettingModal';
import { FindingCard } from '@/components/issues/FindingCard';
import { ChangeTable } from '@/components/changes/ChangeTable';
import { useNotify } from '@/components/ui/Toast';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <Gauge className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'configuration', label: 'Configuration', icon: <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'issues', label: 'Security Issues', icon: <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'compliance', label: 'Compliance', icon: <ClipboardList className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'changes', label: 'Change History', icon: <History className="h-3.5 w-3.5" aria-hidden /> },
];

export function DeviceDetailPage() {
  const { deviceId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const { devices, analysis, changes, applyChange, removeDevice, runScan, scanRunning } = useCyberSure();

  const device = devices.find((candidate) => candidate.id === deviceId);
  const [editItem, setEditItem] = useState<ConfigItem | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [validationReport, setValidationReport] = useState<ReturnType<typeof validateDevice> | null>(null);

  const tabParam = searchParams.get('tab');
  const fixParam = searchParams.get('fix');
  const focusParam = searchParams.get('focus');
  const activeTab = TABS.some((tab) => tab.id === tabParam) ? (tabParam as string) : 'overview';

  const findings = useMemo(
    () => (device ? (analysis.findingsByDevice[device.id] ?? []) : []),
    [analysis.findingsByDevice, device],
  );
  const openFindings = findings.filter((finding) => finding.status === 'open');
  const deviceChanges = changes.filter((change) => change.deviceId === deviceId);
  const items = device ? (analysis.itemsByDevice[device.id] ?? []) : [];

  // Deep link: /devices/:id?tab=configuration&fix=<configItemId> opens the editor.
  useEffect(() => {
    if (!device || !fixParam) return;
    const target = items.find((item) => item.id === fixParam);
    if (target) {
      if (tabParam !== 'configuration') {
        setSearchParams({ tab: 'configuration', fix: fixParam }, { replace: true });
        return;
      }
      setEditItem(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, fixParam, items, tabParam]);

  const clearFix = useCallback(() => {
    setEditItem(null);
    if (fixParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('fix');
      setSearchParams(next, { replace: true });
    }
  }, [fixParam, searchParams, setSearchParams]);

  const setTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.delete('fix');
    setSearchParams(next, { replace: true });
  };

  if (!device) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="neutral"
          title="Device not found"
          description="This device is not part of the current inventory. It may have been removed or the data reset."
          action={
            <Button variant="primary" onClick={() => navigate('/devices')}>
              Back to device inventory
            </Button>
          }
        />
      </Card>
    );
  }

  const securityStatus = analysis.securityStatusByDevice[device.id] ?? 'compliant';
  const posture = analysis.postureByDevice[device.id] ?? 0;
  const compliance = deviceComplianceStatus(device, findings);
  const deviceComplianceChecks = analysis.compliance.results.filter(
    (result) => result.deviceId === device.id && result.status !== 'na',
  );
  const deviceComplianceScore =
    deviceComplianceChecks.length > 0
      ? Math.round(
          (deviceComplianceChecks.filter((result) => result.status === 'pass').length / deviceComplianceChecks.length) * 100,
        )
      : 0;

  const handleApply = ({ newValue }: { newValue: string; note?: string }) => {
    const change = applyChange({
      deviceId: device.id,
      configItemId: editItem!.id,
      newValue,
      source: 'remediation',
      note: `Remediation of ${editItem!.finding.reference}.`,
    });
    if (!change) {
      notify.warning('No change recorded', 'The proposed value matches the current configuration.');
      return;
    }
    const wasFinding = openFindings.some((finding) => finding.configItemId === editItem!.id);
    notify.success(
      'Configuration change applied',
      wasFinding
        ? `${change.setting}: ${change.oldValue} → ${change.newValue}. The related security finding is now resolved and ${change.id} was recorded.`
        : `${change.setting}: ${change.oldValue} → ${change.newValue}. Recorded as ${change.id}.`,
    );
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-dimmer" aria-label="Breadcrumb">
        <Link to="/devices" className="inline-flex items-center gap-1 hover:text-accent-400 [html.light_&]:hover:text-accent-600">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Network devices
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink-200 [html.light_&]:text-ink-700">{device.name}</span>
      </nav>

      {/* Header */}
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <VendorAvatar vendor={device.vendor} size={46} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
                  {device.name}
                </h1>
                <DeviceStatusBadge status={device.status} />
                <SecurityStatusBadge status={securityStatus} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-dimmer">
                <span>{device.vendor}</span>
                <span aria-hidden>·</span>
                <span>{DEVICE_TYPE_LABEL[device.type]}</span>
                <span aria-hidden>·</span>
                <span className="font-mono">{device.ipAddress}</span>
                <span aria-hidden>·</span>
                <span>{device.model}</span>
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] text-dimmer">
                  {openFindings.length} open finding{openFindings.length === 1 ? '' : 's'} · posture {posture}/100
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              loading={scanRunning}
              onClick={() => {
                void runScan().then((result) =>
                  notify.success(
                    'Scan complete',
                    `${device.name} re-analysed · ${result.unresolvedFindings} open findings across ${result.devicesScanned} devices.`,
                  ),
                );
              }}
              icon={<Radar className="h-3.5 w-3.5" aria-hidden />}
            >
              Run Security Scan
            </Button>
            <Button
              variant="primary"
              onClick={() => setTab('configuration')}
              icon={<Wrench className="h-3.5 w-3.5" aria-hidden />}
            >
              View Configuration
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs
          ariaLabel="Device sections"
          active={activeTab}
          onChange={setTab}
          tabs={TABS.map((tab) => ({
            ...tab,
            count:
              tab.id === 'issues'
                ? openFindings.length
                : tab.id === 'changes'
                  ? deviceChanges.length
                  : tab.id === 'configuration'
                    ? items.length
                    : undefined,
            tone: tab.id === 'issues' && openFindings.length > 0 ? 'high' : 'neutral',
          }))}
        />

        <div className="p-4">
          <TabPanel active={activeTab === 'overview'}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title="Device information" description="Identities and lifecycle state for this asset." />
                <CardBody>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <dl>
                      <KeyValue label="Device name" value={device.name} />
                      <KeyValue label="Vendor" value={device.vendor} />
                      <KeyValue label="Device type" value={DEVICE_TYPE_LABEL[device.type]} />
                      <KeyValue label="Model" value={device.model} />
                      <KeyValue label="IP address" value={device.ipAddress} mono />
                      <KeyValue label="Serial" value={device.serial} mono />
                    </dl>
                    <dl>
                      <KeyValue label="OS / firmware" value={device.config.osVersion} mono />
                      <KeyValue label="Configuration version" value={device.config.configVersion} mono />
                      <KeyValue label="Collected via" value={device.config.collectedVia} />
                      <KeyValue label="Site" value={device.site} />
                      <KeyValue label="Environment" value={device.environment} />
                      <KeyValue
                        label="Last scan"
                        value={
                          <Tooltip content={formatDateTime(device.lastScan)}>
                            <span>{relativeTime(device.lastScan)}</span>
                          </Tooltip>
                        }
                      />
                    </dl>
                  </div>
                  <p className="mt-3 rounded-lg border border-ink-700/60 bg-ink-850 px-3 py-2 text-[11.5px] leading-relaxed text-dimmer [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                    Status and findings shown here are derived from the collected sample configuration. CYBERSURE is not
                    connected to this device.
                  </p>
                </CardBody>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader title="Security posture" />
                  <CardBody className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="metric">{posture}</span>
                      <span className="text-[11.5px] text-dimmer">/ 100</span>
                    </div>
                    <ProgressBar
                      value={posture}
                      tone={posture >= 90 ? 'ok' : posture >= 70 ? 'medium' : 'critical'}
                      label="Device posture"
                    />
                    <div className="space-y-1.5">
                      {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                        const count = openFindings.filter((finding) => finding.severity === severity).length;
                        return (
                          <div key={severity} className="flex items-center justify-between gap-2">
                            <SeverityBadge severity={severity} size="sm" />
                            <span className="text-[12px] font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Compliance" />
                  <CardBody className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <ComplianceStatusBadge status={compliance} />
                      <span className="text-[12px] font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">
                        {deviceComplianceScore}%
                      </span>
                    </div>
                    <ProgressBar value={deviceComplianceScore} tone={deviceComplianceScore >= 90 ? 'ok' : 'medium'} />
                    <p className="text-[11.5px] text-dimmer">
                      {deviceComplianceChecks.filter((r) => r.status === 'fail').length} failing of{' '}
                      {deviceComplianceChecks.length} applicable controls.
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setTab('compliance')} className="w-full">
                      View compliance checks
                    </Button>
                  </CardBody>
                </Card>

                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={() => setConfirmRemove(true)}
                  icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                >
                  Remove device
                </Button>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'configuration'}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-850 px-3.5 py-3 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                <p className="text-[12.5px] text-dim">
                  <span className="font-medium text-ink-100 [html.light_&]:text-ink-800">{items.length} settings</span> across{' '}
                  {new Set(items.map((item) => item.category)).size} categories ·{' '}
                  {openFindings.length} deviation{openFindings.length === 1 ? '' : 's'} from the CYBERSURE baseline
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const report = validateDevice(device);
                    setValidationReport(report);
                    if (report.valid) {
                      notify.success('Configuration valid', `${device.name} matches every baseline.`);
                    } else {
                      notify.warning(
                        'Configuration deviations found',
                        `${report.violations} setting(s) deviate from the baseline on ${device.name}.`,
                      );
                    }
                  }}
                  icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
                >
                  Validate full configuration
                </Button>
              </div>

              {validationReport ? (
                <Card>
                  <CardHeader
                    title="Configuration validation result"
                    description={`Checked ${formatDateTime(validationReport.checkedAt)} · ${validationReport.violations} deviation(s)`}
                    icon={validationReport.valid ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <ShieldAlert className="h-4 w-4" aria-hidden />}
                    action={
                      <Button variant="ghost" size="sm" onClick={() => setValidationReport(null)}>
                        Dismiss
                      </Button>
                    }
                  />
                  <CardBody>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {validationReport.checks.map((check) => (
                        <li
                          key={check.label}
                          className={cx(
                            'rounded-lg border px-3 py-2',
                            check.status === 'pass'
                              ? 'border-emerald-500/30 bg-emerald-500/8'
                              : check.status === 'warn'
                                ? 'border-amber-500/30 bg-amber-500/8'
                                : 'border-red-500/30 bg-red-500/8',
                          )}
                        >
                          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-100 [html.light_&]:text-ink-800">
                            {check.status === 'pass' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                            ) : check.status === 'warn' ? (
                              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5 text-red-500" aria-hidden />
                            )}
                            {check.label}
                          </p>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">{check.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ) : null}

              <ConfigSectionList
                device={device}
                items={items}
                findings={findings}
                onEdit={setEditItem}
                highlightId={focusParam}
              />
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'issues'}>
            {openFindings.length === 0 && findings.filter((f) => f.status === 'resolved').length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="All checks passed"
                description="The current configuration has no detected issues."
              />
            ) : (
              <div className="space-y-3">
                {openFindings.length > 0 ? (
                  <>
                    <p className="eyebrow">Open findings ({openFindings.length})</p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {openFindings.map((finding) => (
                        <FindingCard
                          key={finding.id}
                          finding={finding}
                          device={device}
                          onFix={(configItemId) => {
                            const target = items.find((item) => item.id === configItemId);
                            if (target) setEditItem(target);
                          }}
                          highlighted={focusParam === finding.configItemId}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="All checks passed"
                    description="The current configuration has no detected issues."
                  />
                )}

                {findings.filter((finding) => finding.status === 'resolved').length > 0 ? (
                  <>
                    <p className="eyebrow pt-2">
                      Resolved in the audit trail ({findings.filter((f) => f.status === 'resolved').length})
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {findings
                        .filter((finding) => finding.status === 'resolved')
                        .map((finding) => (
                          <FindingCard key={finding.id} finding={finding} device={device} />
                        ))}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </TabPanel>

          <TabPanel active={activeTab === 'compliance'}>
            <DeviceCompliancePanel
              deviceId={device.id}
              deviceName={device.name}
              checks={deviceComplianceChecks}
              onFix={(configItemId) => {
                const target = items.find((item) => item.id === configItemId);
                if (target) setEditItem(target);
              }}
            />
          </TabPanel>

          <TabPanel active={activeTab === 'changes'}>
            <ChangeTable changes={deviceChanges} emptyLabel={`No configuration changes recorded for ${device.name} yet.`} />
          </TabPanel>
        </div>
      </Card>

      <EditSettingModal
        device={device}
        item={editItem}
        open={Boolean(editItem)}
        onClose={clearFix}
        onApply={handleApply}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove device"
        tone="danger"
        confirmLabel="Remove device"
        message={
          <>
            This removes <span className="font-semibold">{device.name}</span> and its {deviceChanges.length} change
            record(s) from the local prototype state. Use Settings → Reset Data to restore the full estate.
          </>
        }
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          removeDevice(device.id);
          notify.info('Device removed', `${device.name} was removed from the local inventory.`);
          navigate('/devices');
        }}
      />

      <p className="flex items-center gap-1.5 text-[11px] text-dimmer">
        <FileClock className="h-3 w-3" aria-hidden />
        Configuration changes on this page are simulated locally and recorded in the audit trail.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Device compliance panel                                                    */
/* -------------------------------------------------------------------------- */

function DeviceCompliancePanel({
  deviceId,
  deviceName,
  checks,
  onFix,
}: {
  deviceId: string;
  deviceName: string;
  checks: ReturnType<typeof useCyberSure>['analysis']['compliance']['results'];
  onFix: (configItemId: string) => void;
}) {
  const { analysis } = useCyberSure();
  const failed = checks.filter((check) => check.status === 'fail');
  const passed = checks.filter((check) => check.status === 'pass');

  if (checks.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        tone="neutral"
        title="No applicable controls"
        description="None of the compliance controls apply to this device type."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: 'Failing controls', value: failed.length, tone: 'critical' as const },
          { label: 'Passing controls', value: passed.length, tone: 'ok' as const },
          {
            label: 'Compliance score',
            value: Math.round((passed.length / checks.length) * 100),
            tone: 'info' as const,
            suffix: '%',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-ink-700/60 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
          >
            <p className="eyebrow">{stat.label}</p>
            <p
              className={cx(
                'mt-1 text-[20px] font-semibold leading-none tabular-nums',
                stat.tone === 'critical'
                  ? 'text-red-400 [html.light_&]:text-red-600'
                  : stat.tone === 'ok'
                    ? 'text-emerald-400 [html.light_&]:text-emerald-600'
                    : 'text-accent-400 [html.light_&]:text-accent-600',
              )}
            >
              {stat.value}
              {stat.suffix ?? ''}
            </p>
          </div>
        ))}
      </div>

      {failed.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="All checks passed"
          description={`${deviceName} satisfies every applicable compliance control.`}
        />
      ) : (
        <div className="space-y-2">
          <p className="eyebrow">Failing controls</p>
          {failed.map((result) => {
            const control = CHECK_BY_ID[result.checkId];
            const finding = analysis.findings.find((candidate) => candidate.id === result.findingId);
            return (
              <div
                key={`${result.checkId}-${result.deviceId}`}
                className="rounded-lg border border-red-500/25 bg-red-500/[0.04] px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                      {control?.name ?? 'Compliance control failed'}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">
                      Current: <span className="font-mono">{result.currentState}</span> · Expected:{' '}
                      {control?.expectedState ?? 'baseline value'}
                    </p>
                  </div>
                  <SeverityBadge severity={result.severity} size="sm" />
                </div>
                {finding ? (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300 [html.light_&]:text-ink-600">
                    {finding.fix}
                  </p>
                ) : null}
                {finding ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => onFix(finding.configItemId)}
                    icon={<Wrench className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Review &amp; fix
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <details className="surface-2 px-3.5 py-2.5">
        <summary className="cursor-pointer text-[12.5px] font-medium text-ink-200 [html.light_&]:text-ink-700">
          Show {passed.length} passing control{passed.length === 1 ? '' : 's'}
        </summary>
        <ul className="mt-2.5 space-y-1.5">
          {passed.map((result) => (
            <li key={`${result.checkId}-${result.deviceId}`} className="flex items-start gap-2 text-[12px]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
              <span className="text-ink-200 [html.light_&]:text-ink-700">
                {result.currentState}
                <span className="ml-1.5 text-[10.5px] text-dimmer">{result.checkId}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-[11px] text-dimmer">
        {deviceId} · sample compliance mapping for the prototype only.
      </p>
    </div>
  );
}
