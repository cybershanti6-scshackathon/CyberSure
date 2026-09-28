import { useEffect, useState } from 'react';
import type { Severity } from '@/types';
import { cx, SEVERITY_LABEL } from '@/utils/format';

export type ScoreTone = 'ok' | 'low' | 'medium' | 'high' | 'critical';

export function toneForScore(score: number): ScoreTone {
  if (score >= 90) return 'ok';
  if (score >= 80) return 'low';
  if (score >= 70) return 'medium';
  if (score >= 55) return 'high';
  return 'critical';
}

const TONE_STROKE: Record<ScoreTone, string> = {
  ok: 'stroke-emerald-500',
  low: 'stroke-accent-500',
  medium: 'stroke-amber-500',
  high: 'stroke-orange-500',
  critical: 'stroke-red-500',
};

const TONE_TEXT: Record<ScoreTone, string> = {
  ok: 'text-emerald-400 [html.light_&]:text-emerald-600',
  low: 'text-accent-400 [html.light_&]:text-accent-600',
  medium: 'text-amber-400 [html.light_&]:text-amber-600',
  high: 'text-orange-400 [html.light_&]:text-orange-600',
  critical: 'text-red-400 [html.light_&]:text-red-600',
};

/** Animated gauge for the security posture score. */
export function ScoreGauge({
  score,
  size = 168,
  label = 'Security posture',
  caption,
  strokeWidth = 12,
}: {
  score: number;
  size?: number;
  label?: string;
  caption?: string;
  strokeWidth?: number;
}) {
  const [display, setDisplay] = useState(0);
  const clamped = Math.max(0, Math.min(100, score));
  const tone = toneForScore(clamped);

  useEffect(() => {
    let frame = 0;
    const steps = 26;
    const id = setInterval(() => {
      frame += 1;
      setDisplay((current) => current + (clamped - current) / 3);
      if (frame >= steps) {
        clearInterval(id);
        setDisplay(clamped);
      }
    }, 16);
    return () => clearInterval(id);
  }, [clamped]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - display / 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${clamped} out of 100`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-ink-750 [html.light_&]:stroke-ink-100"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={cx(TONE_STROKE[tone], 'transition-[stroke-dashoffset] duration-200 ease-out')}
          />
          {Array.from({ length: 25 }).map((_, index) => {
            const angle = (index / 25) * Math.PI * 2;
            const inner = radius - strokeWidth - 3;
            const outer = radius - strokeWidth - 7;
            return (
              <line
                key={index}
                x1={size / 2 + Math.cos(angle) * outer}
                y1={size / 2 + Math.sin(angle) * outer}
                x2={size / 2 + Math.cos(angle) * inner}
                y2={size / 2 + Math.sin(angle) * inner}
                className="stroke-ink-700 [html.light_&]:stroke-ink-200"
                strokeWidth="1"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cx('text-[34px] font-semibold leading-none tabular-nums', TONE_TEXT[tone])}>
            {Math.round(display)}
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-dimmer">/ 100</span>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] font-semibold text-ink-100 [html.light_&]:text-ink-800">{label}</p>
      {caption ? <p className="mt-0.5 text-[11.5px] text-dimmer">{caption}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Severity distribution bar                                                  */
/* -------------------------------------------------------------------------- */

const SEVERITY_BAR: Record<Severity, { bar: string; chip: string }> = {
  critical: { bar: 'bg-red-500', chip: 'bg-red-500/12 text-red-300 border-red-500/30 [html.light_&]:bg-red-50 [html.light_&]:text-red-700 [html.light_&]:border-red-200' },
  high: { bar: 'bg-orange-500', chip: 'bg-orange-500/12 text-orange-300 border-orange-500/30 [html.light_&]:bg-orange-50 [html.light_&]:text-orange-700 [html.light_&]:border-orange-200' },
  medium: { bar: 'bg-amber-500', chip: 'bg-amber-500/12 text-amber-300 border-amber-500/30 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-700 [html.light_&]:border-amber-200' },
  low: { bar: 'bg-accent-500', chip: 'bg-accent-500/12 text-accent-300 border-accent-500/30 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700 [html.light_&]:border-accent-200' },
};

export function SeverityBar({ counts, total }: { counts: Record<Severity, number>; total: number }) {
  const order: Severity[] = ['critical', 'high', 'medium', 'low'];
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-750 [html.light_&]:bg-ink-100" role="img" aria-label="Severity distribution of open findings">
        {order.map((severity) =>
          counts[severity] > 0 ? (
            <div
              key={severity}
              className={cx(SEVERITY_BAR[severity].bar, 'h-full transition-[width] duration-500')}
              style={{ width: `${total > 0 ? (counts[severity] / total) * 100 : 0}%` }}
              title={`${SEVERITY_LABEL[severity]}: ${counts[severity]}`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {order.map((severity) => (
          <li
            key={severity}
            className={cx(
              'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium',
              SEVERITY_BAR[severity].chip,
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className={cx('h-1.5 w-1.5 rounded-full', SEVERITY_BAR[severity].bar)} aria-hidden />
              {SEVERITY_LABEL[severity]}
            </span>
            <span className="tabular-nums">{counts[severity]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Compact compliance bars (framework cards)                                  */
/* -------------------------------------------------------------------------- */

export function MiniBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-750 [html.light_&]:bg-ink-100">
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out', tone)}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sparkline for posture history (sample trend)                          */
/* -------------------------------------------------------------------------- */

export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const width = 120;
  const height = 28;
  const min = Math.min(...points) - 4;
  const max = Math.max(...points) + 4;
  const span = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Sample posture trend">
      <path d={path} fill="none" strokeWidth="1.75" className="stroke-accent-500" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
