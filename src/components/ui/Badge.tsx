import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck, ShieldAlert, CircleCheck, Clock, CircleSlash } from 'lucide-react';
import type { ComplianceStatus, DeviceStatus, SecurityStatus, Severity } from '@/types';
import { cx, SEVERITY_LABEL } from '@/utils/format';

type Tone = 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'info' | 'neutral' | 'violet';

const TONE_CLASS: Record<Tone, string> = {
  critical:
    'border-red-500/35 bg-red-500/12 text-red-300 [html.light_&]:border-red-200 [html.light_&]:bg-red-50 [html.light_&]:text-red-700',
  high:
    'border-orange-500/35 bg-orange-500/12 text-orange-300 [html.light_&]:border-orange-200 [html.light_&]:bg-orange-50 [html.light_&]:text-orange-700',
  medium:
    'border-amber-500/35 bg-amber-500/12 text-amber-300 [html.light_&]:border-amber-200 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-700',
  low: 'border-accent-500/35 bg-accent-500/12 text-accent-300 [html.light_&]:border-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700',
  ok: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300 [html.light_&]:border-emerald-200 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700',
  info: 'border-sky-500/35 bg-sky-500/12 text-sky-300 [html.light_&]:border-sky-200 [html.light_&]:bg-sky-50 [html.light_&]:text-sky-700',
  violet:
    'border-violet-500/35 bg-violet-500/12 text-violet-300 [html.light_&]:border-violet-200 [html.light_&]:bg-violet-50 [html.light_&]:text-violet-700',
  neutral:
    'border-ink-600 bg-ink-800 text-ink-200 [html.light_&]:border-ink-200 [html.light_&]:bg-ink-100 [html.light_&]:text-ink-700',
};

const DOT_CLASS: Record<Tone, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-accent-500',
  ok: 'bg-emerald-500',
  info: 'bg-sky-500',
  violet: 'bg-violet-500',
  neutral: 'bg-ink-400',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4',
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const SEVERITY_ICON: Record<Severity, ReactNode> = {
  critical: <AlertOctagon className="h-3 w-3" aria-hidden />,
  high: <AlertTriangle className="h-3 w-3" aria-hidden />,
  medium: <AlertTriangle className="h-3 w-3" aria-hidden />,
  low: <Info className="h-3 w-3" aria-hidden />,
};

/**
 * Severity is communicated with colour, an icon AND text so the meaning is
 * never carried by colour alone.
 */
export function SeverityBadge({
  severity,
  className,
  size = 'md',
}: {
  severity: Severity;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        TONE_CLASS[SEVERITY_TONE[severity]],
        className,
      )}
    >
      {SEVERITY_ICON[severity]}
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function SecurityStatusBadge({ status }: { status: SecurityStatus }) {
  if (status === 'compliant') {
    return (
      <Badge tone="ok" icon={<ShieldCheck className="h-3 w-3" aria-hidden />}>
        Compliant
      </Badge>
    );
  }
  return <SeverityBadge severity={status} />;
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const map: Record<DeviceStatus, { tone: Tone; icon: ReactNode; label: string }> = {
    online: { tone: 'ok', icon: <CircleCheck className="h-3 w-3" aria-hidden />, label: 'Online' },
    offline: { tone: 'critical', icon: <CircleSlash className="h-3 w-3" aria-hidden />, label: 'Offline' },
    maintenance: { tone: 'medium', icon: <Clock className="h-3 w-3" aria-hidden />, label: 'Maintenance' },
  };
  const entry = map[status];
  return (
    <Badge tone={entry.tone} icon={entry.icon}>
      {entry.label}
    </Badge>
  );
}

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  const map: Record<ComplianceStatus, { tone: Tone; label: string; icon: ReactNode }> = {
    compliant: { tone: 'ok', label: 'Compliant', icon: <ShieldCheck className="h-3 w-3" aria-hidden /> },
    partial: { tone: 'medium', label: 'Partially compliant', icon: <ShieldAlert className="h-3 w-3" aria-hidden /> },
    'non-compliant': { tone: 'critical', label: 'Non-compliant', icon: <AlertOctagon className="h-3 w-3" aria-hidden /> },
    'not-assessed': { tone: 'neutral', label: 'Not assessed', icon: <Info className="h-3 w-3" aria-hidden /> },
  };
  const entry = map[status];
  return (
    <Badge tone={entry.tone} icon={entry.icon}>
      {entry.label}
    </Badge>
  );
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cx('inline-block h-1.5 w-1.5 rounded-full', DOT_CLASS[tone], className)} aria-hidden />;
}

export { type Tone };
