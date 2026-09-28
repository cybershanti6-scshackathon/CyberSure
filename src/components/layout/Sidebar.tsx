import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bot,
  ClipboardList,
  FileClock,
  FileText,
  LayoutDashboard,
  Repeat2,
  Settings as SettingsIcon,
  ShieldAlert,
  SlidersHorizontal,
  Network,
} from 'lucide-react';
import { cx } from '@/utils/format';
import { Tooltip } from '@/components/ui/Primitives';

const NAV_ITEMS = [
  { to: '/assessment', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/devices', label: 'Devices', icon: Network, end: false },
  { to: '/converter', label: 'Configuration Converter', icon: Repeat2, end: false },
  { to: '/issues', label: 'Security Analysis', icon: ShieldAlert, end: false, badge: 'open' as const },
  { to: '/compliance', label: 'Compliance', icon: ClipboardList, end: false },
  { to: '/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/assistant', label: 'AI Assistant', icon: Bot, end: false },
  { to: '/configuration', label: 'Configuration', icon: SlidersHorizontal, end: false },
  { to: '/changes', label: 'Change History', icon: FileClock, end: false },
];

export function Sidebar({
  collapsed,
  openIssues,
}: {
  collapsed: boolean;
  openIssues: number;
}) {
  return (
    <aside
      className={cx(
        'print:hidden z-30 flex h-full shrink-0 flex-col border-r border-ink-700/80 bg-ink-900 transition-[width] duration-200',
        '[html.light_&]:border-ink-100 [html.light_&]:bg-white',
        collapsed ? 'w-[68px]' : 'w-[236px]',
      )}
    >
      <div
        className={cx(
          'flex h-14 items-center gap-2.5 border-b border-ink-700/80 px-4',
          '[html.light_&]:border-ink-100',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
          <Activity className="h-4 w-4" aria-hidden />
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-ink-50 [html.light_&]:text-ink-900">
              CYBERSURE
            </span>
            <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-dimmer">
              Security Configuration
            </span>
          </span>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5 scroll-thin" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const badgeValue = item.badge === 'open' ? openIssues : undefined;
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              // The label stays available to assistive technology even when the
              // sidebar is collapsed and the visible text is hidden.
              aria-label={item.label}
              aria-current={undefined}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-accent-500/12 text-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50 [html.light_&]:text-ink-600 [html.light_&]:hover:bg-ink-50 [html.light_&]:hover:text-ink-900',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent-400"
                      aria-hidden
                    />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                  {!collapsed && badgeValue ? (
                    <span className="rounded bg-red-500/15 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-red-300 [html.light_&]:bg-red-50 [html.light_&]:text-red-700">
                      {badgeValue}
                    </span>
                  ) : null}
                  {collapsed && badgeValue ? (
                    <span
                      className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500"
                      aria-hidden
                    />
                  ) : null}
                </>
              )}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={item.to} content={item.label} side="bottom">
              <span className="block">{link}</span>
            </Tooltip>
          ) : (
            <div key={item.to}>{link}</div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-ink-700/80 p-3 [html.light_&]:border-ink-100">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cx(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-accent-500/12 text-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50 [html.light_&]:text-ink-600 [html.light_&]:hover:bg-ink-50 [html.light_&]:hover:text-ink-900',
              collapsed && 'justify-center px-0',
            )
          }
        >
          <SettingsIcon className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed ? <span>Settings</span> : null}
        </NavLink>
        {!collapsed ? (
          <p className="px-1 pt-1 text-[10px] leading-relaxed text-dimmer">
            No real network is contacted.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
