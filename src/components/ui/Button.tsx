import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '@/utils/format';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-600 text-white shadow-sm hover:bg-accent-500 active:bg-accent-700 ' +
    '[html.light_&]:bg-accent-600 [html.light_&]:hover:bg-accent-700 border border-accent-600/60',
  secondary:
    'border border-ink-600 bg-ink-800 text-ink-100 hover:bg-ink-750 hover:border-ink-500 ' +
    '[html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-800 [html.light_&]:hover:bg-ink-50 [html.light_&]:hover:border-ink-300',
  ghost:
    'text-ink-200 hover:bg-ink-800 hover:text-ink-50 ' +
    '[html.light_&]:text-ink-600 [html.light_&]:hover:bg-ink-100 [html.light_&]:hover:text-ink-900',
  danger:
    'border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 ' +
    '[html.light_&]:border-red-200 [html.light_&]:bg-red-50 [html.light_&]:text-red-700 [html.light_&]:hover:bg-red-100',
  success:
    'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 ' +
    '[html.light_&]:border-emerald-200 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700 [html.light_&]:hover:bg-emerald-100',
  subtle:
    'bg-ink-750 text-ink-100 hover:bg-ink-700 border border-ink-700 ' +
    '[html.light_&]:bg-ink-100 [html.light_&]:text-ink-800 [html.light_&]:border-ink-200 [html.light_&]:hover:bg-ink-200',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[12.5px]',
  md: 'h-9 px-3.5 text-[13px]',
  lg: 'h-11 px-5 text-[14px]',
  icon: 'h-9 w-9 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, iconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {size !== 'icon' && children}
      {!loading && iconRight}
    </button>
  );
});
