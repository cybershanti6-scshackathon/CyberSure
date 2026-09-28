import type { DeviceType } from '@/types';

/* =============================================================================
 * Demo network topology
 * -----------------------------------------------------------------------------
 * A static, hand-placed diagram of the fictional estate. Coordinates live
 * in a virtual 1000 x 480 space; the component scales them to the container.
 * ========================================================================== */

export interface TopologyNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  kind: DeviceType | 'internet';
  deviceId?: string;
}

export interface TopologyLink {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export const TOPOLOGY_WIDTH = 1000;
export const TOPOLOGY_HEIGHT = 480;

export const TOPOLOGY_NODES: TopologyNode[] = [
  { id: 'internet', label: 'Internet', sublabel: 'Untrusted', x: 350, y: 40, kind: 'internet' },
  { id: 'edge-firewall', label: 'Edge-Firewall-01', sublabel: 'FortiGate 200F', x: 350, y: 132, kind: 'firewall', deviceId: 'dev-edge-firewall-01' },
  { id: 'branch-firewall', label: 'Branch-FW-01', sublabel: 'PA-322', x: 770, y: 132, kind: 'firewall', deviceId: 'dev-branch-fw-01' },
  { id: 'mgmt-gateway', label: 'Mgmt-Gateway-01', sublabel: 'CCR2004 · OOB', x: 110, y: 132, kind: 'router', deviceId: 'dev-mgmt-gateway-01' },
  { id: 'core-router', label: 'Core-Router-01', sublabel: 'ISR 4451', x: 350, y: 228, kind: 'router', deviceId: 'dev-core-router-01' },
  { id: 'branch-router', label: 'Branch-Router-02', sublabel: 'MX204', x: 770, y: 228, kind: 'router', deviceId: 'dev-branch-router-02' },
  { id: 'dist-switch', label: 'Dist-Switch-02', sublabel: 'C9500-24Q', x: 250, y: 330, kind: 'switch', deviceId: 'dev-dist-switch-02' },
  { id: 'access-switch', label: 'Access-Switch-01', sublabel: 'C9300-48P', x: 450, y: 330, kind: 'switch', deviceId: 'dev-access-switch-01' },
  { id: 'lab-switch', label: 'Lab-Switch-01', sublabel: 'CRS326 · offline', x: 650, y: 330, kind: 'switch', deviceId: 'dev-lab-switch-01' },
  { id: 'app-server', label: 'App-Server-01', sublabel: 'UCS C220 M5', x: 250, y: 434, kind: 'server', deviceId: 'dev-app-server-01' },
  { id: 'wlc', label: 'Wireless-Controller-01', sublabel: 'Aruba 8320', x: 450, y: 434, kind: 'wireless-controller', deviceId: 'dev-wireless-controller-01' },
  { id: 'guest-wlc', label: 'Guest-WLC-02', sublabel: 'Aruba 2530', x: 650, y: 434, kind: 'wireless-controller', deviceId: 'dev-guest-wlc-02' },
];

export const TOPOLOGY_LINKS: TopologyLink[] = [
  { from: 'internet', to: 'edge-firewall' },
  { from: 'internet', to: 'branch-firewall' },
  { from: 'internet', to: 'mgmt-gateway', dashed: true, label: 'OOB' },
  { from: 'edge-firewall', to: 'core-router' },
  { from: 'edge-firewall', to: 'mgmt-gateway', dashed: true },
  { from: 'branch-firewall', to: 'branch-router' },
  { from: 'core-router', to: 'dist-switch' },
  { from: 'core-router', to: 'access-switch' },
  { from: 'core-router', to: 'lab-switch', dashed: true },
  { from: 'dist-switch', to: 'app-server' },
  { from: 'access-switch', to: 'wlc' },
  { from: 'access-switch', to: 'guest-wlc' },
];
