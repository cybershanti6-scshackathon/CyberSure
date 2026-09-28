import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ResolvedTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/types';
import { cx } from '@/utils/format';
import { Tooltip } from '@/components/ui/Primitives';

/**
 * Cycle order for the compact header control. Dark is listed first so the most
 * common toggle (dark -> light) is a single click.
 */
const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun; swatch: string }[] = [
  { value: 'dark', label: 'Dark mode', icon: Moon, swatch: 'bg-ink-900 border-ink-600' },
  { value: 'light', label: 'Light mode', icon: Sun, swatch: 'bg-white border-ink-300' },
  { value: 'system', label: 'System theme', icon: Monitor, swatch: 'bg-gradient-to-br from-white to-ink-800 border-ink-400' },
];

/** Compact header control that cycles light → dark → system. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const index = OPTIONS.findIndex((option) => option.value === preference);
  const next = OPTIONS[(index + 1) % OPTIONS.length];
  const current = OPTIONS[index] ?? OPTIONS[1];
  const Icon = current.icon;

  return (
    <Tooltip
      content={`${current.label} · click for ${next.label.toLowerCase()}`}
      side="bottom"
    >
      <button
        type="button"
        onClick={() => setPreference(next.value)}
        aria-label={`Theme: ${current.label}. Switch to ${next.label.toLowerCase()}.`}
        className={cx(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-ink-200 transition-colors',
          'hover:border-ink-500 hover:bg-ink-750 hover:text-ink-50',
          '[html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-600 [html.light_&]:hover:border-ink-300 [html.light_&]:hover:bg-ink-50 [html.light_&]:hover:text-ink-900',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    </Tooltip>
  );
}

export function ThemeSegmented({ className }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme();
  return (    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-850 p-1',
        '[html.light_&]:border-ink-200 [html.light_&]:bg-ink-50',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        const Icon = option.icon;
        const detail =
          option.value === 'system' ? `Follows your OS (${resolved})` : option.label;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(option.value)}
            className={cx(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors',
              active
                ? 'bg-accent-500/15 text-accent-200 ring-1 ring-accent-500/40 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700'
                : 'text-dimmer hover:text-ink-100 [html.light_&]:hover:text-ink-800',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {option.label.replace(' mode', '').replace(' theme', '')}
            {option.value === 'system' ? (
              <span className="text-[10px] uppercase tracking-wide text-dimmer">{resolved === 'dark' ? 'dark' : 'light'}</span>
            ) : null}
            <span className="sr-only">{detail}</span>
          </button>
        );
      })}
    </div>
  );
}

export type { ResolvedTheme };
