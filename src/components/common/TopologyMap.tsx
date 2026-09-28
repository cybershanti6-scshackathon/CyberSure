import { useNavigate } from 'react-router-dom';
import { Cloud, Network, Router, Server, ShieldCheck, Wifi } from 'lucide-react';
import type { DeviceType, SecurityStatus } from '@/types';
import {
  TOPOLOGY_HEIGHT,
  TOPOLOGY_LINKS,
  TOPOLOGY_NODES,
  TOPOLOGY_WIDTH,
  type TopologyNode,
} from '@/data/topology';
import { cx, DEVICE_TYPE_LABEL } from '@/utils/format';
import { Dot } from '@/components/ui/Badge';

const KIND_ICON: Record<DeviceType | 'internet', typeof Cloud> = {
  internet: Cloud,
  router: Router,
  switch: Network,
  firewall: ShieldCheck,
  'wireless-controller': Wifi,
  server: Server,
};

const SEVERITY_TONE: Record<SecurityStatus, 'ok' | 'critical' | 'high' | 'medium' | 'low'> = {
  compliant: 'ok',
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

function NodeShell({
  node,
  status,
  offline,
  onSelect,
}: {
  node: TopologyNode;
  status?: SecurityStatus;
  offline?: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[node.kind];
  const interactive = Boolean(node.deviceId);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!interactive}
      aria-label={
        interactive
          ? `Open ${node.label} device details (${DEVICE_TYPE_LABEL[node.kind as DeviceType]}, ${status ?? 'unknown'})`
          : `${node.label} — ${node.sublabel}`
      }
      className={cx(
        'flex w-[154px] -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition',
        interactive
          ? 'cursor-pointer hover:-translate-y-[calc(50%+2px)] hover:border-accent-500/60 focus-visible:-translate-y-[calc(50%+2px)]'
          : 'cursor-default',
        offline
          ? 'border-ink-700 border-dashed bg-ink-850/80 opacity-75 [html.light_&]:border-ink-200 [html.light_&]:bg-white'
          : node.kind === 'internet'
            ? 'border-ink-600 bg-ink-800 [html.light_&]:border-ink-200 [html.light_&]:bg-white'
            : 'border-ink-600 bg-ink-850 [html.light_&]:border-ink-200 [html.light_&]:bg-white',
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <Icon
          className={cx(
            'h-3.5 w-3.5 shrink-0',
            node.kind === 'internet' ? 'text-dimmer' : 'text-accent-400 [html.light_&]:text-accent-600',
          )}
          aria-hidden
        />
        <span className="truncate text-[11.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{node.label}</span>
      </span>
      <span className="flex w-full items-center gap-1.5">
        <span className="truncate text-[10px] text-dimmer">{node.sublabel}</span>
        {status ? (
          <span className="ml-auto flex items-center gap-1 text-[9.5px] font-medium uppercase tracking-wide text-dimmer">
            <Dot tone={SEVERITY_TONE[status]} />
            {status === 'compliant' ? 'OK' : status}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function TopologyMap({
  statusByDevice,
  offlineIds = [],
}: {
  statusByDevice: Record<string, SecurityStatus>;
  offlineIds?: string[];
}) {
  const navigate = useNavigate();
  const nodeById = new Map(TOPOLOGY_NODES.map((node) => [node.id, node]));

  return (
    <div className="relative overflow-x-auto scroll-thin">
      <div className="relative min-w-[860px]" style={{ aspectRatio: `${TOPOLOGY_WIDTH} / ${TOPOLOGY_HEIGHT}` }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${TOPOLOGY_WIDTH} ${TOPOLOGY_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="link-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(120,160,220,0.55)" />
              <stop offset="100%" stopColor="rgba(120,160,220,0.18)" />
            </linearGradient>
          </defs>
          {TOPOLOGY_LINKS.map((link) => {
            const from = nodeById.get(link.from);
            const to = nodeById.get(link.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${link.from}-${link.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="url(#link-gradient)"
                strokeWidth={1.6}
                strokeDasharray={link.dashed ? '6 5' : undefined}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {TOPOLOGY_NODES.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{ left: `${(node.x / TOPOLOGY_WIDTH) * 100}%`, top: `${(node.y / TOPOLOGY_HEIGHT) * 100}%` }}
          >
            <NodeShell
              node={node}
              status={node.deviceId ? statusByDevice[node.deviceId] : undefined}
              offline={node.deviceId ? offlineIds.includes(node.deviceId) : false}
              onSelect={() => {
                if (node.deviceId) navigate(`/devices/${node.deviceId}`);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
