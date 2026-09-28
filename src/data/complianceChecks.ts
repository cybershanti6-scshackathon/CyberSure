import type { ComplianceCheck, FrameworkId, Severity } from '@/types';

/* =============================================================================
 * Demo compliance control set
 * -----------------------------------------------------------------------------
 * A deliberately small, curated checklist (not a certification platform). Each
 * control inspects one or more configuration settings on a device and returns
 * pass / fail / not-applicable. Framework scores are computed by weighting the
 * passing controls per framework.
 *
 * CIS / ISO 27001 / NIST references below are illustrative mappings for the
 * prototype. CYBERSURE is not certified against any of these frameworks and
 * makes no certification claim.
 * ========================================================================== */

const enum_ = 'Enabled';
const dis = 'Disabled';

const is = (v: string | undefined) => v !== undefined;

export const FRAMEWORK_META: Record<
  FrameworkId,
  { name: string; short: string; description: string; accent: string }
> = {
  cis: {
    name: 'CIS Benchmarks',
    short: 'CIS',
    description: 'Demo mapping to the configuration hardening benchmark families.',
    accent: '#3b82f6',
  },
  iso27001: {
    name: 'ISO/IEC 27001',
    short: 'ISO',
    description: 'Demo mapping to Annex A technical and organisational controls.',
    accent: '#8b5cf6',
  },
  nist: {
    name: 'NIST SP 800-53',
    short: 'NIST',
    description: 'Demo mapping to the NIST configuration control catalogue.',
    accent: '#14b8a6',
  },
};

export const COMPLIANCE_CHECKS: ComplianceCheck[] = [
  {
    id: 'secure-remote-admin',
    name: 'Encrypted remote administration only',
    requirement: 'Remote administration must use an encrypted protocol; cleartext protocols must be disabled.',
    category: 'Management Access',
    weight: 10,
    severity: 'high',
    frameworks: ['cis', 'nist'],
    inspects: ['mgmt.ssh', 'mgmt.telnet'],
    evaluate: (v) => (v['mgmt.ssh'] === enum_ && v['mgmt.telnet'] === dis ? 'pass' : 'fail'),
    currentState: (v) => `SSH ${v['mgmt.ssh'] ?? 'n/a'} · Telnet ${v['mgmt.telnet'] ?? 'n/a'}`,
    expectedState: 'SSH Enabled · Telnet Disabled',
    remediation: 'Enable SSHv2 and disable the Telnet listener on the management interface.',
  },
  {
    id: 'no-telnet',
    name: 'Telnet service disabled',
    requirement: 'The Telnet service must be disabled on all network devices.',
    category: 'Management Access',
    weight: 8,
    severity: 'high',
    frameworks: ['cis', 'iso27001', 'nist'],
    inspects: ['mgmt.telnet'],
    evaluate: (v) => (v['mgmt.telnet'] === dis ? 'pass' : 'fail'),
    currentState: (v) => `Telnet ${v['mgmt.telnet'] ?? 'n/a'}`,
    expectedState: 'Telnet Disabled',
    remediation: 'Disable Telnet and manage the device over SSHv2.',
  },
  {
    id: 'no-http-mgmt',
    name: 'Unencrypted HTTP management disabled',
    requirement: 'The plain HTTP management listener must be disabled; HTTPS must be used instead.',
    category: 'Management Access',
    weight: 8,
    severity: 'high',
    frameworks: ['cis', 'nist'],
    inspects: ['mgmt.http'],
    evaluate: (v) => (v['mgmt.http'] === dis ? 'pass' : 'fail'),
    currentState: (v) => `HTTP management ${v['mgmt.http'] ?? 'n/a'}`,
    expectedState: 'HTTP Disabled',
    remediation: 'Disable the HTTP listener and redirect operators to the HTTPS interface.',
  },
  {
    id: 'https-mgmt',
    name: 'HTTPS management interface enabled',
    requirement: 'A TLS-protected management interface must be available to operators.',
    category: 'Management Access',
    weight: 6,
    severity: 'medium',
    frameworks: ['cis', 'iso27001'],
    inspects: ['mgmt.https'],
    evaluate: (v) => (v['mgmt.https'] === enum_ ? 'pass' : 'fail'),
    currentState: (v) => `HTTPS ${v['mgmt.https'] ?? 'n/a'}`,
    expectedState: 'HTTPS Enabled',
    remediation: 'Enable the HTTPS management interface on the in-band management VLAN.',
  },
  {
    id: 'mgmt-source-restriction',
    name: 'Management access restricted to trusted sources',
    requirement: 'Administrative sessions must only be accepted from approved internal subnets.',
    category: 'Management Access',
    weight: 10,
    severity: 'critical',
    frameworks: ['cis', 'nist'],
    inspects: ['mgmt.mgmtAcl'],
    evaluate: (v) => {
      const acl = v['mgmt.mgmtAcl'];
      if (!is(acl)) return 'na';
      const unrestricted = acl.includes('0.0.0.0/0') || acl.trim() === 'any';
      return unrestricted ? 'fail' : 'pass';
    },
    currentState: (v) => `Mgmt ACL: ${v['mgmt.mgmtAcl'] ?? 'n/a'}`,
    expectedState: 'Restricted to approved internal subnets',
    remediation: 'Replace the any/any management ACL with the approved NOC and jump-host subnets.',
  },
  {
    id: 'session-timeout',
    name: 'Privileged session timeout enforced',
    requirement: 'Interactive administrative sessions must terminate after a short idle period.',
    category: 'Management Access',
    weight: 5,
    severity: 'medium',
    frameworks: ['iso27001'],
    inspects: ['mgmt.consoleTimeout'],
    evaluate: (v) => {
      const raw = v['mgmt.consoleTimeout'];
      if (!is(raw)) return 'na';
      const minutes = Number(raw);
      return Number.isFinite(minutes) && minutes > 0 && minutes <= 15 ? 'pass' : 'fail';
    },
    currentState: (v) => `Console timeout: ${v['mgmt.consoleTimeout'] ?? 'n/a'} minutes`,
    expectedState: '15 minutes or less',
    remediation: 'Reduce the console idle timeout to 5-15 minutes.',
  },
  {
    id: 'strong-password-policy',
    name: 'Strong password policy enforced',
    requirement: 'Local and shared credentials must follow a strong password policy.',
    category: 'Authentication',
    weight: 10,
    severity: 'medium',
    frameworks: ['cis', 'iso27001', 'nist'],
    inspects: ['auth.passwordPolicy'],
    evaluate: (v) => (v['auth.passwordPolicy'] === 'Strong' ? 'pass' : 'fail'),
    currentState: (v) => `Password policy: ${v['auth.passwordPolicy'] ?? 'n/a'}`,
    expectedState: 'Strong (16+ chars, complexity, rotation)',
    remediation: 'Apply the Strong password policy to local and TACACS+ accounts.',
  },
  {
    id: 'mfa-admin',
    name: 'Multi-factor authentication for administrators',
    requirement: 'Privileged logins must require a second authentication factor.',
    category: 'Authentication',
    weight: 10,
    severity: 'high',
    frameworks: ['iso27001', 'nist'],
    inspects: ['auth.mfa'],
    evaluate: (v) => (v['auth.mfa'] === enum_ ? 'pass' : 'fail'),
    currentState: (v) => `MFA ${v['auth.mfa'] ?? 'n/a'}`,
    expectedState: 'MFA Enabled',
    remediation: 'Enable MFA for all privileged and administrative accounts.',
  },
  {
    id: 'login-lockout',
    name: 'Failed login lockout enabled',
    requirement: 'Repeated failed logins must lock the account within a small number of attempts.',
    category: 'Authentication',
    weight: 6,
    severity: 'medium',
    frameworks: ['cis', 'nist'],
    inspects: ['auth.lockout', 'auth.lockoutThreshold'],
    evaluate: (v) => {
      if (v['auth.lockout'] !== enum_) return 'fail';
      const threshold = Number(v['auth.lockoutThreshold']);
      return !Number.isFinite(threshold) || threshold < 3 || threshold > 10 ? 'fail' : 'pass';
    },
    currentState: (v) => `Lockout ${v['auth.lockout'] ?? 'n/a'} · threshold ${v['auth.lockoutThreshold'] ?? 'n/a'}`,
    expectedState: 'Lockout Enabled · threshold 3-10',
    remediation: 'Enable lockout and set the threshold between 3 and 10 attempts.',
  },
  {
    id: 'account-attribution',
    name: 'Named accounts only (no shared logins)',
    requirement: 'Every administrative action must be attributable to an individual account.',
    category: 'Authentication',
    weight: 5,
    severity: 'medium',
    frameworks: ['iso27001'],
    inspects: ['auth.sharedAccounts'],
    evaluate: (v) => (v['auth.sharedAccounts'] === dis ? 'pass' : 'fail'),
    currentState: (v) => `Shared accounts ${v['auth.sharedAccounts'] ?? 'n/a'}`,
    expectedState: 'Shared accounts Absent',
    remediation: 'Remove shared admin logins and provision named accounts.',
  },
  {
    id: 'default-deny-inbound',
    name: 'Default inbound policy is deny',
    requirement: 'Unmatched inbound traffic must be denied by default at the perimeter.',
    category: 'Firewall',
    weight: 12,
    severity: 'critical',
    frameworks: ['cis', 'iso27001', 'nist'],
    inspects: ['fw.defaultInbound'],
    evaluate: (v) => {
      const value = v['fw.defaultInbound'];
      if (!is(value)) return 'na';
      return value === 'DENY' ? 'pass' : 'fail';
    },
    currentState: (v) => `Default inbound: ${v['fw.defaultInbound'] ?? 'n/a'}`,
    expectedState: 'Default Inbound DENY',
    remediation: 'Set the default inbound policy to DENY and add explicit allow rules per service.',
  },
  {
    id: 'no-any-any',
    name: 'No permit any / permit any rules',
    requirement: 'The rule base must not contain a rule permitting any source to any destination.',
    category: 'Firewall',
    weight: 12,
    severity: 'critical',
    frameworks: ['cis', 'nist'],
    inspects: ['fw.anyAnyRule'],
    evaluate: (v) => {
      if (!is(v['fw.anyAnyRule'])) return 'na';
      return v['fw.anyAnyRule'] === dis ? 'pass' : 'fail';
    },
    currentState: (v) => `Any/any rule ${v['fw.anyAnyRule'] ?? 'n/a'}`,
    expectedState: 'Any/Any Rule Absent',
    remediation: 'Delete the any/any rule and replace it with least-privilege rules.',
  },
  {
    id: 'inter-zone-segmentation',
    name: 'Inter-zone segmentation enforced',
    requirement: 'Traffic between internal security zones must be denied by default.',
    category: 'Firewall',
    weight: 8,
    severity: 'high',
    frameworks: ['cis', 'iso27001'],
    inspects: ['fw.intraZonePolicy'],
    evaluate: (v) => {
      if (!is(v['fw.intraZonePolicy'])) return 'na';
      return v['fw.intraZonePolicy'] === 'DENY' ? 'pass' : 'fail';
    },
    currentState: (v) => `Inter-zone default: ${v['fw.intraZonePolicy'] ?? 'n/a'}`,
    expectedState: 'Inter-Zone DENY',
    remediation: 'Set the inter-zone default policy to DENY and define explicit zone pairs.',
  },
  {
    id: 'mgmt-zone-protection',
    name: 'Management zone protected',
    requirement: 'The management zone must be isolated from user and server zones.',
    category: 'Firewall',
    weight: 8,
    severity: 'high',
    frameworks: ['nist'],
    inspects: ['fw.managementZone'],
    evaluate: (v) => {
      if (!is(v['fw.managementZone'])) return 'na';
      return v['fw.managementZone'] === enum_ ? 'pass' : 'fail';
    },
    currentState: (v) => `Management zone protection ${v['fw.managementZone'] ?? 'n/a'}`,
    expectedState: 'Management Zone Protection Enabled',
    remediation: 'Enable management zone protection on the perimeter firewall.',
  },
  {
    id: 'firewall-logging',
    name: 'Firewall traffic logging enabled',
    requirement: 'Permitted and denied sessions must be recorded for investigation.',
    category: 'Logging',
    weight: 8,
    severity: 'medium',
    frameworks: ['cis', 'nist'],
    inspects: ['log.firewall'],
    evaluate: (v) => (v['log.firewall'] === enum_ ? 'pass' : 'fail'),
    currentState: (v) => `Firewall logging ${v['log.firewall'] ?? 'n/a'}`,
    expectedState: 'Firewall Logging Enabled',
    remediation: 'Enable firewall session logging and export events to the SIEM collector.',
  },
  {
    id: 'config-change-logging',
    name: 'Configuration change logging enabled',
    requirement: 'Every configuration commit must be logged with the responsible account.',
    category: 'Logging',
    weight: 8,
    severity: 'high',
    frameworks: ['cis', 'iso27001'],
    inspects: ['log.configChanges'],
    evaluate: (v) => (v['log.configChanges'] === enum_ ? 'pass' : 'fail'),
    currentState: (v) => `Config change logging ${v['log.configChanges'] ?? 'n/a'}`,
    expectedState: 'Config Logging Enabled',
    remediation: 'Enable configuration change logging on the device.',
  },
  {
    id: 'remote-log-collection',
    name: 'Logs collected off-device',
    requirement: 'Device logs must be forwarded to a central collector and retained.',
    category: 'Logging',
    weight: 6,
    severity: 'low',
    frameworks: ['iso27001', 'nist'],
    inspects: ['log.remoteSyslog', 'log.retentionDays'],
    evaluate: (v) => {
      if (v['log.remoteSyslog'] !== enum_) return 'fail';
      const days = Number(v['log.retentionDays']);
      return !Number.isFinite(days) || days < 30 ? 'fail' : 'pass';
    },
    currentState: (v) => `Remote syslog ${v['log.remoteSyslog'] ?? 'n/a'} · retention ${v['log.retentionDays'] ?? 'n/a'}d`,
    expectedState: 'Remote Syslog Enabled · retention ≥ 30 days',
    remediation: 'Enable remote syslog export and keep at least 30 days of local retention.',
  },
  {
    id: 'no-cleartext-transfer',
    name: 'Cleartext file transfer services disabled',
    requirement: 'FTP and TFTP must be disabled; use SFTP for file transfer.',
    category: 'Network Services',
    weight: 10,
    severity: 'high',
    frameworks: ['cis', 'iso27001', 'nist'],
    inspects: ['svc.ftp', 'svc.tftp'],
    evaluate: (v) => (v['svc.ftp'] === dis && v['svc.tftp'] === dis ? 'pass' : 'fail'),
    currentState: (v) => `FTP ${v['svc.ftp'] ?? 'n/a'} · TFTP ${v['svc.tftp'] ?? 'n/a'}`,
    expectedState: 'FTP Disabled · TFTP Disabled',
    remediation: 'Disable FTP and TFTP; transfer files over SFTP.',
  },
  {
    id: 'snmp-hardening',
    name: 'SNMPv3 or SNMP disabled',
    requirement: 'SNMP must use v3 with authentication/privacy, or be disabled entirely.',
    category: 'Network Services',
    weight: 6,
    severity: 'medium',
    frameworks: ['cis'],
    inspects: ['svc.snmpVersion'],
    evaluate: (v) => {
      const version = v['svc.snmpVersion'];
      if (!is(version)) return 'na';
      return version === 'v3' || version === 'Disabled' ? 'pass' : 'fail';
    },
    currentState: (v) => `SNMP ${v['svc.snmpVersion'] ?? 'n/a'}`,
    expectedState: 'SNMPv3 or SNMP disabled',
    remediation: 'Migrate monitoring to SNMPv3 with authentication and privacy.',
  },
  {
    id: 'least-functionality',
    name: 'Least functionality (no unused services)',
    requirement: 'Services with no observed usage must be disabled to reduce attack surface.',
    category: 'Network Services',
    weight: 5,
    severity: 'low',
    frameworks: ['nist'],
    inspects: ['svc.unusedServices'],
    evaluate: (v) => {
      const count = Number(v['svc.unusedServices']);
      if (!Number.isFinite(count)) return 'na';
      return count <= 0 ? 'pass' : 'fail';
    },
    currentState: (v) => `${v['svc.unusedServices'] ?? '0'} unused service(s) detected`,
    expectedState: '0 unused services',
    remediation: 'Disable the unused services and record the decision in the baseline.',
  },
  {
    id: 'strong-crypto',
    name: 'Strong cipher suites enforced',
    requirement: 'Legacy ciphers (DES, 3DES, SSLv3) must not be accepted.',
    category: 'Encryption',
    weight: 10,
    severity: 'high',
    frameworks: ['cis', 'nist'],
    inspects: ['enc.sshCipher', 'enc.tlsVersion'],
    evaluate: (v) => {
      const cipher = v['enc.sshCipher'];
      const tls = v['enc.tlsVersion'];
      if (!is(cipher) && !is(tls)) return 'na';
      const cipherOk = !is(cipher) || cipher === 'AES-256-GCM' || cipher === 'AES-128-GCM';
      const tlsOk = !is(tls) || tls === 'TLS 1.2' || tls === 'TLS 1.3';
      return cipherOk && tlsOk ? 'pass' : 'fail';
    },
    currentState: (v) => `SSH cipher ${v['enc.sshCipher'] ?? 'n/a'} · TLS ${v['enc.tlsVersion'] ?? 'n/a'}`,
    expectedState: 'AES-256-GCM · TLS 1.2 or higher',
    remediation: 'Restrict SSH ciphers to AES-GCM and raise the minimum TLS version to 1.2.',
  },
  {
    id: 'strong-key-exchange',
    name: 'Modern key exchange (IKEv2)',
    requirement: 'Site-to-site tunnels must negotiate with IKEv2.',
    category: 'Encryption',
    weight: 7,
    severity: 'high',
    frameworks: ['nist'],
    inspects: ['enc.ikePolicy'],
    evaluate: (v) => {
      if (!is(v['enc.ikePolicy'])) return 'na';
      return v['enc.ikePolicy'] === 'IKEv2' ? 'pass' : 'fail';
    },
    currentState: (v) => `IKE policy ${v['enc.ikePolicy'] ?? 'n/a'}`,
    expectedState: 'IKEv2',
    remediation: 'Migrate the tunnel to IKEv2 with AES-256-GCM and DH group 14+.',
  },
  {
    id: 'wireless-encryption',
    name: 'Wireless networks encrypted with 802.1X',
    requirement: 'WLANs must use WPA2/WPA3-Enterprise; shared keys and open SSIDs are prohibited.',
    category: 'Encryption',
    weight: 10,
    severity: 'critical',
    frameworks: ['cis', 'iso27001'],
    inspects: ['enc.wifiCipher'],
    evaluate: (v) => {
      if (!is(v['enc.wifiCipher'])) return 'na';
      return v['enc.wifiCipher'] === 'WPA3-Enterprise' || v['enc.wifiCipher'] === 'WPA2-Enterprise'
        ? 'pass'
        : 'fail';
    },
    currentState: (v) => `WLAN encryption ${v['enc.wifiCipher'] ?? 'n/a'}`,
    expectedState: 'WPA3-Enterprise (or WPA2-Enterprise)',
    remediation: 'Migrate the SSID to WPA3-Enterprise with per-user 802.1X credentials.',
  },
  {
    id: 'no-plaintext-credentials',
    name: 'Credentials not stored in clear text',
    requirement: 'Shared secrets and community strings must be stored encrypted in the running configuration.',
    category: 'Encryption',
    weight: 12,
    severity: 'critical',
    frameworks: ['cis', 'nist'],
    inspects: ['enc.passwordStorage'],
    evaluate: (v) => {
      if (!is(v['enc.passwordStorage'])) return 'na';
      return v['enc.passwordStorage'] === 'Plaintext' ? 'fail' : 'pass';
    },
    currentState: (v) => `Credential storage: ${v['enc.passwordStorage'] ?? 'n/a'}`,
    expectedState: 'Encrypted (AES-256) or Hashed (SHA-256)',
    remediation: 'Enable the encrypted secret type and re-apply the shared secrets.',
  },
  {
    id: 'supported-firmware',
    name: 'Firmware in vendor support',
    requirement: 'Devices must run a firmware release that still receives security patches.',
    category: 'System',
    weight: 7,
    severity: 'high',
    frameworks: ['nist', 'iso27001'],
    inspects: ['sys.firmwareSupport'],
    evaluate: (v) => {
      if (!is(v['sys.firmwareSupport'])) return 'na';
      return v['sys.firmwareSupport'] === 'Supported' ? 'pass' : 'fail';
    },
    currentState: (v) => `Firmware support: ${v['sys.firmwareSupport'] ?? 'n/a'}`,
    expectedState: 'Supported release',
    remediation: 'Upgrade to the current supported release in the next maintenance window.',
  },
  {
    id: 'approved-resolvers',
    name: 'Approved DNS resolvers only',
    requirement: 'Devices must not be configured to use external public resolvers.',
    category: 'System',
    weight: 5,
    severity: 'medium',
    frameworks: ['cis'],
    inspects: ['sys.dnsServers'],
    evaluate: (v) => {
      const servers = v['sys.dnsServers'];
      if (!is(servers)) return 'na';
      const external = servers
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .some((entry) => !/^10\./.test(entry) && !/^192\.168\./.test(entry) && !/^172\.(1[6-9]|2\d|3[01])\./.test(entry));
      return external ? 'fail' : 'pass';
    },
    currentState: (v) => `Resolvers: ${v['sys.dnsServers'] ?? 'n/a'}`,
    expectedState: 'Approved internal resolvers only',
    remediation: 'Replace public resolvers with the approved internal DNS servers.',
  },
  {
    id: 'trusted-time',
    name: 'Trusted time source configured',
    requirement: 'Devices must synchronise time from approved internal sources.',
    category: 'System',
    weight: 5,
    severity: 'medium',
    frameworks: ['iso27001'],
    inspects: ['sys.ntpSync'],
    evaluate: (v) => {
      if (!is(v['sys.ntpSync'])) return 'na';
      return v['sys.ntpSync'] === enum_ ? 'pass' : 'fail';
    },
    currentState: (v) => `NTP ${v['sys.ntpSync'] ?? 'n/a'}`,
    expectedState: 'NTP Enabled',
    remediation: 'Enable NTP against two approved internal time sources.',
  },
  {
    id: 'automated-backup',
    name: 'Automated configuration backup',
    requirement: 'Running configurations must be archived on a schedule, not manually.',
    category: 'System',
    weight: 4,
    severity: 'low',
    frameworks: ['iso27001'],
    inspects: ['sys.backupSchedule'],
    evaluate: (v) => {
      if (!is(v['sys.backupSchedule'])) return 'na';
      return v['sys.backupSchedule'] === 'Manual' ? 'fail' : 'pass';
    },
    currentState: (v) => `Backup schedule: ${v['sys.backupSchedule'] ?? 'n/a'}`,
    expectedState: 'Daily or Weekly',
    remediation: 'Schedule a daily configuration backup to the version-control repository.',
  },
];

export const CHECK_BY_ID: Record<string, ComplianceCheck> = Object.fromEntries(
  COMPLIANCE_CHECKS.map((check) => [check.id, check]),
);

export type { Severity };
