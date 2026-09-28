import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches unexpected runtime errors anywhere in the React tree.
 *
 * Without this, a single uncaught error unmounts the whole root and the
 * browser shows a blank page with nothing but a console message. The
 * boundary keeps the shell visible and offers a way forward, while the
 * details stay in the console for developers — never on screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Log for developers (console only) — never surfaced in the UI.
    console.error('[CYBERSURE] Unhandled runtime error:', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6 [html.light_&]:bg-ink-50">
        <div className="surface w-full max-w-md p-8 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400 [html.light_&]:border-amber-200 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-600">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-[18px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-dim">
            CYBERSURE ran into an unexpected error. Your data is safe — reload the page to continue where you
            left off.
          </p>
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={this.reload} icon={<RefreshCw className="h-4 w-4" aria-hidden />}>
            Reload CYBERSURE
          </Button>
          <p className="mt-4 text-[11px] leading-relaxed text-dimmer">
            If this keeps happening, open the browser console and check the logged error, then restart the dev
            server.
          </p>
        </div>
      </div>
    );
  }
}
