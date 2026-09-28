import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  FileClock,
  Gauge,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useCyberSure } from '@/lib/store';
import { deviceComplianceStatus } from '@/lib/analysis';
import { cx, formatDateTime, relativeTime } from '@/utils/format';
import { Badge, DeviceStatusBadge, Dot, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ProgressBar, Tooltip } from '@/components/ui/Primitives';
import { VendorAvatar } from '@/components/common/Bits';
import { ScoreGauge, SeverityBar, toneForScore } from '@/components/common/Charts';
import { TopologyMap } from '@/components/common/TopologyMap';
import type { Severity } from '@/types';

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  to,
  trend,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone: 'neutral' | 'critical' | 'high' | 'medium' | 'ok' | 'info';
  to: string;
  trend?: string;
}) {
  const toneRing: Record<string, string> = {
    neutral: 'text-ink-200 border-ink-700 bg-ink-850',
    critical: 'text-red-400 border-red-500/30 bg-red-500/8',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/8',
    medium: 'text-amber-400 border-amber-500/30 bg-amber-500/8',
    ok: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/8',
    info: 'text-accent-400 border-accent-500/30 bg-accent-500/8',
  };
  const valueTone: Record<string, string> = {
    neutral: 'text-ink-50 [html.light_&]:text-ink-900',
    critical: 'text-red-400 [html.light_&]:text-red-600',
    high: 'text-orange-400 [html.light_&]:text-orange-600',
    medium: 'text-amber-400 [html.light_&]:text-amber-600',
    ok: 'text-emerald-400 [html.light_&]:text-emerald-600',
    info: 'text-accent-400 [html.light_&]:text-accent-600',
  };

  return (
    <Link
      to={to}
      className={cx(
        'surface group flex flex-col gap-3 p-3.5 transition-colors hover:border-accent-500/40 hover:bg-ink-850',
        '[html.light_&]:hover:bg-ink-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-lg border',
            toneRing[tone],
            '[html.light_&]:bg-white',
          )}
        >
          {icon}
        </span>
        <ArrowRight
          className="h-3.5 w-3.5 text-dimmer opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <p className={cx('metric mt-1.5', valueTone[tone])}>{value}</p>
        <p className="mt-1.5 text-[11.5px] text-dimmer">
          {trend ? <span className="font-medium text-ink-300 [html.light_&]:text-ink-600">{trend} </span> : null}
          {hint}
        </p>
      </div>
    </Link>
  );
}

export function OverviewPage() {
  const { devices, changes, analysis, lastScanAt, lastScanResult } = useCyberSure();
  const navigate = useNavigate();
  const [showAllFindings, setShowAllFindings] = useState(false);

  const openFindings = useMemo(
    () => analysis.findings.filter((finding) => finding.status === 'open'),
    [analysis.findings],
  );
  const criticalFindings = useMemo(
    () => openFindings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high'),
    [openFindings],
  );

  const compliantDevices = useMemo(
    () => devices.filter((device) => (analysis.securityStatusByDevice[device.id] ?? 'compliant') === 'compliant').length,
    [devices, analysis.securityStatusByDevice],
  );

  const onlineDevices = devices.filter((device) => device.status === 'online').length;
  const offlineIds = devices.filter((device) => device.status !== 'online').map((device) => device.id);

  const severityCounts: Record<Severity, number> = {
    critical: analysis.breakdown.critical,
    high: analysis.breakdown.high,
    medium: analysis.breakdown.medium,
    low: analysis.breakdown.low,
  };

  const postureTone = toneForScore(analysis.posture);
  const postureBarTone =
    postureTone === 'ok'
      ? 'ok'
      : postureTone === 'low'
        ? 'accent'
        : postureTone === 'medium'
          ? 'medium'
          : postureTone === 'high'
            ? 'high'
            : 'critical';

  const riskiestDevices = useMemo(
    () =>
      [...devices]
        .filter((device) => (analysis.securityStatusByDevice[device.id] ?? 'compliant') !== 'compliant')
        .sort((a, b) => (analysis.postureByDevice[a.id] ?? 0) - (analysis.postureByDevice[b.id] ?? 0))
        .slice(0, 5),
    [devices, analysis.securityStatusByDevice, analysis.postureByDevice],
  );

  const recentChanges = changes.slice(0, 6);
  const visibleFindings = showAllFindings ? criticalFindings : criticalFindings.slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
            Security overview
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-dimmer">
            <span>Network configuration &amp; compliance posture across the estate</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-right text-[11.5px] leading-relaxed text-dimmer">
            <span className="block">Last scan</span>
            <span className="font-medium text-ink-300 [html.light_&]:text-ink-600">
              {lastScanAt ? relativeTime(lastScanAt) : 'never'}
            </span>
          </p>
          <Button variant="secondary" size="md" onClick={() => navigate('/devices')}>
            <Network className="h-3.5 w-3.5" aria-hidden />
            Devices
          </Button>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Total devices"
          value={devices.length}
          hint={`${onlineDevices} online · ${devices.length - onlineDevices} offline`}
          icon={<Network className="h-4 w-4" aria-hidden />}
          tone="info"
          to="/devices"
        />
        <MetricCard
          label="Security issues"
          value={openFindings.length}
          trend={`${analysis.breakdown.resolved} resolved`}
          hint="open configuration findings"
          icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
          tone="high"
          to="/issues"
        />
        <MetricCard
          label="Critical"
          value={analysis.breakdown.critical}
          hint="highest risk severity"
          icon={<AlertOctagon className="h-4 w-4" aria-hidden />}
          tone="critical"
          to="/issues?severity=critical"
        />
        <MetricCard
          label="Compliant devices"
          value={compliantDevices}
          hint={`of ${devices.length} devices`}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          tone="ok"
          to="/compliance"
        />
        <MetricCard
          label="Changes"
          value={changes.length}
          hint="configuration changes recorded"
          icon={<FileClock className="h-4 w-4" aria-hidden />}
          tone="neutral"
          to="/changes"
        />
      </div>

      {/* Posture + severity + attention */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Security posture"
            description="Weighted by the severity of every open configuration finding."
            icon={<Gauge className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="flex flex-col items-center gap-4">
            <ScoreGauge
              score={analysis.posture}
              label="Security posture"
              caption="100 = no open findings"
            />
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-dimmer">Overall compliance</span>
                <span className="font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">
                  {analysis.compliance.overall}%
                </span>
              </div>
              <ProgressBar value={analysis.compliance.overall} tone={postureBarTone} label="Overall compliance" />
              <p className="text-[11px] leading-relaxed text-dimmer">
                Last scan {lastScanAt ? formatDateTime(lastScanAt) : '—'}
                {lastScanResult ? ` · posture ${lastScanResult.postureBefore} → ${lastScanResult.postureAfter}` : ''}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Open findings by severity"
            description={`${openFindings.length} open · ${analysis.breakdown.resolved} resolved in the audit trail`}
            icon={<Activity className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <SeverityBar counts={severityCounts} total={Math.max(1, openFindings.length)} />
            <div className="mt-4 space-y-2.5">
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => {
                const count = severityCounts[severity];
                const percent = openFindings.length > 0 ? (count / openFindings.length) * 100 : 0;
                return (
                  <Link
                    key={severity}
                    to={`/issues?severity=${severity}`}
                    className="flex items-center gap-3 rounded-lg border border-ink-700/60 px-2.5 py-2 transition-colors hover:border-accent-500/40 hover:bg-ink-850 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50"
                  >
                    <SeverityBadge severity={severity} size="sm" />
                    <ProgressBar
                      value={percent}
                      tone={
                        severity === 'critical'
                          ? 'critical'
                          : severity === 'high'
                            ? 'high'
                            : severity === 'medium'
                              ? 'medium'
                              : 'accent'
                      }
                      className="flex-1"
                      label={`${severity} share`}
                    />
                    <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Devices needing attention"
            description="Lowest posture score first."
            icon={<Wrench className="h-4 w-4" aria-hidden />}
            action={
              <Link to="/devices" className="text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600">
                View all
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {riskiestDevices.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="All checks passed"
                description="The current configuration has no detected issues."
              />
            ) : (
              riskiestDevices.map((device) => {
                const status = analysis.securityStatusByDevice[device.id] ?? 'compliant';
                const issueCount = (analysis.findingsByDevice[device.id] ?? []).filter(
                  (finding) => finding.status === 'open',
                ).length;
                return (
                  <Link
                    key={device.id}
                    to={`/devices/${device.id}?tab=configuration`}
                    className="flex items-center gap-3 rounded-lg border border-ink-700/60 px-2.5 py-2 transition-colors hover:border-accent-500/40 hover:bg-ink-850 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50"
                  >
                    <VendorAvatar vendor={device.vendor} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink-50 [html.light_&]:text-ink-900">
                        {device.name}
                      </span>
                      <span className="block truncate text-[11px] text-dimmer">
                        {device.ipAddress} · {issueCount} open finding{issueCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11.5px] font-semibold tabular-nums text-ink-200 [html.light_&]:text-ink-700">
                        {analysis.postureByDevice[device.id] ?? 0}
                      </span>
                      {status !== 'compliant' ? <SeverityBadge severity={status} size="sm" /> : null}
                    </span>
                  </Link>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      {/* Critical findings + topology */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Critical & high findings"
            description="Highest risk items requiring remediation."
            icon={<AlertOctagon className="h-4 w-4" aria-hidden />}
            action={
              <Link to="/issues" className="text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600">
                All issues
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {criticalFindings.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="All checks passed"
                description="The current configuration has no detected issues."
              />
            ) : (
              <>
                {visibleFindings.map((finding) => {
                  const device = devices.find((candidate) => candidate.id === finding.deviceId);
                  return (
                    <Link
                      key={finding.id}
                      to={`/issues?focus=${encodeURIComponent(finding.id)}`}
                      className="block rounded-lg border border-ink-700/60 px-3 py-2.5 transition-colors hover:border-accent-500/40 hover:bg-ink-850 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-[12.5px] font-medium text-ink-50 [html.light_&]:text-ink-900">
                          {finding.title}
                        </p>
                        <SeverityBadge severity={finding.severity} size="sm" />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-dimmer">
                        <span className="font-medium text-ink-300 [html.light_&]:text-ink-600">{device?.name}</span>
                        <span aria-hidden>·</span>
                        <span className="font-mono">
                          {finding.currentValue} → {finding.recommendedValue}
                        </span>
                        <Badge tone="neutral">{finding.issueCategory}</Badge>
                      </p>
                    </Link>
                  );
                })}
                {criticalFindings.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllFindings((value) => !value)}
                    className="w-full rounded-lg border border-dashed border-ink-600 py-2 text-[12px] font-medium text-dimmer transition-colors hover:border-accent-500/40 hover:text-ink-100 [html.light_&]:border-ink-300 [html.light_&]:hover:text-ink-900"
                  >
                    {showAllFindings
                      ? 'Show less'
                      : `Show ${criticalFindings.length - 4} more high-priority finding${criticalFindings.length - 4 === 1 ? '' : 's'}`}
                  </button>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader
            title="Network topology"
            description="Click any node to open its device configuration."
            icon={<Network className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="grid-noise p-2">
            <TopologyMap statusByDevice={analysis.securityStatusByDevice} offlineIds={offlineIds} />
          </CardBody>
        </Card>
      </div>

      {/* Recent changes + compliance snapshot */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent configuration changes"
            description="Audit trail — every applied change is validated first."
            icon={<FileClock className="h-4 w-4" aria-hidden />}
            action={
              <Link to="/changes" className="text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600">
                View all
              </Link>
            }
          />
          <CardBody className="space-y-1.5">
            {recentChanges.length === 0 ? (
              <EmptyState
                icon={<Radar className="h-5 w-5" />}
                title="No changes recorded"
                description="Apply a validated configuration change to start the audit trail."
              />
            ) : (
              recentChanges.map((change) => (
                <Link
                  key={change.id}
                  to={`/changes?focus=${change.id}`}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-ink-600 hover:bg-ink-850 [html.light_&]:hover:border-ink-100 [html.light_&]:hover:bg-ink-50"
                >
                  <span className="w-16 shrink-0 font-mono text-[11px] text-dimmer">{change.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-ink-100 [html.light_&]:text-ink-800">
                      <span className="font-medium">{change.deviceName}</span> · {change.setting}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-dimmer">
                      {change.oldValue} → {change.newValue}
                    </span>
                  </span>
                  <Badge
                    tone={change.changeStatus === 'applied' ? 'ok' : change.changeStatus === 'reverted' ? 'critical' : 'medium'}
                    className="shrink-0"
                  >
                    {change.changeStatus === 'applied' ? 'Applied' : change.changeStatus === 'reverted' ? 'Reverted' : 'Pending'}
                  </Badge>
                  <span className="hidden w-24 shrink-0 text-right text-[11px] text-dimmer sm:block">
                    {relativeTime(change.timestamp)}
                  </span>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Compliance snapshot"
            description="Mapping only — not a certification."
            icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
            action={
              <Link to="/compliance" className="text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600">
                Details
              </Link>
            }
          />
          <CardBody className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="metric">{analysis.compliance.overall}%</span>
              <span className="text-[11.5px] text-dimmer">overall compliance</span>
            </div>
            <ul className="space-y-2.5">
              {analysis.compliance.frameworks.map((framework) => {
                const meta = {
                  cis: { name: 'CIS Benchmarks', tone: 'bg-accent-500' },
                  iso27001: { name: 'ISO/IEC 27001', tone: 'bg-violet-500' },
                  nist: { name: 'NIST SP 800-53', tone: 'bg-teal-500' },
                }[framework.id];
                return (
                  <li key={framework.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-1.5 text-ink-200 [html.light_&]:text-ink-700">
                        <Dot tone={framework.id === 'cis' ? 'info' : framework.id === 'iso27001' ? 'violet' : 'ok'} />
                        {meta.name}
                      </span>
                      <span className="font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">
                        {framework.score}%
                      </span>
                    </div>
                    <ProgressBar value={framework.score} tone={postureBarTone} label={meta.name} />
                    <p className="text-[10.5px] text-dimmer">
                      {framework.passed} passed · {framework.failed} failed
                    </p>
                  </li>
                );
              })}
            </ul>
            <Tooltip content="CYBERSURE is a prototype. Framework mappings are illustrative and no certification is implied.">
              <p className="text-[10.5px] leading-relaxed text-dimmer underline decoration-dotted underline-offset-2">
                Sample mappings for demonstration only.
              </p>
            </Tooltip>
          </CardBody>
        </Card>
      </div>

      {/* Device summary strip */}
      <Card>
        <CardHeader
          title="Device estate"
          description="Compliance status derived from the failing controls on each device."
          icon={<Network className="h-4 w-4" aria-hidden />}
        />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => {
              const compliance = deviceComplianceStatus(device, analysis.findingsByDevice[device.id] ?? []);
              return (
                <Link
                  key={device.id}
                  to={`/devices/${device.id}`}
                  className="flex items-center gap-2.5 rounded-lg border border-ink-700/60 px-2.5 py-2 transition-colors hover:border-accent-500/40 hover:bg-ink-850 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50"
                >
                  <VendorAvatar vendor={device.vendor} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink-50 [html.light_&]:text-ink-900">
                      {device.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-dimmer">
                      {device.vendor} · {device.ipAddress}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <DeviceStatusBadge status={device.status} />
                    <span className="text-[10px] capitalize text-dimmer">{compliance}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
