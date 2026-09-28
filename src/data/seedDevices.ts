import type { Device, DeviceConfig, DeviceType, Vendor } from '@/types';
import { schemaForType } from './configSchema';

/* =============================================================================
 * Seed data
 * -----------------------------------------------------------------------------
 * These 12 devices are fictional assets. No CYBERSURE deployment is
 * connected to them and no command is ever executed against them.
 *
 * A device's configuration is materialised from the shared schema: every
 * applicable setting starts at its baseline (recommended) value, and the
 * `deviations` map below records the exact settings this demo device has
 * drifted away from baseline. That is what produces the security findings.
 * ========================================================================== */

/** Vendor-specific OS/firmware strings for realistic device detail pages. */
const OS_BY_VENDOR: Record<Vendor, Partial<Record<DeviceType, string>>> = {
  Cisco: { router: 'IOS XE 17.9.4a', switch: 'IOS 15.2(7)E10', server: 'NX-OS 10.2(3)F' },
  Fortinet: { firewall: 'FortiOS 7.2.5 build1517' },
  'Palo Alto Networks': { firewall: 'PAN-OS 10.2.3' },
  Juniper: { router: 'Junos 21.4R3-S3.4' },
  MikroTik: { router: 'RouterOS 7.13.3 (stable)', switch: 'RouterOS 7.11.2 (stable)' },
  Aruba: { 'wireless-controller': 'ArubaOS 8.10.0.10' },
  Arista: { switch: 'EOS 4.29.2F' },
  Huawei: { router: 'VRP 8.20 (V300R021)' },
  Vyatta: { router: 'VyOS 1.4.9' },
  Other: {},
};

const COLLECTED_VIA: Record<Vendor, string> = {
  Cisco: 'NETCONF / SSHv2 snapshot',
  Fortinet: 'REST API v2 (demo collector)',
  'Palo Alto Networks': 'XML API (demo collector)',
  Juniper: 'JUNOS REST snapshot',
  MikroTik: 'REST API (demo collector)',
  Aruba: 'REST API (demo collector)',
  Arista: 'eAPI snapshot (demo collector)',
  Huawei: 'NETCONF / SSHv2 snapshot',
  Vyatta: 'CLI snapshot (demo collector)',
  Other: 'CLI snapshot (demo collector)',
};

interface DeviceSeed {
  id: string;
  name: string;
  type: DeviceType;
  vendor: Vendor;
  model: string;
  ipAddress: string;
  serial: string;
  site: string;
  environment: Device['environment'];
  status: Device['status'];
  lastScan: string;
  configVersion: string;
  /** Setting id -> value configured on this device (drift from baseline). */
  deviations?: Record<string, string>;
}

const DEVICE_SEEDS: DeviceSeed[] = [
  {
    id: 'dev-core-router-01',
    name: 'Core-Router-01',
    type: 'router',
    vendor: 'Cisco',
    model: 'Cisco ISR 4451 / ASR1002',
    ipAddress: '10.0.0.1',
    serial: 'FDO-2417-A3C91',
    site: 'HQ · Building A · MDF',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:04:00Z',
    configVersion: 'cfg-1841',
    deviations: {
      'mgmt.telnet': 'Enabled',
      'auth.passwordPolicy': 'Weak',
    },
  },
  {
    id: 'dev-edge-firewall-01',
    name: 'Edge-Firewall-01',
    type: 'firewall',
    vendor: 'Fortinet',
    model: 'FortiGate 200F',
    ipAddress: '10.0.0.254',
    serial: 'FGVMEV2419004317',
    site: 'HQ · DMZ edge',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:06:00Z',
    configVersion: 'cfg-3907',
    deviations: {
      'fw.defaultInbound': 'ALLOW',
      'enc.passwordStorage': 'Plaintext',
      'log.firewall': 'Disabled',
    },
  },
  {
    id: 'dev-access-switch-01',
    name: 'Access-Switch-01',
    type: 'switch',
    vendor: 'Cisco',
    model: 'Cisco Catalyst C9300-48P',
    ipAddress: '10.0.10.2',
    serial: 'FCW2511L0AB',
    site: 'HQ · Floor 2 IDF',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:07:00Z',
    configVersion: 'cfg-0912',
  },
  {
    id: 'dev-branch-fw-01',
    name: 'Branch-FW-01',
    type: 'firewall',
    vendor: 'Palo Alto Networks',
    model: 'PA-322',
    ipAddress: '10.10.0.1',
    serial: '001801094472',
    site: 'Branch · Manchester',
    environment: 'Branch',
    status: 'online',
    lastScan: '2026-09-25T17:42:00Z',
    configVersion: 'cfg-2255',
    deviations: {
      'fw.intraZonePolicy': 'ALLOW',
    },
  },
  {
    id: 'dev-wireless-controller-01',
    name: 'Wireless-Controller-01',
    type: 'wireless-controller',
    vendor: 'Aruba',
    model: 'Aruba 8320-48Y8C',
    ipAddress: '10.20.0.10',
    serial: 'SG0ZBRK9C2L',
    site: 'HQ · Floor 2 IDF',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:09:00Z',
    configVersion: 'cfg-1440',
  },
  {
    id: 'dev-dist-switch-02',
    name: 'Dist-Switch-02',
    type: 'switch',
    vendor: 'Cisco',
    model: 'Cisco Catalyst C9500-24Q',
    ipAddress: '10.0.11.3',
    serial: 'FCW2522L0ZZ',
    site: 'HQ · Floor 3 IDF',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:11:00Z',
    configVersion: 'cfg-1683',
    deviations: {
      'mgmt.mgmtAcl': '0.0.0.0/0',
      'svc.tftp': 'Enabled',
    },
  },
  {
    id: 'dev-branch-router-02',
    name: 'Branch-Router-02',
    type: 'router',
    vendor: 'Juniper',
    model: 'Juniper MX204',
    ipAddress: '10.10.0.254',
    serial: 'JN8712C0A118',
    site: 'Branch · Manchester',
    environment: 'Branch',
    status: 'online',
    lastScan: '2026-09-25T17:45:00Z',
    configVersion: 'cfg-0771',
    deviations: {
      'enc.ikePolicy': 'IKEv1',
      'svc.snmpVersion': 'v2c',
    },
  },
  {
    id: 'dev-dmz-web-fw-01',
    name: 'DMZ-Web-FW-01',
    type: 'firewall',
    vendor: 'Fortinet',
    model: 'FortiGate 100E',
    ipAddress: '10.5.0.1',
    serial: 'FGVMEV2318011664',
    site: 'HQ · DMZ segment',
    environment: 'DMZ',
    status: 'online',
    lastScan: '2026-09-25T18:14:00Z',
    configVersion: 'cfg-3312',
    deviations: {
      'fw.defaultInbound': 'ALLOW',
      'sys.dnsServers': '8.8.8.8, 8.8.4.4',
      'sys.backupSchedule': 'Weekly',
    },
  },
  {
    id: 'dev-lab-switch-01',
    name: 'Lab-Switch-01',
    type: 'switch',
    vendor: 'MikroTik',
    model: 'MikroTik CRS326-24G-2S+',
    ipAddress: '10.30.0.2',
    serial: 'H4X9JAB41C',
    site: 'HQ · Lab bench 4',
    environment: 'Lab',
    status: 'offline',
    lastScan: '2026-09-24T09:15:00Z',
    configVersion: 'cfg-0418',
    deviations: {
      'mgmt.telnet': 'Enabled',
      'enc.sshCipher': 'DES-CBC',
    },
  },
  {
    id: 'dev-guest-wlc-02',
    name: 'Guest-WLC-02',
    type: 'wireless-controller',
    vendor: 'Aruba',
    model: 'Aruba 2530-48G',
    ipAddress: '10.21.0.10',
    serial: 'SG0ZBRKD91M',
    site: 'HQ · Guest lobby',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:16:00Z',
    configVersion: 'cfg-1301',
    deviations: {
      'enc.wifiCipher': 'WPA2-PSK',
      'auth.mfa': 'Disabled',
    },
  },
  {
    id: 'dev-app-server-01',
    name: 'App-Server-01',
    type: 'server',
    vendor: 'Cisco',
    model: 'Cisco UCS C220 M5',
    ipAddress: '10.40.0.11',
    serial: 'CIMC2219F0AB',
    site: 'HQ · DC rack 12',
    environment: 'Production',
    status: 'online',
    lastScan: '2026-09-25T18:19:00Z',
    configVersion: 'cfg-5094',
    deviations: {
      'enc.tlsVersion': 'SSLv3',
      'enc.passwordStorage': 'Plaintext',
    },
  },
  {
    id: 'dev-mgmt-gateway-01',
    name: 'Mgmt-Gateway-01',
    type: 'router',
    vendor: 'MikroTik',
    model: 'MikroTik CCR2004-1G-12S+2XS',
    ipAddress: '10.99.0.1',
    serial: '7T4K2XQ1PN',
    site: 'HQ · Out-of-band management',
    environment: 'Management',
    status: 'online',
    lastScan: '2026-09-25T18:21:00Z',
    configVersion: 'cfg-0620',
    deviations: {
      'sys.firmwareSupport': 'End-of-Life',
      'auth.passwordPolicy': 'None',
      'auth.lockout': 'Disabled',
    },
  },
];

/** Build a device's configuration record: baseline + this device's deviations. */
function buildConfig(seed: DeviceSeed): DeviceConfig {
  const values: Record<string, string> = {};
  for (const def of schemaForType(seed.type)) {
    values[def.id] = seed.deviations?.[def.id] ?? def.recommended;
  }
  return {
    values,
    osVersion: OS_BY_VENDOR[seed.vendor]?.[seed.type] ?? 'Vendor OS 12.4.3',
    configVersion: seed.configVersion,
    collectedVia: COLLECTED_VIA[seed.vendor],
  };
}

export const seedDevices: Device[] = DEVICE_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  type: seed.type,
  vendor: seed.vendor,
  model: seed.model,
  ipAddress: seed.ipAddress,
  serial: seed.serial,
  site: seed.site,
  environment: seed.environment,
  status: seed.status,
  lastScan: seed.lastScan,
  config: buildConfig(seed),
}));

export const seedConfigMap: Record<string, DeviceConfig> = Object.fromEntries(
  seedDevices.map((device) => [device.id, device.config]),
);
