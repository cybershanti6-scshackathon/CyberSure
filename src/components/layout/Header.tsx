import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Radar, Search, Settings as SettingsIcon } from 'lucide-react';
import { useCyberSure } from '@/lib/store';
import { cx } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Primitives';
import { ThemeToggle } from './ThemeToggle';
import { useNotify } from '@/components/ui/Toast';

function NotificationBell() {
  const { analysis, notifications, clearNotifications, markNotificationRead } = useCyberSure();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Security alerts derived from the register, plus the live event feed.
  const securityAlerts = analysis.findings
    .filter((finding) => finding.status === 'open' && (finding.severity === 'critical' || finding.severity === 'high'))
    .slice(0, 4)
    .map((finding) => ({
      id: `sec-${finding.id}`,
      title: finding.title,
      detail: `${analysis.devices.find((device) => device.id === finding.deviceId)?.name ?? finding.deviceId} · ${finding.currentValue}`,
      tone: finding.severity as 'critical' | 'high',
      to: `/issues?focus=${encodeURIComponent(finding.id)}`,
    }));

  const feed = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    detail: notification.detail,
    tone: notification.tone,
    to: notification.link?.to,
  }));

  const items = [...feed, ...securityAlerts].slice(0, 9);
  const unread = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const TONE_DOT: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    ok: 'bg-emerald-500',
    info: 'bg-accent-500',
    warning: 'bg-amber-500',
  };

  return (
    <div className="relative" ref={ref}>
      <Tooltip content={`${items.length} notifications`} side="bottom">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`Notifications: ${items.length} notifications`}
          aria-expanded={open}
          className={cx(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-ink-200 transition-colors',
            'hover:border-ink-500 hover:bg-ink-750 hover:text-ink-50',
            '[html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-600 [html.light_&]:hover:border-ink-300 [html.light_&]:hover:bg-ink-50 [html.light_&]:hover:text-ink-900',
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {items.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold text-white">
              {items.length}
            </span>
          ) : null}
        </button>
      </Tooltip>

      {open ? (
        <div
          className={cx(
            'absolute right-0 top-full z-40 mt-2 w-[340px] animate-scale-in overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-pop',
            '[html.light_&]:border-ink-200 [html.light_&]:bg-white',
          )}
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-ink-700/70 px-3.5 py-2.5 [html.light_&]:border-ink-100">
            <p className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 ? <Badge tone="info">{unread} new</Badge> : <Badge tone="neutral">Activity</Badge>}
              {notifications.length > 0 ? (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-[11px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <ul className="max-h-96 overflow-y-auto scroll-thin">
            {items.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-[12px] text-dimmer">
                No notifications yet. Apply a change or run a scan.
              </li>
            ) : (
              items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      if (item.id.startsWith('sec-')) markNotificationRead(item.id);
                      if (item.to) navigate(item.to);
                    }}
                    className="flex w-full items-start gap-2.5 border-b border-ink-700/50 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-ink-800 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50"
                  >
                    <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[item.tone] ?? 'bg-ink-400')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-ink-100 [html.light_&]:text-ink-800">{item.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-dimmer">{item.detail}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notify = useNotify();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(
          'inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 py-1 pl-1 pr-2 transition-colors',
          'hover:border-ink-500 hover:bg-ink-750',
          '[html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:hover:border-ink-300 [html.light_&]:hover:bg-ink-50',
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-[11px] font-semibold text-white">
          DO
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[12px] font-medium leading-tight text-ink-100 [html.light_&]:text-ink-800">
            Operator
          </span>
          <span className="block text-[10px] leading-tight text-dimmer">Network security admin</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-dimmer" aria-hidden />
      </button>

      {open ? (
        <div
          className={cx(
            'absolute right-0 top-full z-40 mt-2 w-60 animate-scale-in overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-pop',
            '[html.light_&]:border-ink-200 [html.light_&]:bg-white',
          )}
          role="menu"
        >
          <div className="flex items-center gap-2.5 border-b border-ink-700/70 px-3.5 py-3 [html.light_&]:border-ink-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-[12px] font-semibold text-white">
              DO
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                Operator
              </span>
              <span className="block truncate text-[11px] text-dimmer">operator@cybersure.local</span>
            </span>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-ink-200 transition-colors hover:bg-ink-800 [html.light_&]:text-ink-700 [html.light_&]:hover:bg-ink-50"
            >
              <SettingsIcon className="h-3.5 w-3.5" aria-hidden />
              Settings &amp; data
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                notify.info('Prototype session', 'Authentication is out of scope for this build.');
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-ink-200 transition-colors hover:bg-ink-800 [html.light_&]:text-ink-700 [html.light_&]:hover:bg-ink-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
              <span className="ml-auto text-[10px] uppercase tracking-wide text-dimmer">n/a</span>
            </button>
          </div>
          <p className="border-t border-ink-700/70 px-3.5 py-2 text-[10.5px] leading-relaxed text-dimmer [html.light_&]:border-ink-100">
            Configuration changes are simulated locally.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Header({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch,
  onRunScan,
  scanRunning,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onRunScan: () => void;
  scanRunning: boolean;
}) {
  return (
    <header className="print:hidden z-20 flex h-14 shrink-0 items-center gap-2 border-b border-ink-700/80 bg-ink-900/80 px-3 backdrop-blur [html.light_&]:border-ink-100 [html.light_&]:bg-white/85 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        className={cx(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-ink-200 transition-colors',
          'hover:border-ink-500 hover:bg-ink-750 hover:text-ink-50',
          '[html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-600 [html.light_&]:hover:border-ink-300 [html.light_&]:hover:bg-ink-50',
        )}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
      </button>

      <Link
        to="/assessment"
        className="flex shrink-0 items-center gap-2 lg:hidden"
        aria-label="CYBERSURE overview"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-[10px] font-bold text-white">
          CS
        </span>
      </Link>

      <Link
        to="/"
        className="hidden shrink-0 items-center gap-2 lg:flex"
        aria-label="CYBERSURE home"
      >
        <span className="text-[13.5px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">CYBERSURE</span>
      </Link>

      <button
        type="button"
        onClick={onOpenSearch}
        className={cx(
          'group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-ink-600 bg-ink-850 px-3 text-left transition-colors',
          'hover:border-ink-500 hover:bg-ink-800',
          '[html.light_&]:border-ink-200 [html.light_&]:bg-ink-50 [html.light_&]:hover:border-ink-300 [html.light_&]:hover:bg-white',
          'sm:max-w-md',
        )}
        aria-label="Open global search"
      >
        <Search className="h-4 w-4 shrink-0 text-dimmer" aria-hidden />
        <span className="truncate text-[12.5px] text-dimmer">
          Search devices, issues, settings, reports…
        </span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] text-dimmer sm:block [html.light_&]:border-ink-200">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          className="hidden lg:inline-flex"
          onClick={onRunScan}
          loading={scanRunning}
          icon={<Radar className="h-3.5 w-3.5" aria-hidden />}
        >
          Run Scan
        </Button>

        <NotificationBell />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
