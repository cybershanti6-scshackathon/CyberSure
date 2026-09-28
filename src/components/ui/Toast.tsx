import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, X, XCircle } from 'lucide-react';
import { cx } from '@/utils/format';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: ReactNode; ring: string; iconColor: string }> = {
  success: {
    icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
    ring: 'border-emerald-500/40',
    iconColor: 'text-emerald-400 [html.light_&]:text-emerald-600',
  },
  error: {
    icon: <XCircle className="h-4 w-4" aria-hidden />,
    ring: 'border-red-500/40',
    iconColor: 'text-red-400 [html.light_&]:text-red-600',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
    ring: 'border-amber-500/40',
    iconColor: 'text-amber-400 [html.light_&]:text-amber-600',
  },
  info: {
    icon: <Info className="h-4 w-4" aria-hidden />,
    ring: 'border-accent-500/40',
    iconColor: 'text-accent-400 [html.light_&]:text-accent-600',
  },
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      counter += 1;
      const id = `toast-${counter}`;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      const duration = toast.duration ?? 4200;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => {
            const style = TONE_STYLES[toast.tone];
            return (
              <div
                key={toast.id}
                role={toast.tone === 'error' ? 'alert' : 'status'}
                className={cx(
                  'pointer-events-auto flex items-start gap-3 rounded-lg border bg-ink-850/95 p-3 shadow-pop backdrop-blur animate-slide-up',
                  '[html.light_&]:bg-white',
                  style.ring,
                )}
              >
                <span className={cx('mt-0.5 shrink-0', style.iconColor)}>{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">{toast.description}</p>
                  ) : null}
                  {toast.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onClick();
                        dismiss(toast.id);
                      }}
                      className="mt-1.5 text-[11.5px] font-semibold text-accent-400 underline-offset-2 hover:underline [html.light_&]:text-accent-600"
                    >
                      {toast.action.label}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded p-0.5 text-dimmer transition-colors hover:text-ink-100 [html.light_&]:hover:text-ink-800"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

/** Convenience helpers so feature code can fire a one-line toast. */
export function useNotify() {
  const { push } = useToast();
  return useMemo(
    () => ({
      success: (title: string, description?: string) => push({ tone: 'success', title, description }),
      error: (title: string, description?: string) => push({ tone: 'error', title, description, duration: 6000 }),
      warning: (title: string, description?: string) => push({ tone: 'warning', title, description }),
      info: (title: string, description?: string) => push({ tone: 'info', title, description }),
    }),
    [push],
  );
}

export { CheckCircle2 };
