import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '@/utils/format';
import { useEscapeKey, useScrollLock } from '@/hooks/useMediaQuery';
import { Button } from './Button';

function Backdrop({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div
      className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px] [html.light_&]:bg-ink-900/45"
      onClick={onClick}
      role="presentation"
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Announce the dialog politely to assistive technology. */
  label?: string;
}

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  label,
}: ModalProps) {
  useScrollLock(open);
  useEscapeKey(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={label ?? (typeof title === 'string' ? title : 'Dialog')}
    >
      <Backdrop onClick={onClose} label="Close dialog" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          'relative my-auto w-full animate-scale-in rounded-xl border border-ink-700 bg-ink-900 shadow-pop outline-none',
          '[html.light_&]:border-ink-200 [html.light_&]:bg-white',
          MODAL_SIZES[size],
        )}
      >
        <header
          className={cx(
            'flex items-start justify-between gap-4 border-b border-ink-700/70 px-5 py-4',
            '[html.light_&]:border-ink-100',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icon ? <span className="mt-0.5 text-accent-400 [html.light_&]:text-accent-600">{icon}</span> : null}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{title}</h2>
              {description ? (
                <p className="mt-1 text-[12.5px] leading-relaxed text-dimmer">{description}</p>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </header>
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer ? (
          <footer
            className={cx(
              'flex flex-wrap items-center justify-end gap-2 border-t border-ink-700/70 px-5 py-3',
              '[html.light_&]:border-ink-100',
            )}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  width = 'md',
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  side?: 'right' | 'left';
}) {
  useScrollLock(open);
  useEscapeKey(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const widths = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Device details">
      <Backdrop onClick={onClose} label="Close panel" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          'relative flex h-full w-full flex-col animate-slide-in-right border-ink-700 bg-ink-900 shadow-pop outline-none',
          '[html.light_&]:border-ink-200 [html.light_&]:bg-white',
          widths[width],
          side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r',
        )}
      >
        <header
          className={cx(
            'flex items-start justify-between gap-4 border-b border-ink-700/70 px-5 py-4',
            '[html.light_&]:border-ink-100',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icon ? <span className="mt-0.5 text-accent-400 [html.light_&]:text-accent-600">{icon}</span> : null}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{title}</h2>
              {description ? (
                <p className="mt-1 text-[12.5px] leading-relaxed text-dimmer">{description}</p>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer ? (
          <footer
            className={cx(
              'flex flex-wrap items-center justify-end gap-2 border-t border-ink-700/70 px-5 py-3',
              '[html.light_&]:border-ink-100',
            )}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmation dialog                                                        */
/* -------------------------------------------------------------------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13px] leading-relaxed text-dim">{message}</div>
    </Modal>
  );
}
