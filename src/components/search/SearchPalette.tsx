import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CornerDownLeft, FileText, Network, Search, Settings2, ShieldAlert, X } from 'lucide-react';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';
import { useEscapeKey, useScrollLock } from '@/hooks/useMediaQuery';
import { cx } from '@/utils/format';
import { Dot, SeverityBadge, type Tone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Primitives';

function GroupLabel({ children, count }: { children: string; count: number }) {
  return (
    <p className="eyebrow flex items-center gap-2 px-3 pb-1 pt-3">
      {children}
      <span className="rounded bg-ink-750 px-1.5 py-px text-[10px] tabular-nums text-ink-300 [html.light_&]:bg-ink-100 [html.light_&]:text-ink-600">
        {count}
      </span>
    </p>
  );
}

function toneFor(result: SearchResult): Tone {
  if (result.kind === 'device') {
    const status = result.meta;
    if (status === 'compliant') return 'ok';
    if (status === 'critical') return 'critical';
    if (status === 'high') return 'high';
    if (status === 'medium') return 'medium';
    return 'low';
  }
  if (result.kind === 'report') return result.meta === 'ready' ? 'ok' : 'neutral';
  const severity = result.meta;
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function ResultRow({
  result,
  active,
  onHover,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon =
    result.kind === 'device' ? Network : result.kind === 'finding' ? ShieldAlert : result.kind === 'report' ? FileText : Settings2;
  const tone = toneFor(result);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cx(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
        active ? 'bg-accent-500/10' : 'hover:bg-ink-800 [html.light_&]:hover:bg-ink-50',
      )}
    >
      <span
        className={cx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          active
            ? 'border-accent-500/40 text-accent-300 [html.light_&]:text-accent-600'
            : 'border-ink-600 text-dimmer [html.light_&]:border-ink-200',
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[12.5px] font-medium text-ink-50 [html.light_&]:text-ink-900">{result.title}</span>
          {result.kind === 'finding' && result.status === 'resolved' ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-400 [html.light_&]:text-emerald-600">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Resolved
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11.5px] text-dimmer">{result.subtitle}</span>
      </span>
      {result.kind === 'device' ? (
        <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-medium capitalize text-dimmer">
          <Dot tone={tone} />
          {result.meta}
        </span>
      ) : result.kind === 'report' ? (
        <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-medium text-dimmer">
          <Dot tone={tone} />
          {result.meta === 'ready' ? 'Report ready' : 'Not generated'}
        </span>
      ) : (
        <SeverityBadge severity={result.meta as 'critical' | 'high' | 'medium' | 'low'} size="sm" />
      )}
    </button>
  );
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const results = useGlobalSearch(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useScrollLock(open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  const flat = useMemo(
    () => [...results.devices, ...results.findings, ...results.settings, ...results.reports],
    [results],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const go = (result: SearchResult) => {
    onClose();
    if (result.kind === 'device') {
      navigate(`/devices/${result.deviceId}`);
      return;
    }
    if (result.kind === 'finding') {
      navigate(`/issues?focus=${encodeURIComponent(result.id)}`);
      return;
    }
    if (result.kind === 'report') {
      navigate(`/reports?report=${result.reportKind}`);
      return;
    }
    if (result.deviceId) {
      navigate(`/devices/${result.deviceId}?tab=configuration&fix=${encodeURIComponent(result.configItemId)}`);
    }
  };

  let cursor = -1;
  const indexOf = () => {
    cursor += 1;
    return cursor;
  };

  if (!open) return null;

  const renderGroup = (label: string, items: SearchResult[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <GroupLabel count={items.length}>{label}</GroupLabel>
        {items.map((result) => {
          const index = indexOf();
          return (
            <ResultRow
              key={`${label}-${result.id}`}
              result={result}
              active={index === activeIndex}
              onHover={() => setActiveIndex(index)}
              onSelect={() => go(result)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center p-3 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px] [html.light_&]:bg-ink-900/45"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative w-full max-w-2xl animate-scale-in overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-pop [html.light_&]:border-ink-200 [html.light_&]:bg-white">
        <div className="flex items-center gap-2.5 border-b border-ink-700/70 px-3.5 py-3 [html.light_&]:border-ink-100">
          <Search className="h-4 w-4 shrink-0 text-dimmer" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, flat.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === 'Enter' && flat[activeIndex]) {
                go(flat[activeIndex]);
              }
            }}
            placeholder="Search devices, security issues, settings and reports…"
            aria-label="Search devices, issues, settings and reports"
            className="w-full bg-transparent text-[13.5px] text-ink-50 outline-none placeholder:text-dimmer [html.light_&]:text-ink-900"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="rounded p-1 text-dimmer hover:text-ink-100 [html.light_&]:hover:text-ink-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <kbd className="hidden shrink-0 rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] text-dimmer sm:block [html.light_&]:border-ink-200">
            Esc
          </kbd>
        </div>

        <div className="max-h-[56vh] overflow-y-auto scroll-thin pb-2">
          {query.trim().length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[12.5px] font-medium text-ink-200 [html.light_&]:text-ink-800">Search the estate</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[11.5px] leading-relaxed text-dimmer">
                Try a device name (<span className="font-mono text-accent-400">Core-Router-01</span>), a finding (
                <span className="font-mono text-accent-400">Telnet</span>) or a setting (
                <span className="font-mono text-accent-400">Password Policy</span>).
              </p>
            </div>
          ) : results.total === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              tone="neutral"
              title={`No matches for “${query}”`}
              description="Try a device name, an IP address, a finding title or a configuration setting."
            />
          ) : (
            <>
              {renderGroup('Devices', results.devices)}
              {renderGroup('Security issues', results.findings)}
              {renderGroup('Configuration settings', results.settings)}
              {renderGroup('Reports', results.reports)}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-700/70 px-3.5 py-2 text-[11px] text-dimmer [html.light_&]:border-ink-100">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-ink-600 px-1 font-mono text-[10px] [html.light_&]:border-ink-200">↑</kbd>
              <kbd className="rounded border border-ink-600 px-1 font-mono text-[10px] [html.light_&]:border-ink-200">↓</kbd>
              to navigate
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-ink-600 px-1 font-mono text-[10px] [html.light_&]:border-ink-200">
                <CornerDownLeft className="h-2.5 w-2.5" aria-hidden />
              </kbd>
              to open
            </span>
          </span>
          <span>{results.total} result{results.total === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
