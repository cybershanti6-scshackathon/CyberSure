import { useMemo, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import type { ConfigChange } from '@/types';
import { cx, formatDateTime, relativeTime, CHANGE_STATUS_LABEL, CHANGE_VALIDATION_LABEL } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Primitives';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useCyberSure } from '@/lib/store';
import { useNotify } from '@/components/ui/Toast';
import { VendorAvatar } from '@/components/common/Bits';

function StatusBadges({ change }: { change: ConfigChange }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge
        tone={
          change.validationStatus === 'validated'
            ? 'ok'
            : change.validationStatus === 'blocked'
              ? 'critical'
              : 'neutral'
        }
      >
        {CHANGE_VALIDATION_LABEL[change.validationStatus]}
      </Badge>
      <Badge
        tone={
          change.changeStatus === 'applied'
            ? 'ok'
            : change.changeStatus === 'reverted'
              ? 'critical'
              : 'medium'
        }
      >
        {CHANGE_STATUS_LABEL[change.changeStatus]}
      </Badge>
    </span>
  );
}

export function ChangeTable({
  changes,
  emptyLabel,
  showDevice = true,
  highlightId,
}: {
  changes: ConfigChange[];
  emptyLabel: string;
  showDevice?: boolean;
  highlightId?: string | null;
}) {
  const { revertChange } = useCyberSure();
  const notify = useNotify();
  const [selected, setSelected] = useState<ConfigChange | null>(null);
  const [pendingRevert, setPendingRevert] = useState<ConfigChange | null>(null);

  const sorted = useMemo(
    () => [...changes].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [changes],
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-5 w-5" />}
        tone="neutral"
        title="No configuration changes"
        description={emptyLabel}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-ink-700/70 scroll-thin [html.light_&]:border-ink-100">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <caption className="sr-only">Configuration change audit trail</caption>
          <thead>
            <tr className="border-b border-ink-700/70 text-[11px] uppercase tracking-[0.08em] text-dimmer">
              <th scope="col" className="px-3 py-2.5 font-semibold">Change</th>
              {showDevice ? <th scope="col" className="px-3 py-2.5 font-semibold">Device</th> : null}
              <th scope="col" className="px-3 py-2.5 font-semibold">Setting</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Old → New</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Validation</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Timestamp</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((change) => (
              <tr
                key={change.id}
                className={cx(
                  'border-b border-ink-700/40 transition-colors last:border-0 hover:bg-ink-850 [html.light_&]:hover:bg-ink-50',
                  highlightId === change.id && 'bg-accent-500/8',
                )}
              >
                <td className="px-3 py-2.5 font-mono text-[11.5px] text-dimmer">{change.id}</td>
                {showDevice ? (
                  <td className="px-3 py-2.5 text-[12px] font-medium text-ink-100 [html.light_&]:text-ink-800">
                    {change.deviceName}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 text-[12px] text-ink-200 [html.light_&]:text-ink-700">
                  <span className="block">{change.setting}</span>
                  <span className="block text-[10.5px] text-dimmer">{change.category}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11.5px]">
                  <span className="text-red-300 [html.light_&]:text-red-600">{change.oldValue}</span>
                  <span className="px-1.5 text-dimmer" aria-label="changed to">
                    →
                  </span>
                  <span className="text-emerald-300 [html.light_&]:text-emerald-600">{change.newValue}</span>
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadges change={change} />
                </td>
                <td className="px-3 py-2.5 text-[11.5px] text-dimmer">{relativeTime(change.timestamp)}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(change)}
                    className="text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="surface animate-slide-up p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                <span className="font-mono text-[12px] text-accent-400">{selected.id}</span>
                {selected.setting}
                <StatusBadges change={selected} />
              </p>
              <p className="mt-1 text-[12px] text-dim">
                {selected.deviceName} · {selected.category} · {selected.source.replace('-', ' ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selected.changeStatus === 'applied' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPendingRevert(selected)}
                  icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                >
                  Revert
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Previous value', value: selected.oldValue, tone: 'text-red-300 [html.light_&]:text-red-600' },
              { label: 'New value', value: selected.newValue, tone: 'text-emerald-300 [html.light_&]:text-emerald-600' },
              { label: 'Baseline value', value: selected.recommended || '—', tone: 'text-ink-200 [html.light_&]:text-ink-700' },
            ].map((entry) => (
              <div
                key={entry.label}
                className="rounded-lg border border-ink-700/60 bg-ink-850 px-2.5 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
              >
                <p className="eyebrow">{entry.label}</p>
                <p className={cx('mt-1 font-mono text-[12.5px] font-semibold', entry.tone)}>{entry.value}</p>
              </div>
            ))}
          </div>

          <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
            <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-ink-700/60 py-1.5 text-[12px] [html.light_&]:border-ink-100">
              <dt className="text-dimmer">Applied at</dt>
              <dd className="font-medium text-ink-100 [html.light_&]:text-ink-800">{formatDateTime(selected.timestamp)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-ink-700/60 py-1.5 text-[12px] [html.light_&]:border-ink-100">
              <dt className="text-dimmer">Actor</dt>
              <dd className="font-medium text-ink-100 [html.light_&]:text-ink-800">{selected.actor}</dd>
            </div>
          </dl>

          {selected.note ? (
            <p className="mt-2.5 rounded-lg border border-ink-700/60 bg-ink-850 px-3 py-2 text-[12px] leading-relaxed text-dim [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
              {selected.note}
            </p>
          ) : null}

          <p className="mt-2.5 text-[11px] text-dimmer">
            Simulated change — no real device was modified. This record is the prototype's simulated audit trail.
          </p>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingRevert)}
        title="Revert change"
        tone="danger"
        confirmLabel="Revert change"
        message={
          <>
            This restores <span className="font-mono">{pendingRevert?.setting}</span> on{' '}
            <span className="font-semibold">{pendingRevert?.deviceName}</span> to{' '}
            <span className="font-mono">{pendingRevert?.oldValue}</span> in the simulated configuration. The related
            security finding will re-open and the posture score will drop.
          </>
        }
        onCancel={() => setPendingRevert(null)}
        onConfirm={() => {
          if (!pendingRevert) return;
          revertChange(pendingRevert.id);
          notify.info(
            'Change reverted',
            `${pendingRevert.setting} on ${pendingRevert.deviceName} restored to “${pendingRevert.oldValue}”.`,
          );
          setPendingRevert(null);
          setSelected(null);
        }}
      />
    </div>
  );
}

export function ChangeDeviceAvatar({ change }: { change: ConfigChange }) {
  const { devices } = useCyberSure();
  const device = devices.find((candidate) => candidate.id === change.deviceId);
  return device ? <VendorAvatar vendor={device.vendor} size={22} /> : null;
}
