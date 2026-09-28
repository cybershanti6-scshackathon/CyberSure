import type { BaselineTemplate, DeviceType } from '@/types';
import { CONFIG_SCHEMA } from './configSchema';

/* =============================================================================
 * Configuration baseline templates
 * -----------------------------------------------------------------------------
 * A small curated set of hardening baselines. Applying a template only rewrites
 * the simulated configuration inside the prototype — nothing is pushed to a
 * real device.
 * ========================================================================== */

const idsStartingWith = (prefixes: string[]): string[] =>
  CONFIG_SCHEMA.filter((item) => prefixes.some((prefix) => item.id.startsWith(prefix))).map((item) => item.id);

const shared = ['mgmt.', 'auth.', 'log.', 'sys.'];

export const BASELINE_TEMPLATES: BaselineTemplate[] = [
  {
    id: 'secure-router-baseline',
    name: 'Secure Router Baseline',
    description:
      'Hardened baseline for edge and branch routers: encrypted management only, restricted management sources, MFA-protected privileged access and a complete audit trail.',
    appliesTo: ['router'],
    appliesToLabel: 'Routers',
    settings: idsStartingWith([...shared, 'enc.sshCipher', 'enc.ikePolicy', 'fw.managementZone']),
    checks: [
      'Telnet and plain HTTP management are disabled',
      'Management ACL restricted to approved internal subnets',
      'MFA enforced for all privileged logins',
      'Configuration change logging enabled and exported off-device',
      'SSH cipher restricted to AES-GCM',
    ],
  },
  {
    id: 'secure-firewall-baseline',
    name: 'Secure Firewall Baseline',
    description:
      'Perimeter hardening baseline: default-deny rule base, no permit-any rules, encrypted credentials and full session logging.',
    appliesTo: ['firewall'],
    appliesToLabel: 'Firewalls',
    settings: idsStartingWith([...shared, 'fw.', 'enc.']),
    checks: [
      'Default inbound and inter-zone policies are DENY',
      'No permit any / permit any rule in the rule base',
      'Shared secrets stored encrypted (AES-256)',
      'Firewall session logging enabled and forwarded to the SIEM',
      'IKEv2 and TLS 1.2+ enforced for tunnels and management',
    ],
  },
  {
    id: 'secure-switch-baseline',
    name: 'Secure Switch Baseline',
    description:
      'Access and distribution switch baseline: encrypted management, strict authentication and change logging with automated configuration backup.',
    appliesTo: ['switch'],
    appliesToLabel: 'Switches',
    checks: [
      'SSH enabled and Telnet disabled on the management VLAN',
      'Management ACL restricted to the NOC and jump-host subnets',
      'FTP and TFTP disabled — SFTP only for transfers',
      'Configuration change logging with daily off-device backup',
      'Console session timeout of 15 minutes or less',
    ],
    settings: idsStartingWith([...shared, 'enc.sshCipher', 'svc.ftp', 'svc.tftp', 'svc.snmpVersion']),
  },
];

export function templatesForType(type: DeviceType): BaselineTemplate[] {
  return BASELINE_TEMPLATES.filter((template) => template.appliesTo.includes(type));
}

export function templateById(id: string): BaselineTemplate | undefined {
  return BASELINE_TEMPLATES.find((template) => template.id === id);
}
