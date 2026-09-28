import { Cloud, ShieldCheck, Router, Network, Server, Wifi, Lock, ServerCog, Radio } from 'lucide-react';

/* =============================================================================
 * Landing hero network animation
 * -----------------------------------------------------------------------------
 * The right-hand visual of the home page hero. It draws the path CYBERSURE
 * actually models — Internet → Firewall → Router → Switch / Wireless Firewall →
 * Servers & Endpoints — as an SVG graph with:
 *
 *   • animated link traces between the nodes
 *   • data packets travelling along each link, staggered by a fixed delay
 *   • a slow pulse ring on each device node
 *   • a sweeping "scan" line over the whole graph
 *
 * It is deliberately restrained: a handful of low-opacity shapes, no flashing,
 * no counters and no decorative statistics. It uses only the project's existing
 * device names and addresses, and it degrades to a static diagram when the user
 * prefers reduced motion.
 * ========================================================================== */

interface HeroNode {
  id: string;
  x: number;
  y: number;
  label: string;
  sub: string;
  icon: typeof Cloud;
  tone: Tone;
}

/** Fixed layout in a 360x430 viewBox. Hand-placed so the graph stays stable. */
const NODES: HeroNode[] = [
  { id: 'internet', x: 180, y: 44, label: 'Internet', sub: 'Untrusted', icon: Cloud, tone: 'neutral' },
  { id: 'firewall', x: 180, y: 136, label: 'Edge-Firewall-01', sub: 'Fortinet · 10.0.0.254', icon: ShieldCheck, tone: 'critical' },
  { id: 'router', x: 180, y: 228, label: 'Core-Router-01', sub: 'Cisco · 10.0.0.1', icon: Router, tone: 'high' },
  { id: 'switch', x: 96, y: 320, label: 'Access-Switch-01', sub: 'Cisco · 10.0.10.2', icon: Network, tone: 'medium' },
  { id: 'branch', x: 264, y: 320, label: 'Branch-FW-01', sub: 'Palo Alto · 10.10.0.1', icon: ServerCog, tone: 'medium' },
  { id: 'wireless', x: 96, y: 400, label: 'Wireless-Controller-01', sub: 'Aruba · 10.20.0.10', icon: Wifi, tone: 'ok' },
  { id: 'servers', x: 264, y: 400, label: 'Servers / Endpoints', sub: '10.40.0.0/24', icon: Server, tone: 'ok' },
] as const;

/** Edges: trunk links are solid, secondary links are dashed. */
const LINKS: { from: string; to: string; dashed?: boolean }[] = [
  { from: 'internet', to: 'firewall' },
  { from: 'firewall', to: 'router' },
  { from: 'router', to: 'switch' },
  { from: 'router', to: 'branch' },
  { from: 'switch', to: 'wireless', dashed: true },
  { from: 'branch', to: 'servers', dashed: true },
];

type Tone = 'neutral' | 'critical' | 'high' | 'medium' | 'ok';

const NODE_RING: Record<Tone, string> = {
  neutral: 'stroke-ink-400/50 [html.light_&]:stroke-ink-500/45',
  critical: 'stroke-red-500/55',
  high: 'stroke-orange-500/55',
  medium: 'stroke-amber-500/55',
  ok: 'stroke-emerald-500/55',
};

const NODE_FILL: Record<Tone, string> = {
  neutral: 'bg-ink-800 [html.light_&]:bg-white',
  critical: 'bg-red-500/10',
  high: 'bg-orange-500/10',
  medium: 'bg-amber-500/10',
  ok: 'bg-emerald-500/10',
};

const NODE_ICON: Record<Tone, string> = {
  neutral: 'text-ink-300 [html.light_&]:text-ink-600',
  critical: 'text-red-400 [html.light_&]:text-red-600',
  high: 'text-orange-400 [html.light_&]:text-orange-600',
  medium: 'text-amber-400 [html.light_&]:text-amber-600',
  ok: 'text-emerald-400 [html.light_&]:text-emerald-600',
};

const NODE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-100 [html.light_&]:text-ink-800',
  critical: 'text-red-300 [html.light_&]:text-red-700',
  high: 'text-orange-300 [html.light_&]:text-orange-700',
  medium: 'text-amber-300 [html.light_&]:text-amber-700',
  ok: 'text-emerald-300 [html.light_&]:text-emerald-700',
};

const NODE_BY_ID = new Map(NODES.map((node) => [node.id, node]));

/** Slightly bowed path between two nodes, so the graph reads as a topology. */
function linkPath(from: HeroNode, to: HeroNode): string {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y + 22} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y - 22}`;
}

export function HeroTopology() {
  return (
    <div className="relative">
      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-2.5 [html.light_&]:border-ink-100">
          <p className="flex items-center gap-2 text-[12px] font-medium text-ink-100 [html.light_&]:text-ink-800">
            <Lock className="h-3.5 w-3.5 text-accent-400 [html.light_&]:text-accent-600" aria-hidden />
            Secured network path
          </p>
          <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-dimmer">
            <Radio className="h-3 w-3" aria-hidden />
            Live
          </p>
        </div>

        <div className="cybersure-anim relative px-3 py-4 sm:px-4">
          <div className="grid-noise pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          {/* Slow scan sweep across the graph. */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-accent-500/[0.07] to-transparent motion-reduce:hidden"
            aria-hidden
            style={{ animation: 'cybersure-sweep-x 7s ease-in-out infinite' }}
          />

          <svg
            viewBox="0 0 360 430"
            className="relative h-auto w-full"
            role="img"
            aria-label="Animated network path: internet traffic passes through the edge firewall and core router, then branches to the access switch and branch firewall, reaching the wireless controller and servers."
          >
            <defs>
              <linearGradient id="cybersure-link" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(120,160,220,0.55)" />
                <stop offset="100%" stopColor="rgba(120,160,220,0.16)" />
              </linearGradient>
              <linearGradient id="cybersure-packet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--cybersure-packet-a)" />
                <stop offset="100%" stopColor="var(--cybersure-packet-b)" />
              </linearGradient>
            </defs>

            {/* Links + travelling packets */}
            {LINKS.map((link, index) => {
              const from = NODE_BY_ID.get(link.from);
              const to = NODE_BY_ID.get(link.to);
              if (!from || !to) return null;
              const d = linkPath(from, to);
              const id = `${link.from}-${link.to}`;
              const isTrunk = index < 4;
              return (
                <g key={id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="url(#cybersure-link)"
                    strokeWidth={isTrunk ? 1.6 : 1.2}
                    strokeDasharray={link.dashed ? '5 5' : undefined}
                  />
                  {isTrunk ? (
                    <path
                      d={d}
                      fill="none"
                      stroke="rgba(69,163,255,0.28)"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      data-cybersure-flow=""
                      style={{ strokeDasharray: '18 240', animationDelay: `${index * 0.42}s` }}
                    />
                  ) : null}
                  {/* Packet head: a small glowing dot riding the same path. */}
                  <circle r={2.4} fill="var(--cybersure-packet-a)" opacity={0.9}>
                    <animateMotion
                      dur={`${3.6 + index * 0.2}s`}
                      begin={`${index * 0.5}s`}
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                </g>
              );
            })}

            {/* Nodes */}
            {NODES.map((node, index) => {
              const Icon = node.icon;
              return (
                <g key={node.id}>
                  {/* Pulse ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={22}
                    fill="none"
                    strokeWidth={1.4}
                    className={NODE_RING[node.tone]}
                    data-cybersure-pulse=""
                    style={{ animationDelay: `${index * 0.35}s` }}
                  />
                  {/* Node body (icon rendered as HTML-free vector block below) */}
                  <rect
                    x={node.x - 21}
                    y={node.y - 16}
                    width={42}
                    height={32}
                    rx={9}
                    className={`${NODE_FILL[node.tone]} stroke-ink-600 [html.light_&]:stroke-ink-200`}
                    strokeWidth={1}
                  />
                  <foreignObject x={node.x - 11} y={node.y - 9} width={22} height={22}>
                    <div className="flex h-full w-full items-center justify-center">
                      <Icon className={`h-[18px] w-[18px] ${NODE_ICON[node.tone]}`} aria-hidden />
                    </div>
                  </foreignObject>
                  <text
                    x={node.x}
                    y={node.y + 32}
                    textAnchor="middle"
                    className={`fill-current text-[10.5px] font-semibold ${NODE_TEXT[node.tone]}`}
                  >
                    {node.label}
                  </text>
                  <text x={node.x} y={node.y + 44} textAnchor="middle" className="fill-current text-[9px] opacity-60">
                    {node.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
