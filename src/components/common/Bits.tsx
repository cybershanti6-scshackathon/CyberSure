import type { ReactNode } from 'react';
import { Server, ShieldCheck, Wifi, Router, Network } from 'lucide-react';
import type { DeviceType, Vendor } from '@/types';
import { cx, DEVICE_TYPE_LABEL, VENDOR_STYLE, VENDOR_STYLE_LIGHT } from '@/utils/format';

export function VendorAvatar({ vendor, size = 32 }: { vendor: Vendor; size?: number }) {
  const dark = VENDOR_STYLE[vendor];
  const light = VENDOR_STYLE_LIGHT[vendor];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold',
        dark.bg,
        dark.border,
        dark.text,
        light.bg,
        light.border,
        light.text,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      title={vendor}
      aria-hidden
    >
      {dark.initials}
    </span>
  );
}

const TYPE_ICON: Record<DeviceType, ReactNode> = {
  router: <Router className="h-4 w-4" aria-hidden />,
  switch: <Network className="h-4 w-4" aria-hidden />,
  firewall: <ShieldCheck className="h-4 w-4" aria-hidden />,
  'wireless-controller': <Wifi className="h-4 w-4" aria-hidden />,
  server: <Server className="h-4 w-4" aria-hidden />,
};

export function DeviceTypeIcon({ type, className }: { type: DeviceType; className?: string }) {
  return (
    <span className={cx('inline-flex items-center justify-center text-dimmer', className)} title={DEVICE_TYPE_LABEL[type]}>
      {TYPE_ICON[type]}
    </span>
  );
}

export function DeviceTypeChip({ type }: { type: DeviceType }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-[11px] font-medium text-ink-200 [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-700">
      {TYPE_ICON[type]}
      {DEVICE_TYPE_LABEL[type]}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
          {icon ? <span className="text-accent-400 [html.light_&]:text-accent-600">{icon}</span> : null}
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-dimmer">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
