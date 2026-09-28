import type { ReactNode } from 'react';
import { cx } from '@/utils/format';

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={cx('surface', className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        'flex flex-wrap items-start justify-between gap-3 border-b border-ink-700/70 px-4 py-3',
        '[html.light_&]:border-ink-100',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-accent-400 [html.light_&]:text-accent-600">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-dimmer">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('p-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer
      className={cx(
        'flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/70 px-4 py-2.5',
        '[html.light_&]:border-ink-100',
        className,
      )}
    >
      {children}
    </footer>
  );
}

/** Small labelled figure used inside cards. */
export function StatBlock({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'info';
}) {
  const toneClass: Record<string, string> = {
    default: 'text-ink-50 [html.light_&]:text-ink-900',
    critical: 'text-red-400 [html.light_&]:text-red-600',
    high: 'text-orange-400 [html.light_&]:text-orange-600',
    medium: 'text-amber-400 [html.light_&]:text-amber-600',
    low: 'text-accent-400 [html.light_&]:text-accent-600',
    ok: 'text-emerald-400 [html.light_&]:text-emerald-600',
    info: 'text-accent-400 [html.light_&]:text-accent-600',
  };
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={cx('mt-1 text-[19px] font-semibold leading-none tabular-nums', toneClass[tone])}>{value}</p>
      {hint ? <p className="mt-1.5 text-[11.5px] text-dimmer">{hint}</p> : null}
    </div>
  );
}
