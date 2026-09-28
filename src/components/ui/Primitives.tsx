import type { ReactNode } from 'react';
import { cx } from '@/utils/format';

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export interface TabDefinition {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  tone?: 'critical' | 'high' | 'ok' | 'neutral';
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
  ariaLabel,
}: {
  tabs: TabDefinition[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        'flex gap-1 overflow-x-auto border-b border-ink-700/80 scroll-thin [html.light_&]:border-ink-100',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cx(
              'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors',
              selected
                ? 'text-accent-300 [html.light_&]:text-accent-700'
                : 'text-dimmer hover:text-ink-100 [html.light_&]:hover:text-ink-800',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cx(
                  'rounded px-1.5 py-px text-[10.5px] font-semibold tabular-nums',
                  tab.tone === 'critical' && 'bg-red-500/15 text-red-300 [html.light_&]:bg-red-50 [html.light_&]:text-red-700',
                  tab.tone === 'high' && 'bg-orange-500/15 text-orange-300 [html.light_&]:bg-orange-50 [html.light_&]:text-orange-700',
                  tab.tone === 'ok' && 'bg-emerald-500/15 text-emerald-300 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700',
                  (!tab.tone || tab.tone === 'neutral') &&
                    'bg-ink-750 text-ink-300 [html.light_&]:bg-ink-100 [html.light_&]:text-ink-600',
                )}
              >
                {tab.count}
              </span>
            ) : null}
            <span
              className={cx(
                'absolute inset-x-1.5 -bottom-px h-0.5 rounded-full transition-opacity',
                selected ? 'bg-accent-500 opacity-100' : 'opacity-0',
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ children, active }: { children: ReactNode; active: boolean }) {
  if (!active) return null;
  return (
    <div role="tabpanel" className="animate-fade-in">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export function ProgressBar({
  value,
  tone = 'accent',
  className,
  label,
}: {
  value: number;
  tone?: 'accent' | 'ok' | 'medium' | 'high' | 'critical';
  className?: string;
  label?: string;
}) {
  const tones: Record<string, string> = {
    accent: 'bg-accent-500',
    ok: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-ink-750 [html.light_&]:bg-ink-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Spinner / states                                                           */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded bg-ink-800',
        'after:absolute after:inset-0 after:animate-sweep after:bg-gradient-to-b after:from-transparent after:via-white/5 after:to-transparent',
        '[html.light_&]:bg-ink-100',
        className,
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'ok',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: 'ok' | 'neutral';
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span
        className={cx(
          'flex h-12 w-12 items-center justify-center rounded-full border',
          tone === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 [html.light_&]:text-emerald-600'
            : 'border-ink-600 bg-ink-800 text-dimmer [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50',
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-[14px] font-semibold text-ink-100 [html.light_&]:text-ink-900">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-dimmer">{description}</p>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip (CSS-only, keyboard accessible)                                    */
/* -------------------------------------------------------------------------- */

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none absolute left-1/2 z-40 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11.5px] leading-snug text-ink-100 opacity-0 shadow-pop transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 [html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-800',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Key/value list                                                             */
/* -------------------------------------------------------------------------- */

export function KeyValue({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-ink-700/60 py-2 last:border-0 [html.light_&]:border-ink-100">
      <dt className="shrink-0 text-[12px] text-dimmer">{label}</dt>
      <dd className={cx('min-w-0 text-right text-[12.5px] font-medium text-ink-100 [html.light_&]:text-ink-800', mono && 'font-mono')}>
        {value}
      </dd>
    </div>
  );
}
