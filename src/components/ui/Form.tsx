import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import type { ConfigOption } from '@/types';
import { cx } from '@/utils/format';

/* -------------------------------------------------------------------------- */
/* Field wrapper                                                              */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[12px] font-medium text-ink-200 [html.light_&]:text-ink-700"
      >
        {label}
        {required ? (
          <span className="text-red-400 [html.light_&]:text-red-600" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          className="flex items-start gap-1.5 text-[11.5px] font-medium text-red-400 [html.light_&]:text-red-600"
          role="alert"
        >
          <AlertCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] leading-relaxed text-dimmer">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Text / number / IP inputs                                                  */
/* -------------------------------------------------------------------------- */

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
  suffix?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid, mono, suffix, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <input
        ref={ref}
        className={cx(
          'field',
          mono && 'font-mono tracking-tight',
          invalid && 'field-invalid',
          suffix && 'pr-12',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11.5px] text-dimmer">
          {suffix}
        </span>
      ) : null}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options: ConfigOption[] | { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, options, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cx('field cursor-pointer appearance-none pr-9', invalid && 'field-invalid', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dimmer"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Segmented control (rule action selectors, view switches)                   */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; tone?: 'ok' | 'danger' | 'default' }[];
  onChange: (value: T) => void;
  name: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-850 p-1',
        '[html.light_&]:border-ink-200 [html.light_&]:bg-ink-50',
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const tone = option.tone ?? 'default';
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12.5px]',
              active && tone === 'ok' && 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700',
              active && tone === 'danger' && 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40 [html.light_&]:bg-red-50 [html.light_&]:text-red-700',
              active && tone === 'default' && 'bg-accent-500/15 text-accent-200 ring-1 ring-accent-500/40 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700',
              !active && 'text-dimmer hover:text-ink-100 [html.light_&]:hover:text-ink-800',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                     */
/* -------------------------------------------------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={inputId} className="block cursor-pointer text-[13px] font-medium text-ink-100 [html.light_&]:text-ink-800">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[11.5px] text-dimmer">{description}</p> : null}
      </div>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked
            ? 'border-emerald-500/50 bg-emerald-500/30'
            : 'border-ink-600 bg-ink-750',
          '[html.light_&]:border-ink-300 [html.light_&]:bg-ink-200',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
            'h-[18px] w-[18px]',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
            '[html.light_&]:bg-white',
          )}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Checkbox                                                                   */
/* -------------------------------------------------------------------------- */

export function Checkbox({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-200 [html.light_&]:text-ink-700"
    >
      <span
        className={cx(
          'flex h-4 w-4 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-accent-500 bg-accent-600 text-white'
            : 'border-ink-600 bg-ink-850 [html.light_&]:border-ink-300 [html.light_&]:bg-white',
        )}
      >
        {checked ? <Check className="h-3 w-3" aria-hidden /> : null}
      </span>
      <input
        id={inputId}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
