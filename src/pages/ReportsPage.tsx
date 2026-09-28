import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { Finding, ReportKind, Severity } from '@/types';
import { useCyberSure } from '@/lib/store';
import { ApiError, getReport } from '@/lib/api';
import { REPORT_BY_KIND, REPORT_CATALOGUE, reportScope } from '@/data/demoReports';
import { COMPLIANCE_CHECKS } from '@/data/complianceChecks';
import { deviceComplianceStatus } from '@/lib/analysis';
import { PLATFORM_BY_ID } from '@/data/platforms';
import { cx, formatDateTime, relativeTime, DEVICE_TYPE_LABEL } from '@/utils/format';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { EmptyState, KeyValue, ProgressBar } from '@/components/ui/Primitives';
import { SectionHeading } from '@/components/common/Bits';
import { useNotify } from '@/components/ui/Toast';

const KIND_ICON: Record<ReportKind, typeof FileText> = {
  'security-assessment': ShieldCheck,
  'configuration-analysis': FileText,
  compliance: CheckCircle2,
  conversion: ArrowRight,
};

function severityRow(severity: Severity, findings: Finding[]) {
  return findings.filter((finding) => finding.status === 'open' && finding.severity === severity);
}

function FindingList({ findings, emptyText }: { findings: Finding[]; emptyText: string }) {
  if (findings.length === 0) {
    return <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 text-[12px] text-emerald-300 [html.light_&]:border-emerald-200 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {findings.map((finding) => (
        <li key={finding.id} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} size="sm" />
            <span className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{finding.title}</span>
            <span className="ml-auto font-mono text-[10.5px] text-dimmer">
              {finding.deviceId} · {finding.currentValue} → {finding.recommendedValue}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-dimmer">{finding.why}</p>
          <p className="mt-1 text-[10.5px] text-dimmer">
            Reference: <span className="font-medium text-accent-400 [html.light_&]:text-accent-600">{finding.reference}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ReportsPage() {
  const { analysis, devices, changes, reports, conversions, generateReport } = useCyberSure();
  const notify = useNotify();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [downloadingConversionReport, setDownloadingConversionReport] = useState(false);

  const activeKind = (searchParams.get('report') as ReportKind | null) ?? null;
  const activeReport = activeKind ? reports.find((report) => report.kind === activeKind) : undefined;

  const open = useMemo(() => analysis.findings.filter((finding) => finding.status === 'open'), [analysis.findings]);
  const resolved = useMemo(() => analysis.findings.filter((finding) => finding.status === 'resolved'), [analysis.findings]);
  const lastConversion = conversions[0]?.result ?? null;

  const select = (kind: ReportKind | null) => {
    const next = new URLSearchParams(searchParams);
    if (kind) next.set('report', kind);
    else next.delete('report');
    setSearchParams(next, { replace: true });
  };

  const handleGenerate = (kind: ReportKind) => {
    const report = generateReport(kind);
    select(kind);
    notify.success('Report generated', `${report.title} · snapshot captured from the current state.`);
  };

  /**
   * Configuration reports are always delivered as JSON. No PDF, DOC, DOCX or
   * TXT file is produced for this report type.
   */
  const handleConfigurationJsonDownload = (kind: ReportKind) => {
    const report = reports.find((entry) => entry.kind === kind);
    if (!report) {
      notify.warning('Generate the report first', 'A report must exist before it can be downloaded.');
      return;
    }

    const payload = {
      report: {
        id: report.id,
        kind: report.kind,
        title: report.title,
        generatedAt: report.generatedAt,
        scope: report.scope,
        generatedBy: report.generatedBy,
        snapshot: report.snapshot,
      },
      configuration: devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        vendor: device.vendor,
        model: device.model,
        ipAddress: device.ipAddress,
        environment: device.environment,
        osVersion: device.config.osVersion,
        configVersion: device.config.configVersion,
        lastScan: device.lastScan,
        settings: (analysis.itemsByDevice[device.id] ?? []).map((item) => ({
          id: item.id,
          category: item.category,
          setting: item.setting,
          label: item.label,
          value: item.value,
          recommended: item.recommended,
          severity: item.severity,
          compliant: item.value === item.recommended,
        })),
      })),
      findings: analysis.findings.map((finding) => ({
        id: finding.id,
        deviceId: finding.deviceId,
        configItemId: finding.configItemId,
        title: finding.title,
        severity: finding.severity,
        issueCategory: finding.issueCategory,
        currentValue: finding.currentValue,
        recommendedValue: finding.recommendedValue,
        status: finding.status,
        reference: finding.reference,
        detectedAt: finding.detectedAt,
        resolvedAt: finding.resolvedAt ?? null,
      })),
      changes: changes.map((change) => ({
        id: change.id,
        deviceId: change.deviceId,
        deviceName: change.deviceName,
        configItemId: change.configItemId,
        setting: change.setting,
        category: change.category,
        oldValue: change.oldValue,
        newValue: change.newValue,
        recommended: change.recommended,
        validationStatus: change.validationStatus,
        changeStatus: change.changeStatus,
        timestamp: change.timestamp,
        actor: change.actor,
        source: change.source,
      })),
    };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'configuration-report.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    notify.success('Configuration report downloaded', 'configuration-report.json');
  };

  const handleDownload = (kind: ReportKind) => {
    const report = reports.find((entry) => entry.kind === kind);
    if (!report) {
      notify.warning('Generate the report first', 'A report must exist before it can be downloaded.');
      return;
    }
    notify.info('Preparing PDF', 'Opening the browser print dialog. Choose "Save as PDF".');
    setTimeout(() => window.print(), 350);
  };

  /**
   * Downloads the conversion report produced by the conversion service.
   *
   * The payload is the service's own JSON report, so every field in it came from
   * the actual conversion run.
   */
  const handleConversionReportDownload = async () => {
    const reportId = lastConversion?.reportId;
    if (!reportId) {
      notify.warning('No conversion report', 'Run a conversion first — the service generates the report.');
      return;
    }
    setDownloadingConversionReport(true);
    try {
      const report = await getReport(reportId);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'configuration-report.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      notify.success('Conversion report downloaded', 'configuration-report.json');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'The conversion service did not respond.';
      notify.error('Conversion report unavailable', message);
    } finally {
      setDownloadingConversionReport(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Report detail view                                                      */
  /* ---------------------------------------------------------------------- */

  if (activeKind && activeReport) {
    const definition = REPORT_BY_KIND[activeKind];
    const b = analysis.breakdown;
    return (
      <div className="space-y-4">
        <header className="print:hidden flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => select(null)}
              className="mb-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600"
            >
              ← All reports
            </button>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
              {definition.title}
            </h1>
            <p className="mt-1 text-[12.5px] text-dimmer">
              {reportScope(activeKind, devices.length)} · generated {relativeTime(activeReport.generatedAt ?? '')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/assistant?context=report&kind=${activeKind}`)}
              icon={<Bot className="h-3.5 w-3.5" aria-hidden />}
            >
              Explain with Assistant
            </Button>
            {activeKind === 'configuration-analysis' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleConfigurationJsonDownload(activeKind)}
                icon={<Download className="h-3.5 w-3.5" aria-hidden />}
              >
                Download JSON
              </Button>
            ) : activeKind === 'conversion' ? (
              // The conversion report is produced by the conversion service, so
              // the JSON is the service's own report - not a local re-serialisation.
              <Button
                variant="secondary"
                size="sm"
                disabled={!lastConversion?.reportId}
                loading={downloadingConversionReport}
                onClick={() => void handleConversionReportDownload()}
                icon={<Download className="h-3.5 w-3.5" aria-hidden />}
              >
                Download JSON
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => handleDownload(activeKind)} icon={<Download className="h-3.5 w-3.5" aria-hidden />}>
                Download PDF
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => window.print()} icon={<Printer className="h-3.5 w-3.5" aria-hidden />}>
              Print
            </Button>
          </div>
        </header>

        <Card className="print:border-0 print:bg-transparent print:shadow-none">
          <CardBody className="space-y-6">
            {/* Report masthead */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 pb-4 [html.light_&]:border-ink-100">
              <div>
                <p className="text-[16px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">CYBERSURE</p>
                <p className="text-[11.5px] text-dimmer">Intelligent Network Security Configuration &amp; Compliance Platform</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10.5px] text-dimmer">{activeReport.id}</p>
                <p className="font-mono text-[10.5px] text-dimmer">{activeReport.generatedAt ? formatDateTime(activeReport.generatedAt) : '—'}</p>
              </div>
            </div>

            {/* Executive summary */}
            <section>
              <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{definition.sections[0]}</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                This report covers {devices.length} devices in the CYBERSURE environment. At generation time the
                estate held {b.open} open security findings ({b.critical} critical, {b.high} high, {b.medium} medium,{' '}
                {b.low} low) and {b.resolved} resolved findings, with a security posture of {analysis.posture}/100 and overall
                compliance of {analysis.compliance.overall}%. {changes.length} configuration changes are recorded in the audit
                trail. {activeKind === 'conversion'
                  ? `${conversions.length} converter run${conversions.length === 1 ? '' : 's'} were captured in this session.`
                  : 'All figures are derived from the analysis engine over fictional sample configuration.'}
              </p>
            </section>

            {/* Security posture */}
            {activeKind !== 'compliance' && activeKind !== 'conversion' ? (
              <section>
                <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Security Posture</h2>
                <div className="mt-2.5 flex items-center gap-4">
                  <span className="text-[30px] font-semibold leading-none tabular-nums text-ink-50 [html.light_&]:text-ink-900">
                    {analysis.posture}
                  </span>
                  <span className="text-[12px] text-dimmer">/ 100</span>
                  <div className="min-w-[160px] flex-1">
                    <ProgressBar
                      value={analysis.posture}
                      tone={analysis.posture >= 80 ? 'ok' : analysis.posture >= 60 ? 'medium' : 'critical'}
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => {
                    const count = open.filter((finding) => finding.severity === severity).length;
                    const tone =
                      severity === 'critical'
                        ? 'text-red-400 [html.light_&]:text-red-600'
                        : severity === 'high'
                          ? 'text-orange-400 [html.light_&]:text-orange-600'
                          : severity === 'medium'
                            ? 'text-amber-400 [html.light_&]:text-amber-600'
                            : 'text-accent-400 [html.light_&]:text-accent-600';
                    return (
                      <div key={severity} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                        <p className="eyebrow">{severity}</p>
                        <p className={cx('mt-1 text-[19px] font-semibold leading-none tabular-nums', tone)}>{count}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Severity sections — always rendered so the report structure is stable. */}
            {activeKind === 'security-assessment' || activeKind === 'configuration-analysis'
              ? (['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => {
                  const list = open.filter((finding) => finding.severity === severity);
                  return (
                    <section key={severity}>
                      <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                        {severity.charAt(0).toUpperCase() + severity.slice(1)} Findings
                        <span className="ml-2 text-[11.5px] font-normal text-dimmer">{list.length}</span>
                      </h2>
                      <div className="mt-2.5">
                        <FindingList
                          findings={list}
                          emptyText={`No ${severity} findings are open in the estate.`}
                        />
                      </div>
                    </section>
                  );
                })
              : null}

            {/* Per-device analysis */}
            {activeKind === 'configuration-analysis' ? (
              <section>
                <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Per-Device Analysis</h2>
                <div className="mt-2.5 overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-ink-700/70 text-[10.5px] uppercase tracking-[0.1em] text-dimmer [html.light_&]:border-ink-100">
                        <th scope="col" className="py-2 pr-3 font-semibold">Device</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Type</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Settings</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Drifted</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Posture</th>
                        <th scope="col" className="py-2 font-semibold">Compliance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((device) => {
                        const items = analysis.itemsByDevice[device.id] ?? [];
                        const drifted = items.filter((item) => {
                          const def = items.find((candidate) => candidate.id === item.id);
                          return def ? def.value !== def.recommended : false;
                        }).length;
                        const posture = analysis.postureByDevice[device.id] ?? 0;
                        const compliance = deviceComplianceStatus(device, analysis.findingsByDevice[device.id] ?? []);
                        return (
                          <tr key={device.id} className="border-b border-ink-800/60 last:border-0 [html.light_&]:border-ink-100">
                            <td className="py-2 pr-3 text-[12px] font-medium text-ink-100 [html.light_&]:text-ink-800">{device.name}</td>
                            <td className="py-2 pr-3 text-[11.5px] text-dimmer">{DEVICE_TYPE_LABEL[device.type]}</td>
                            <td className="py-2 pr-3 text-[11.5px] tabular-nums text-dimmer">{items.length}</td>
                            <td className="py-2 pr-3 text-[11.5px] tabular-nums text-amber-400 [html.light_&]:text-amber-600">{drifted}</td>
                            <td className="py-2 pr-3 text-[11.5px] tabular-nums text-ink-100 [html.light_&]:text-ink-800">{posture}/100</td>
                            <td className="py-2 text-[11.5px] text-dimmer capitalize">{compliance.replace('-', ' ')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* Compliance detail */}
            {activeKind === 'compliance' ? (
              <>
                <section>
                  <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Framework Scores</h2>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                    {analysis.compliance.frameworks.map((framework) => (
                      <div key={framework.id} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                        <p className="eyebrow">{framework.id}</p>
                        <p className="mt-1 text-[20px] font-semibold leading-none tabular-nums text-ink-50 [html.light_&]:text-ink-900">
                          {framework.score}%
                        </p>
                        <div className="mt-2">
                          <ProgressBar value={framework.score} tone={framework.score >= 80 ? 'ok' : 'medium'} />
                        </div>
                        <p className="mt-1.5 text-[10.5px] text-dimmer">
                          {framework.passed} passed · {framework.failed} failed · {framework.na} n/a
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Failing Controls</h2>
                  <ul className="mt-2.5 space-y-1.5">
                    {analysis.compliance.results
                      .filter((result) => result.status === 'fail')
                      .slice(0, 12)
                      .map((result) => {
                        const check = COMPLIANCE_CHECKS.find((candidate) => candidate.id === result.checkId);
                        const device = devices.find((candidate) => candidate.id === result.deviceId);
                        return (
                          <li key={`${result.checkId}-${result.deviceId}`} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                            <div className="flex flex-wrap items-center gap-2">
                              <SeverityBadge severity={result.severity} size="sm" />
                              <span className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{check?.name}</span>
                              <span className="ml-auto font-mono text-[10.5px] text-dimmer">{device?.name}</span>
                            </div>
                            <dl className="mt-1.5 grid gap-x-4 sm:grid-cols-2">
                              <KeyValue label="Current state" value={result.currentState} />
                              <KeyValue label="Expected state" value={check?.expectedState ?? '—'} />
                            </dl>
                            <p className="mt-1.5 text-[11.5px] leading-relaxed text-dimmer">{check?.remediation}</p>
                          </li>
                        );
                      })}
                  </ul>
                </section>

                <section>
                  <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Scope Statement</h2>
                  <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/[0.07] px-3.5 py-3 text-[12px] leading-relaxed text-amber-200 [html.light_&]:border-amber-200 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-700">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    These are indicative indicators computed from fictional configuration. CYBERSURE does not
                    provide, and this report does not claim, official certification or attestation for CIS, NIST or ISO 27001.
                  </p>
                </section>
              </>
            ) : null}

            {/* Conversion detail */}
            {activeKind === 'conversion' ? (
              lastConversion ? (
                <>
                  <section>
                    <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Conversion Summary</h2>
                    <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: 'Source platform', value: PLATFORM_BY_ID[lastConversion.from]?.name ?? lastConversion.from },
                        { label: 'Target platform', value: PLATFORM_BY_ID[lastConversion.to]?.name ?? lastConversion.to },
                        { label: 'Commands processed', value: String(lastConversion.processed) },
                        { label: 'Status', value: lastConversion.status === 'not-run' ? 'Not run' : lastConversion.status === 'valid' ? 'Valid' : lastConversion.status === 'valid-with-review' ? 'Valid with Review' : 'Invalid' },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                          <p className="eyebrow">{stat.label}</p>
                          <p className="mt-1 text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Warnings &amp; Manual Review</h2>
                    <ul className="mt-2.5 space-y-1.5">
                      {lastConversion.warnings.map((warning) => (
                        <li key={warning.id} className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-200 [html.light_&]:border-amber-200 [html.light_&]:bg-amber-50 [html.light_&]:text-ink-700">
                          <span className="font-semibold text-amber-300 [html.light_&]:text-amber-700">{warning.title}.</span>{' '}
                          {warning.detail}
                        </li>
                      ))}
                    </ul>
                  </section>

                  {lastConversion.validation ? (
                    <section>
                      <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Validation Results</h2>
                      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                        {lastConversion.validation.map((outcome) => (
                          <li key={outcome.id} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                              {outcome.status === 'pass' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                              ) : outcome.status === 'warn' ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                              ) : (
                                <AlertOctagon className="h-3.5 w-3.5 text-red-500" aria-hidden />
                              )}
                              {outcome.label}
                            </p>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">{outcome.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  tone="neutral"
                  title="No conversion has been run yet"
                  description="Open the Configuration Converter, run a conversion, then return here to generate the conversion report."
                  action={
                    <Button variant="primary" onClick={() => navigate('/converter')}>
                      Open Configuration Converter
                    </Button>
                  }
                />
              )
            ) : null}

            {/* Affected devices */}
            {activeKind !== 'conversion' ? (
              <section>
                <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Affected Devices</h2>
                <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {devices
                    .map((device) => ({ device, count: open.filter((finding) => finding.deviceId === device.id).length }))
                    .filter((entry) => entry.count > 0)
                    .map(({ device, count }) => (
                      <li key={device.id} className="flex items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                        <span className="truncate text-[12px] font-medium text-ink-100 [html.light_&]:text-ink-800">{device.name}</span>
                        <span className="truncate font-mono text-[10.5px] text-dimmer">{device.ipAddress}</span>
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-amber-400 [html.light_&]:text-amber-600">
                          {count} open
                        </span>
                      </li>
                    ))}
                </ul>
                {open.length === 0 ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 text-[12px] text-emerald-300 [html.light_&]:border-emerald-200 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700">
                    No devices currently have open findings.
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* Configuration changes */}
            <section>
              <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Configuration Changes</h2>
              <div className="mt-2.5 overflow-x-auto scroll-thin">
                <table className="w-full min-w-[600px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-ink-700/70 text-[10.5px] uppercase tracking-[0.1em] text-dimmer [html.light_&]:border-ink-100">
                      <th scope="col" className="py-2 pr-3 font-semibold">Change</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Device</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Setting</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Old → New</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Validation</th>
                      <th scope="col" className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.slice(0, 15).map((change) => (
                      <tr key={change.id} className="border-b border-ink-800/60 last:border-0 [html.light_&]:border-ink-100">
                        <td className="py-1.5 pr-3 font-mono text-[10.5px] text-dimmer">{change.id}</td>
                        <td className="py-1.5 pr-3 text-[11.5px] text-ink-100 [html.light_&]:text-ink-800">{change.deviceName}</td>
                        <td className="py-1.5 pr-3 text-[11.5px] text-ink-100 [html.light_&]:text-ink-800">{change.setting}</td>
                        <td className="py-1.5 pr-3 font-mono text-[11px] text-dimmer">
                          {change.oldValue} → {change.newValue}
                        </td>
                        <td className="py-1.5 pr-3 text-[11px] text-emerald-400 [html.light_&]:text-emerald-600">{change.validationStatus}</td>
                        <td className="py-1.5 text-[11px] text-dimmer">{change.changeStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {changes.length > 15 ? (
                <p className="mt-1.5 text-[11px] text-dimmer">Showing the 15 most recent of {changes.length} recorded changes.</p>
              ) : null}
            </section>

            {/* Recommendations */}
            <section>
              <h2 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Recommendations</h2>
              <ol className="mt-2.5 space-y-1.5">
                {[
                  open.filter((finding) => finding.severity === 'critical').length > 0
                    ? 'Remediate the critical findings first. They carry the highest posture penalty and typically anchor several compliance controls.'
                    : 'No critical findings are open. Maintain the current baseline and re-run the scan after any configuration change.',
                  open.filter((finding) => finding.configItemId === 'mgmt.telnet').length > 0
                    ? 'Disable Telnet on the management plane and confirm SSHv2 is enabled before applying the change.'
                    : 'Administrative access is on SSHv2 across the estate — keep the management ACL restricted to administrative subnets.',
                  'Validate every change through the Security Analysis remediation flow so syntax, security policy, compliance and conflict checks all run before it is recorded.',
                  'Treat the Configuration Converter output as a candidate only. The mapping flags vendor-specific behaviour for manual review by design.',
                  'Re-run the security scan after each remediation batch and regenerate this report to capture the improved snapshot.',
                ].map((text, index) => (
                  <li key={text} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-dim">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-[9.5px] font-semibold text-accent-300 [html.light_&]:text-accent-700">
                      {index + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ol>
            </section>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/70 pt-3 text-[10.5px] text-dimmer [html.light_&]:border-ink-100">
              <span className="flex items-center gap-1.5">
                <Info className="h-3 w-3" aria-hidden />
                Generated by CYBERSURE from fictional data · {activeReport.generatedBy}
              </span>
              <span className="font-mono">{activeReport.id}</span>
            </div>
          </CardBody>
          <div className="hidden print:block">
            <p className="pt-3 text-[10px] text-ink-600">
              This report was generated by CYBERSURE from fictional configuration. No real network device was contacted and
              no certification or attestation is claimed for any framework.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Report list                                                             */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <header className="print:hidden flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">Security Reports</h1>
          <p className="mt-1 text-[12.5px] text-dimmer">Review security, configuration and compliance results.</p>
        </div>
      </header>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Reports generated', value: reports.length, tone: 'text-ink-50 [html.light_&]:text-ink-900' },
          { label: 'Security posture', value: `${analysis.posture}/100`, tone: 'text-accent-400 [html.light_&]:text-accent-600' },
          { label: 'Open findings', value: analysis.breakdown.open, tone: 'text-red-400 [html.light_&]:text-red-600' },
          { label: 'Compliance', value: `${analysis.compliance.overall}%`, tone: 'text-emerald-400 [html.light_&]:text-emerald-600' },
          { label: 'Conversions', value: conversions.length, tone: 'text-violet-400 [html.light_&]:text-violet-600' },
        ].map((stat) => (
          <div key={stat.label} className="surface px-3 py-2.5">
            <p className="eyebrow">{stat.label}</p>
            <p className={cx('mt-1 text-[19px] font-semibold leading-none tabular-nums', stat.tone)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div>
        <SectionHeading
          title="Report library"
          description="Generate a report to capture a snapshot of the current state, then view, explain or download it."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_CATALOGUE.map((definition) => {
            const Icon = KIND_ICON[definition.kind];
            const record = reports.find((report) => report.kind === definition.kind);
            return (
              <Card key={definition.kind} className="flex flex-col">
                <CardHeader
                  title={definition.title}
                  description={definition.description}
                  icon={<Icon className="h-4 w-4" aria-hidden />}
                  action={
                    record ? (
                      <Badge tone="ok" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
                        Generated {relativeTime(record.generatedAt ?? '')}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Not generated</Badge>
                    )
                  }
                />
                <CardBody className="flex-1">
                  <p className="eyebrow mb-1.5">Sections</p>
                  <p className="text-[11.5px] leading-relaxed text-dimmer">{definition.sections.join(' · ')}</p>
                  <p className="eyebrow mb-1.5 mt-3">Data sources</p>
                  <p className="text-[11.5px] leading-relaxed text-dimmer">{definition.dataSources.join(' · ')}</p>
                  {record ? (
                    <div className="mt-3 rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                      <p className="font-mono text-[10.5px] text-dimmer">{record.id}</p>
                      <p className="mt-0.5 text-[11.5px] text-dimmer">
                        {record.generatedAt ? formatDateTime(record.generatedAt) : '—'} · {record.scope}
                      </p>
                      {record.snapshot.posture !== null ? (
                        <p className="mt-1 text-[11.5px] text-ink-200 [html.light_&]:text-ink-700">
                          Snapshot: posture {record.snapshot.posture}/100 · {record.snapshot.openFindings} open ·{' '}
                          {record.snapshot.compliance}% compliance
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardBody>
                <CardFooter className="gap-2">
                  <Button size="sm" variant="primary" onClick={() => handleGenerate(definition.kind)} icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
                    {record ? 'Regenerate' : 'Generate'}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!record} onClick={() => select(definition.kind)}>
                    View Report
                  </Button>
                  {definition.kind === 'configuration-analysis' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!record}
                      onClick={() => handleConfigurationJsonDownload(definition.kind)}
                      icon={<Download className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Download JSON
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={!record} onClick={() => handleDownload(definition.kind)} icon={<Download className="h-3.5 w-3.5" aria-hidden />}>
                      Download PDF
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Findings snapshot used by the report narrative */}
      <Card>
        <CardHeader
          title="What the reports will contain"
          description="Live figures pulled from the current state at generation time."
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            {(['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => {
              const list = severityRow(severity, analysis.findings);
              return (
                <div key={severity} className="flex items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                  <SeverityBadge severity={severity} size="sm" />
                  <span className="truncate text-[12px] text-dimmer">
                    {list.length > 0 ? list.slice(0, 2).map((finding) => finding.title).join(', ') : 'None open'}
                  </span>
                  <span className="ml-auto shrink-0 text-[12px] font-semibold tabular-nums text-ink-50 [html.light_&]:text-ink-900">
                    {list.length}
                  </span>
                </div>
              );
            })}
          </div>
          <div>
            <p className="eyebrow mb-1.5">Compliance framework indicators</p>
            <ul className="space-y-2">
              {analysis.compliance.frameworks.map((framework) => (
                <li key={framework.id} className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold uppercase text-ink-100 [html.light_&]:text-ink-800">
                      {framework.id}
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums text-ink-50 [html.light_&]:text-ink-900">
                      {framework.score}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={framework.score} tone={framework.score >= 80 ? 'ok' : 'medium'} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-dimmer">
                    Indicative indicator only — no certification is claimed.
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] text-dimmer">
              {resolved.length} resolved finding{resolved.length === 1 ? '' : 's'} are included in the report audit section.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
