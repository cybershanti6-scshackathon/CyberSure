import { useState } from 'react';
import {
  Bell,
  FlaskConical,
  Moon,
  Palette,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Monitor,
  Info,
} from 'lucide-react';
import { useCyberSure } from '@/lib/store';
import { ThemeSegmented } from '@/components/layout/ThemeToggle';
import { useNotify } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { KeyValue } from '@/components/ui/Primitives';
import { Switch } from '@/components/ui/Form';
import { cx } from '@/utils/format';
import { useTheme } from '@/hooks/useTheme';

const SCOPE_NOTES = [
  { title: 'Device configuration collection', body: 'Represents reading running configuration from routers, switches, firewalls, wireless controllers and servers via the vendor APIs in scope (NETCONF, NET REST, Panorama, FortiOS, Junos, RouterOS, ArubaOS).' },
  { title: 'Configuration conversion', body: 'Represents the configuration converter: a FastAPI conversion service that parses a configuration into a normalized network model and renders it in any supported target platform syntax, reporting what it cannot translate instead of guessing.' },
  { title: 'Change validation & audit trail', body: 'Represents validating a proposed change and recording the resulting configuration change with full before/after values, then reflecting it in posture, compliance and reports.' },
  { title: 'Reports & assistant', body: 'Represents the four report types and the context-aware assistant, which composes answers locally from the same sample configuration the console renders.' },
];

export function SettingsPage() {
  const { devices, changes, analysis, resetDemo, lastScanAt } = useCyberSure();
  const notify = useNotify();
  const { preference } = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);
  const [alertsOnIssues, setAlertsOnIssues] = useState(true);
  const [alertsOnReports, setAlertsOnReports] = useState(true);
  const [alertsOnValidation, setAlertsOnValidation] = useState(true);
  const [resetting, setResetting] = useState(false);

  const openFindings = analysis.findings.filter((finding) => finding.status === 'open').length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">Settings</h1>
        <p className="mt-1 text-[12.5px] text-dimmer">
          Appearance, notifications and data controls for this prototype.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Appearance"
            description="Applies to the entire console — cards, tables, modals, charts and forms."
            icon={<Palette className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="space-y-4">
            <div>
              <p className="eyebrow mb-2">Theme</p>
              <ThemeSegmented />
              <p className="mt-2 text-[11.5px] text-dimmer">
                Currently using <span className="font-medium text-ink-200 [html.light_&]:text-ink-700">{preference}</span> theme.
                The choice is stored in this browser only.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Light', icon: Sun, className: 'border-ink-100 bg-white text-ink-900' },
                { label: 'Dark', icon: Moon, className: 'border-ink-700 bg-ink-900 text-ink-50' },
                { label: 'System', icon: Monitor, className: 'border-ink-400 bg-gradient-to-br from-white to-ink-900 text-ink-900' },
              ].map((swatch) => {
                const Icon = swatch.icon;
                return (
                  <div
                    key={swatch.label}
                    className={cx('rounded-lg border p-3 text-[11.5px] font-medium', swatch.className)}
                  >
                    <Icon className="mb-2 h-4 w-4" aria-hidden />
                    {swatch.label}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Notifications"
            description="Controls the in-app toast messages produced by the analysis."
            icon={<Bell className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="space-y-3.5">
            <Switch
              checked={alertsOnIssues}
              onChange={(value) => {
                setAlertsOnIssues(value);
                notify.info(
                  value ? 'Security issue alerts enabled' : 'Security issue alerts disabled',
                  value ? 'You will be notified when a finding is resolved.' : 'Alert toasts are suppressed.',
                );
              }}
              label="Security issue alerts"
              description="Notify when a remediation resolves a finding."
            />
            <Switch
              checked={alertsOnReports}
              onChange={(value) => {
                setAlertsOnReports(value);
                notify.info(
                  value ? 'Report alerts enabled' : 'Report alerts disabled',
                  value
                    ? 'You will be notified when a report is generated or a conversion is validated.'
                    : 'Report and conversion toasts are suppressed.',
                );
              }}
              label="Report generation alerts"
              description="Notify when a report is generated or a conversion is completed."
            />
            <Switch
              checked={alertsOnValidation}
              onChange={(value) => {
                setAlertsOnValidation(value);
                notify.info(
                  value ? 'Validation alerts enabled' : 'Validation alerts disabled',
                  value ? 'You will be notified after each validation run.' : 'Validation toasts are suppressed.',
                );
              }}
              label="Configuration validation alerts"
              description="Notify on valid, blocked and applied configuration changes."
            />
            <p className="rounded-lg border border-ink-700/60 bg-ink-850 px-3 py-2 text-[11.5px] leading-relaxed text-dimmer [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
              In a production build these would map to email, webhook or SIEM notifications. This prototype only shows
              in-app toasts.
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Estate data"
            description="Restore the original estate, findings and audit trail."
            icon={<FlaskConical className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <dl>
                <KeyValue label="Devices" value={devices.length} />
                <KeyValue label="Configuration changes" value={changes.length} />
                <KeyValue label="Open findings" value={openFindings} />
                <KeyValue label="Security posture" value={`${analysis.posture} / 100`} />
              </dl>
              <dl>
                <KeyValue label="Overall compliance" value={`${analysis.compliance.overall}%`} />
                <KeyValue label="Last scan" value={lastScanAt ? new Date(lastScanAt).toISOString().slice(0, 16).replace('T', ' ') : 'never'} mono />
                <KeyValue label="Data source" value="Local data (src/data)" />
                <KeyValue label="Live network access" value="None" />
              </dl>            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                onClick={() => setConfirmReset(true)}
                icon={<RefreshCcw className="h-3.5 w-3.5" aria-hidden />}
              >
                Reset Data
              </Button>
              <p className="text-[11.5px] text-dimmer">
                Restores all 12 devices, the seeded findings and the 7 seed change records.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Prototype scope"
            description="What this build demonstrates, and what it deliberately does not."
            icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SCOPE_NOTES.map((note) => (
                <div
                  key={note.title}
                  className="rounded-lg border border-ink-700/60 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
                >
                  <p className="text-[12.5px] font-semibold text-ink-100 [html.light_&]:text-ink-800">{note.title}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-dimmer">{note.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/8 px-3.5 py-3">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-200 [html.light_&]:text-amber-700">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Explicit non-goals for this prototype
              </p>
              <ul className="mt-1.5 grid gap-1 text-[11.5px] leading-relaxed text-ink-200 sm:grid-cols-2 [html.light_&]:text-ink-700">
                <li>• No connection to any real router, switch, firewall or network.</li>
                <li>• No vendor integration, credential handling or configuration write-back.</li>
                <li>• No SIEM, ticketing, billing, CRM or live threat intelligence.</li>
                <li>• No certification claim for CIS, ISO 27001 or NIST.</li>
                <li>• The assistant is local logic, not a language-model service.</li>
                <li>• "Download PDF" uses the browser print dialog on a watermarked report.</li>
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset data"
        tone="danger"
        confirmLabel="Reset data"
        loading={resetting}
        message={
          <>
            This discards every change you have made in this session and restores the original estate:{' '}
            {devices.length} devices, {changes.length} configuration changes and all derived findings. This cannot be
            undone.
          </>
        }
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setResetting(true);
          resetDemo();
          setTimeout(() => {
            setResetting(false);
            setConfirmReset(false);
            notify.success('Data reset', 'The original estate has been restored.');
          }, 350);
        }}
      />
    </div>
  );
}
