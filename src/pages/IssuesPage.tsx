import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bot, CheckCircle2, Filter, ScanLine, ShieldAlert, Wrench, X } from 'lucide-react';
import type { ConfigItem, Finding, IssueCategory, Severity } from '@/types';
import { useCyberSure } from '@/lib/store';
import { cx, relativeTime } from '@/utils/format';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Form';
import { EmptyState, Tooltip } from '@/components/ui/Primitives';
import { FindingCard } from '@/components/issues/FindingCard';
import { EditSettingModal } from '@/components/config/EditSettingModal';
import { FilterSelect, SearchField } from '@/components/devices/AddDeviceModal';
import { useNotify } from '@/components/ui/Toast';

const ISSUE_CATEGORIES: IssueCategory[] = [
  'Access Control',
  'Authentication',
  'Network Services',
  'Firewall',
  'Logging',
  'Encryption',
  'Configuration',
];

/** Phases shown while the security analysis is running. */
const ANALYSIS_PHASES = [
  'Scanning configuration…',
  'Checking access controls…',
  'Checking network services…',
  'Checking authentication…',
  'Checking firewall policies…',
  'Checking logging…',
  'Checking compliance…',
];

type SeverityFilter = Severity | 'all';
type StatusFilter = 'open' | 'resolved' | 'all';

export function IssuesPage() {
  const { analysis, devices, applyChange, runScan, scanRunning, scanPhase, lastScanAt } = useCyberSure();
  const navigate = useNavigate();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>(
    (searchParams.get('severity') as SeverityFilter) ?? 'all',
  );
  const [status, setStatus] = useState<StatusFilter>('all');
  const [deviceId, setDeviceId] = useState<string>('all');
  const [category, setCategory] = useState<IssueCategory | 'all'>('all');
  const [editTarget, setEditTarget] = useState<{ finding: Finding; item: ConfigItem } | null>(null);

  const focusId = searchParams.get('focus');

  const openFindings = useMemo(
    () => analysis.findings.filter((finding) => finding.status === 'open'),
    [analysis.findings],
  );

  // Deep link from search / notifications: ?focus=<findingId>
  useEffect(() => {
    if (!focusId) return;
    const finding = analysis.findings.find((candidate) => candidate.id === focusId);
    if (!finding) return;
    setQuery('');
    setSeverity('all');
    setStatus(finding.status);
    setDeviceId(finding.deviceId);
    setCategory('all');
    const next = new URLSearchParams(searchParams);
    next.set('focus', focusId);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, analysis.findings]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return analysis.findings.filter((finding) => {
      if (status !== 'all' && finding.status !== status) return false;
      if (severity !== 'all' && finding.severity !== severity) return false;
      if (deviceId !== 'all' && finding.deviceId !== deviceId) return false;
      if (category !== 'all' && finding.issueCategory !== category) return false;
      if (needle.length > 0) {
        const device = devices.find((candidate) => candidate.id === finding.deviceId);
        const haystack =
          `${finding.title} ${finding.description} ${finding.issueCategory} ${finding.currentValue} ${finding.recommendedValue} ${finding.why} ${device?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [analysis.findings, query, severity, status, deviceId, category, devices]);

  const activeFilters = [
    severity !== 'all' ? `Severity: ${severity}` : null,
    status !== 'all' ? `Status: ${status}` : null,
    deviceId !== 'all' ? `Device: ${devices.find((d) => d.id === deviceId)?.name ?? ''}` : null,
    category !== 'all' ? `Category: ${category}` : null,
  ].filter(Boolean) as string[];

  const clearFilters = () => {
    setQuery('');
    setSeverity('all');
    setStatus('all');
    setDeviceId('all');
    setCategory('all');
    const next = new URLSearchParams(searchParams);
    next.delete('severity');
    next.delete('focus');
    setSearchParams(next, { replace: true });
  };

  const handleFix = (finding: Finding) => {
    const device = devices.find((candidate) => candidate.id === finding.deviceId);
    const item = analysis.itemsByDevice[finding.deviceId]?.find((candidate) => candidate.id === finding.configItemId);
    if (!device || !item) {
      notify.error('Setting not found', 'This configuration setting is no longer available on the device.');
      return;
    }
    setEditTarget({ finding, item });
  };

  const handleApply = ({ newValue }: { newValue: string; note?: string }) => {
    if (!editTarget) return;
    const change = applyChange({
      deviceId: editTarget.finding.deviceId,
      configItemId: editTarget.item.id,
      newValue,
      source: 'remediation',
      note: `Remediation of ${editTarget.item.finding.reference} from the security analysis register.`,
    });
    if (!change) {
      notify.warning('No change recorded', 'The proposed value matches the current configuration.');
      return;
    }
    notify.success(
      'Security issue resolved',
      `${change.deviceName} · ${change.setting}: ${change.oldValue} → ${change.newValue}. Recorded as ${change.id}.`,
    );
  };

  const handleRunAnalysis = () => {
    void runScan().then((result) => {
      notify.success(
        'Security analysis complete',
        `${result.devicesScanned} devices analysed · ${result.unresolvedFindings} open findings · posture ${result.postureAfter}/100.`,
      );
    });
  };

  const grouped = useMemo(() => {
    const order: Severity[] = ['critical', 'high', 'medium', 'low'];
    const map = new Map<Severity, Finding[]>();
    for (const severityKey of order) {
      const list = filtered.filter((finding) => finding.severity === severityKey);
      if (list.length > 0) map.set(severityKey, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
            Security Analysis
          </h1>
          <p className="mt-1 text-[12.5px] text-dimmer">
            Analyze a device or configuration, review every finding and remediate it through a validated change. ·{' '}
            {openFindings.length} open configuration findings · {analysis.breakdown.resolved} resolved in the audit trail
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/assistant?context=${deviceId === 'all' ? 'posture' : 'device'}${deviceId === 'all' ? '' : `&device=${deviceId}`}`)}
            icon={<Bot className="h-3.5 w-3.5" aria-hidden />}
          >
            Ask Assistant
          </Button>
          <Button variant="secondary" onClick={() => navigate('/compliance')} icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}>
            Compliance view
          </Button>
        </div>
      </header>

      {/* Analysis target panel */}
      <Card>
        <CardHeader
          title="Analysis target"
          description="Choose which device and which configuration snapshot to analyse."
          icon={<ScanLine className="h-4 w-4" aria-hidden />}
          action={<Badge tone="info">Local rule engine</Badge>}
        />
        <CardBody className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Select device" htmlFor="analysis-device">
              <Select
                id="analysis-device"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                options={[
                  { value: 'all', label: 'All devices' },
                  ...devices.map((device) => ({ value: device.id, label: device.name })),
                ]}
              />
            </Field>
            <Field label="Select configuration" htmlFor="analysis-config">
              <Select
                id="analysis-config"
                value={deviceId === 'all' ? 'live' : deviceId}
                disabled
                options={[
                  {
                    value: 'live',
                    label: deviceId === 'all' ? `${devices.length} running configurations` : 'Running configuration',
                  },
                ]}
              />
            </Field>
            <div className="flex items-end">
              <Button
                variant="primary"
                className="w-full"
                loading={scanRunning}
                onClick={handleRunAnalysis}
                icon={<ScanLine className="h-3.5 w-3.5" aria-hidden />}
              >
                Run Security Analysis
              </Button>
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                <p className="eyebrow">Last analysis</p>
                <p className="mt-1 text-[12px] text-ink-200 [html.light_&]:text-ink-800">
                  {lastScanAt ? relativeTime(lastScanAt) : 'not run in this session'}
                </p>
              </div>
            </div>
          </div>

          {scanPhase >= 0 ? (
            <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {ANALYSIS_PHASES.map((phase, index) => {
                const done = index < scanPhase;
                const current = index === scanPhase;
                return (
                  <li
                    key={phase}
                    className={cx(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]',
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-300 [html.light_&]:border-emerald-200 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700'
                        : current
                          ? 'border-accent-500/40 bg-accent-500/10 text-accent-200 [html.light_&]:border-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700'
                          : 'border-ink-700/60 text-dimmer [html.light_&]:border-ink-100',
                    )}
                  >
                    {done ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <span className="h-1 w-1 rounded-full bg-current" aria-hidden />}
                    {phase}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </CardBody>
      </Card>

      {/* Severity summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map((key) => {
          const count = analysis.findings.filter((finding) => finding.status === 'open' && finding.severity === key).length;
          const active = severity === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSeverity(active ? 'all' : key)}
              aria-pressed={active}
              className={cx(
                'surface flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors',
                active ? 'border-accent-500/50 bg-accent-500/8' : 'hover:border-accent-500/30',
              )}
            >
              <SeverityBadge severity={key} size="sm" />
              <span className="text-[18px] font-semibold tabular-nums text-ink-50 [html.light_&]:text-ink-900">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-dimmer" aria-hidden />
            <p className="eyebrow">Filters</p>
            {activeFilters.length > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear all
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,180px))]">
            <SearchField value={query} onChange={setQuery} placeholder="Search findings, settings, values…" />
            <FilterSelect
              label="Filter by severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: 'all' as SeverityFilter, label: 'Severity: all' },
                { value: 'critical' as SeverityFilter, label: 'Severity: critical' },
                { value: 'high' as SeverityFilter, label: 'Severity: high' },
                { value: 'medium' as SeverityFilter, label: 'Severity: medium' },
                { value: 'low' as SeverityFilter, label: 'Severity: low' },
              ]}
            />
            <FilterSelect
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all' as StatusFilter, label: 'Status: all' },
                { value: 'open' as StatusFilter, label: 'Status: open' },
                { value: 'resolved' as StatusFilter, label: 'Status: resolved' },
              ]}
            />
            <FilterSelect
              label="Filter by device"
              value={deviceId}
              onChange={setDeviceId}
              options={[
                { value: 'all', label: 'Device: all' },
                ...devices.map((device) => ({ value: device.id, label: `Device: ${device.name}` })),
              ]}
            />
            <FilterSelect
              label="Filter by category"
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all' as IssueCategory | 'all', label: 'Category: all' },
                ...ISSUE_CATEGORIES.map((entry) => ({ value: entry as IssueCategory | 'all', label: `Category: ${entry}` })),
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {/* Findings */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={status === 'resolved' ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            tone={openFindings.length === 0 ? 'ok' : 'neutral'}
            title={openFindings.length === 0 ? 'All checks passed' : 'No findings match these filters'}
            description={
              openFindings.length === 0
                ? 'The current configuration has no detected issues.'
                : 'Adjust or clear the filters to see the rest of the findings register.'
            }
            action={
              activeFilters.length > 0 ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <p className="text-[12px] text-dimmer">
            Showing {filtered.length} finding{filtered.length === 1 ? '' : 's'}
          </p>
          {grouped.map(([groupSeverity, list]) => (
            <section key={groupSeverity} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={groupSeverity} />
                <p className="eyebrow">
                  {list.length} finding{list.length === 1 ? '' : 's'}
                </p>
                <span className="h-px flex-1 bg-ink-700/70 [html.light_&]:bg-ink-100" aria-hidden />
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {list.map((finding) => (
                  <div key={finding.id} className={cx(focusId === finding.id && 'ring-2 ring-accent-500/50 rounded-xl')}>
                    <FindingCard
                      finding={finding}
                      device={devices.find((device) => device.id === finding.deviceId)}
                      onFix={finding.status === 'open' ? () => handleFix(finding) : undefined}
                      onAskAssistant={() =>
                        navigate(`/assistant?context=finding&finding=${encodeURIComponent(finding.id)}`)
                      }
                      highlighted={focusId === finding.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="How remediation works" description="The core CYBERSURE workflow, in four steps." icon={<Wrench className="h-4 w-4" aria-hidden />} />
        <CardBody>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '01', title: 'Finding detected', body: 'A setting deviates from the CYBERSURE baseline, raising a security finding with a risk explanation.' },
              { step: '02', title: 'Review & fix', body: 'Open the configuration editor with the offending value and the recommended value pre-loaded.' },
              { step: '03', title: 'Validate', body: 'Syntax, security policy, compliance and conflict checks must pass before the change can be applied.' },
              { step: '04', title: 'Apply change', body: 'The finding resolves, the posture score updates and the change is written to the audit trail.' },
            ].map((entry) => (
              <li key={entry.step} className="rounded-lg border border-ink-700/60 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                <p className="font-mono text-[11px] text-accent-400">{entry.step}</p>
                <p className="mt-1 text-[12.5px] font-semibold text-ink-100 [html.light_&]:text-ink-800">{entry.title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-dimmer">{entry.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11.5px] text-dimmer">
            <Tooltip content="CYBERSURE never connects to a real device in this prototype.">
              <span className="underline decoration-dotted underline-offset-2">
                Applying a change simulates the write locally.
              </span>
            </Tooltip>{' '}
            Findings are produced by CYBERSURE&rsquo;s local rule engine from the sample configuration.
          </p>
        </CardBody>
      </Card>

      {editTarget ? (
        <EditSettingModal
          device={devices.find((device) => device.id === editTarget.finding.deviceId)!}
          item={editTarget.item}
          open
          onClose={() => setEditTarget(null)}
          onApply={handleApply}
        />
      ) : null}
    </div>
  );
}
