import type { ChangeStatus, ChangeValidationStatus, DeviceStatus, DeviceType, Severity, Vendor } from '@/types';

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(iso: string, now: number = Date.now()): string {
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return 'unknown';
  const diffSeconds = (target - now) / 1000;
  const abs = Math.abs(diffSeconds);
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'just now';
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatDateTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return `${dateFmt.format(new Date(parsed))} UTC`;
}

export function formatTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(parsed));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  router: 'Router',
  switch: 'Switch',
  firewall: 'Firewall',
  'wireless-controller': 'Wireless Controller',
  server: 'Server',
};

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  maintenance: 'Maintenance',
};

export const CHANGE_STATUS_LABEL: Record<ChangeStatus, string> = {
  applied: 'Applied (Demo)',
  pending: 'Pending',
  reverted: 'Reverted',
};

export const CHANGE_VALIDATION_LABEL: Record<ChangeValidationStatus, string> = {
  validated: 'Validated',
  blocked: 'Blocked',
  pending: 'Not validated',
};

/* ---- Vendor presentation -------------------------------------------------- */

interface VendorStyle {
  /** Two-letter monogram shown in device avatars. */
  initials: string;
  /** Tailwind-safe class fragments (kept literal so the compiler sees them). */
  ring: string;
  text: string;
  bg: string;
  border: string;
}

export const VENDOR_STYLE: Record<Vendor, VendorStyle> = {
  Cisco: {
    initials: 'CS',
    ring: 'ring-sky-500/30',
    text: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  Fortinet: {
    initials: 'FT',
    ring: 'ring-red-500/30',
    text: 'text-red-300',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  'Palo Alto Networks': {
    initials: 'PA',
    ring: 'ring-orange-500/30',
    text: 'text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  Juniper: {
    initials: 'JN',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  MikroTik: {
    initials: 'MK',
    ring: 'ring-violet-500/30',
    text: 'text-violet-300',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
  Aruba: {
    initials: 'AR',
    ring: 'ring-cyan-500/30',
    text: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  Arista: {
    initials: 'AE',
    ring: 'ring-teal-500/30',
    text: 'text-teal-300',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
  },
  Huawei: {
    initials: 'HW',
    ring: 'ring-rose-500/30',
    text: 'text-rose-300',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  Vyatta: {
    initials: 'VY',
    ring: 'ring-lime-500/30',
    text: 'text-lime-300',
    bg: 'bg-lime-500/10',
    border: 'border-lime-500/30',
  },
  Other: {
    initials: 'OT',
    ring: 'ring-ink-500/40',
    text: 'text-ink-200',
    bg: 'bg-ink-500/10',
    border: 'border-ink-500/40',
  },
};

/** Dark-mode aware vendor classes (light variant is expressed in index.css). */
export const VENDOR_STYLE_LIGHT: Record<Vendor, Partial<VendorStyle>> = {
  Cisco: { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  Fortinet: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'Palo Alto Networks': { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  Juniper: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  MikroTik: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  Aruba: { text: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  Arista: { text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  Huawei: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  Vyatta: { text: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-200' },
  Other: { text: 'text-ink-600', bg: 'bg-ink-50', border: 'border-ink-200' },
};

export function truncate(value: string, max = 64): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
