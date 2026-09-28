import { ShieldCheck, Network, ClipboardCheck, FileText, ArrowRight, ScanLine, FileCode2, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

/* =============================================================================
 * Marketing (but honest) landing page content
 * -----------------------------------------------------------------------------
 * Every capability listed here is actually implemented somewhere in the
 * console, so the landing page is a map of the product rather than a promise.
 * ========================================================================== */

export const VALUE_CARDS = [
  {
    icon: ScanLine,
    title: 'Configuration Analysis',
    body: 'Read a device configuration and detect the settings that put it at risk — cleartext admin protocols, weak password policy, disabled logging, over-permissive policies.',
    points: ['Baseline catalogue', 'Severity-rated findings', 'Per-device posture'],
    accent: 'accent',
  },
  {
    icon: FileCode2,
    title: 'Configuration Conversion',
    body: 'Translate a configuration between supported network platforms, with an explicit manual-review flag on every command that cannot be converted faithfully.',
    points: ['8 platforms', 'Live re-conversion', 'Mapping + validation'],
    accent: 'violet',
  },
  {
    icon: ClipboardCheck,
    title: 'Security & Compliance',
    body: 'Map the same configuration evidence onto indicative CIS, NIST and ISO 27001 controls, so a single remediation moves security posture and compliance together.',
    points: ['3 frameworks', 'Control-level detail', 'Remediation plan'],
    accent: 'ok',
  },
  {
    icon: FileText,
    title: 'Reports & Assistance',
    body: 'Generate professional assessment, analysis, compliance and conversion reports, then ask the assistant to explain any finding, warning or section.',
    points: ['4 report types', 'Snapshot figures', 'Context-aware assistant'],
    accent: 'info',
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Add / Select Device',
    body: 'Start from the 12-device estate or add your own device. Each device carries a configuration snapshot with deliberate drift from baseline.',
  },
  {
    step: '02',
    title: 'Analyze Configuration',
    body: 'CYBERSURE evaluates every applicable setting against the baseline catalogue and raises severity-rated findings with a reason and a recommended fix.',
  },
  {
    step: '03',
    title: 'Fix / Convert',
    body: 'Remediate a finding through a validated change, or convert a configuration to another platform with warnings you can actually inspect.',
  },
  {
    step: '04',
    title: 'Generate Report',
    body: 'Capture the result as a professional report, and hand any section to the assistant for a grounded explanation.',
  },
] as const;

export const DEMO_NOTES: { icon: ReactNode; text: string }[] = [
  { icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden />, text: 'No real router, switch or firewall is contacted.' },
  { icon: <Network className="h-3.5 w-3.5" aria-hidden />, text: 'All devices and configurations are fictional.' },
  { icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />, text: 'No command is ever executed against infrastructure.' },
];

export const HERO_METRICS = [
  { label: 'Devices', value: '12' },
  { label: 'Tracked settings', value: '60+' },
  { label: 'Supported platforms', value: '8' },
  { label: 'Report types', value: '4' },
];

export const PLATFORM_STRIP = [
  'Cisco IOS XE',
  'Cisco IOS',
  'Cisco NX-OS',
  'Juniper Junos',
  'Fortinet FortiOS',
  'Palo Alto PAN-OS',
  'MikroTik RouterOS',
  'ArubaOS',
];

export const FEATURE_LINKS = [
  { to: '/devices', title: 'Network devices', body: 'A filterable inventory of the estate with security and compliance status per device.' },
  { to: '/converter', title: 'Configuration converter', body: 'The flagship workflow: convert between platforms, inspect the mapping, validate the result.' },
  { to: '/issues', title: 'Security analysis', body: 'The full findings register with review-and-fix remediation for every open issue.' },
  { to: '/assistant', title: 'AI assistant', body: 'Context-aware explanations grounded in the current findings, conversions and reports.' },
] as const;

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow inline-flex items-center gap-2 text-accent-400 [html.light_&]:text-accent-600">
      <span className="h-px w-6 bg-accent-500/50" aria-hidden />
      {children}
    </p>
  );
}

export { ArrowRight };
