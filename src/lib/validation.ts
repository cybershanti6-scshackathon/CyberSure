import type {
  CheckStatus,
  ConfigItem,
  ConfigItemDef,
  Device,
  DeviceValidationReport,
  ValidationReport,
  ValidationStage,
  ValidationStageStatus,
} from '@/types';
import { COMPLIANCE_CHECKS } from '@/data/complianceChecks';
import { CONFIG_BY_ID } from '@/data/configSchema';
import { isValueCompliant, materialiseConfig, getValue } from './analysis';
import { normaliseValue, validateSyntax, worstStatus } from '@/utils/validators';

/* =============================================================================
 * Configuration validation engine
 * -----------------------------------------------------------------------------
 * Four stages, in the order an operator expects:
 *   1. Syntax validation
 *   2. Security policy validation
 *   3. Compliance validation
 *   4. Configuration conflict check
 *
 * A proposal is only applicable when nothing "fails". Warnings are surfaced but
 * do not block, which mirrors how a real change-advisory workflow behaves.
 * ========================================================================== */

interface SecurityPolicy {
  id: string;
  name: string;
  settings: string[];
  /** Returns the verdict for a proposed value. */
  evaluate: (item: ConfigItemDef, value: string) => { status: CheckStatus; detail: string };
}

const denyValue = (settings: string[], denied: string[], reason: string): SecurityPolicy => ({
  id: 'POL',
  name: 'no-cleartext',
  settings,
  evaluate: (item, value) =>
    denied.includes(value)
      ? { status: 'fail', detail: `${item.setting} = ${value} is prohibited. ${reason}` }
      : { status: 'pass', detail: `${item.setting} = ${value} satisfies the security policy.` },
});

export const SECURITY_POLICIES: SecurityPolicy[] = [
  {
    id: 'CS-POL-01',
    name: 'No cleartext management protocols',
    settings: ['mgmt.telnet', 'mgmt.http'],
    evaluate: (item, value) =>
      value === 'Disabled'
        ? { status: 'pass', detail: `${item.setting} is disabled — cleartext management is not permitted.` }
        : {
            status: 'fail',
            detail: `${item.setting} = ${value} is prohibited. Cleartext management protocols must be disabled.`,
          },
  },
  {
    id: 'CS-POL-02',
    name: 'Encrypted SSH channel required',
    settings: ['mgmt.ssh'],
    evaluate: (_item, value) =>
      value === 'Enabled'
        ? { status: 'pass', detail: 'SSHv2 is enabled for remote administration.' }
        : { status: 'fail', detail: 'Disabling SSH removes the encrypted administrative channel required by policy.' },
  },
  {
    id: 'CS-POL-03',
    name: 'Management access restricted to trusted sources',
    settings: ['mgmt.mgmtAcl'],
    evaluate: (_item, value) => {
      const unrestricted = value.includes('0.0.0.0/0') || value.trim() === 'any';
      return unrestricted
        ? { status: 'fail', detail: 'A 0.0.0.0/0 management ACL is prohibited — the management plane must be restricted.' }
        : { status: 'pass', detail: 'Management ACL is limited to the approved subnets.' };
    },
  },
  {
    id: 'CS-POL-04',
    name: 'Strong credential policy',
    settings: ['auth.passwordPolicy'],
    evaluate: (item, value) =>
      value === 'Strong'
        ? { status: 'pass', detail: 'Strong password policy enforced.' }
        : { status: 'fail', detail: `${item.setting} = ${value} is below the mandatory Strong policy.` },
  },
  {
    id: 'CS-POL-05',
    name: 'Multi-factor authentication for administrators',
    settings: ['auth.mfa'],
    evaluate: (_item, value) =>
      value === 'Enabled'
        ? { status: 'pass', detail: 'MFA enforced for privileged logins.' }
        : { status: 'fail', detail: 'Privileged logins must require a second factor.' },
  },
  {
    id: 'CS-POL-06',
    name: 'No cleartext file transfer',
    settings: ['svc.ftp', 'svc.tftp'],
    evaluate: (item, value) =>
      value === 'Disabled'
        ? { status: 'pass', detail: `${item.setting} is disabled — file transfer must use SFTP.` }
        : { status: 'fail', detail: `${item.setting} = ${value} transmits data without encryption and is prohibited.` },
  },
  {
    id: 'CS-POL-07',
    name: 'Perimeter default-deny posture',
    settings: ['fw.defaultInbound', 'fw.intraZonePolicy'],
    evaluate: (item, value) =>
      value === 'DENY'
        ? { status: 'pass', detail: `${item.setting} = DENY matches the default-deny baseline.` }
        : { status: 'fail', detail: `${item.setting} = ${value} permits unmatched traffic and violates the default-deny baseline.` },
  },
  {
    id: 'CS-POL-08',
    name: 'No permit any / permit any rules',
    settings: ['fw.anyAnyRule'],
    evaluate: (_item, value) =>
      value === 'Disabled'
        ? { status: 'pass', detail: 'No any/any rule is present in the rule base.' }
        : { status: 'fail', detail: 'A permit any/permit any rule bypasses the entire rule base and is prohibited.' },
  },
  {
    id: 'CS-POL-09',
    name: 'Audit logging required',
    settings: ['log.configChanges', 'log.firewall'],
    evaluate: (item, value) =>
      value === 'Enabled'
        ? { status: 'pass', detail: `${item.label} is enabled — the audit trail is intact.` }
        : { status: 'fail', detail: `${item.label} is mandatory for the audit trail and must stay enabled.` },
  },
  {
    id: 'CS-POL-10',
    name: 'Approved cryptography only',
    settings: ['enc.sshCipher', 'enc.tlsVersion', 'enc.ikePolicy', 'enc.wifiCipher', 'enc.passwordStorage'],
    evaluate: (item, value) =>
      isValueCompliant(item, value)
        ? { status: 'pass', detail: `${value} is an approved cryptographic value.` }
        : { status: 'fail', detail: `${value} is not an approved cryptographic value for ${item.setting}.` },
  },
  {
    id: 'CS-POL-11',
    name: 'SNMP hardening',
    settings: ['svc.snmpVersion'],
    evaluate: (_item, value) =>
      value === 'v3' || value === 'Disabled'
        ? { status: 'pass', detail: 'SNMP is hardened (v3) or disabled.' }
        : { status: 'fail', detail: 'SNMPv1/v2c community strings are sent in clear text and are prohibited.' },
  },
  {
    id: 'CS-POL-12',
    name: 'Approved DNS resolvers only',
    settings: ['sys.dnsServers'],
    evaluate: (_item, value) => {
      const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
      const external = entries.filter(
        (entry) => !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry),
      );
      return external.length > 0
        ? { status: 'fail', detail: `External resolver(s) detected: ${external.join(', ')}.` }
        : { status: 'pass', detail: 'All resolvers are approved internal addresses.' };
    },
  },
  {
    id: 'CS-POL-13',
    name: 'Least functionality',
    settings: ['svc.unusedServices'],
    evaluate: (_item, value) => {
      const count = Number(value);
      if (!Number.isFinite(count) || count <= 0) {
        return { status: 'pass', detail: 'No unused network services detected.' };
      }
      return {
        status: 'warn',
        detail: `${count} unused service(s) still reported. Acceptable with a documented exception, otherwise remediate.`,
      };
    },
  },
  {
    id: 'CS-POL-14',
    name: 'Firmware in vendor support',
    settings: ['sys.firmwareSupport'],
    evaluate: (_item, value) =>
      value === 'Supported'
        ? { status: 'pass', detail: 'Firmware release is still in vendor support.' }
        : {
            status: 'warn',
            detail: `${value} firmware. Acceptable only under a documented, time-boxed upgrade plan.`,
          },
  },
  denyValue(['auth.lockout'], ['Disabled'], 'Unlimited password guessing against the management plane is not permitted.'),
  denyValue(['log.remoteSyslog'], ['Disabled'], 'Logs must be exported to the central collector.'),
  denyValue(['auth.sharedAccounts'], ['Present', 'Enabled'], 'Every change must be attributable to a named account.'),
  denyValue(['sys.backupSchedule'], ['Manual'], 'Configuration baselines must be archived on a schedule.'),
  denyValue(['fw.managementZone'], ['Disabled'], 'The management plane must be isolated from user zones.'),
  {
    id: 'CS-POL-20',
    name: 'Short privileged session timeout',
    settings: ['mgmt.consoleTimeout'],
    evaluate: (_item, value) => {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes <= 0) return { status: 'fail', detail: 'Enter a positive timeout.' };
      if (minutes <= 15) return { status: 'pass', detail: `Console timeout of ${minutes} minutes is acceptable.` };
      if (minutes <= 30) {
        return { status: 'warn', detail: `${minutes} minutes is above the 15 minute baseline but still bounded.` };
      }
      return { status: 'fail', detail: `${minutes} minutes leaves privileged sessions unattended for too long.` };
    },
  },
];

/** Map a control status onto a validation stage status. */
function toStageStatus(status: CheckStatus): ValidationStageStatus {
  return status === 'na' ? 'pending' : status;
}

/**
 * Aggregate per-check verdicts into a stage status. An empty set means the
 * stage had nothing to object to, which is a pass — not a pending state.
 */
function aggregateStageStatus(
  statuses: CheckStatus[],
  { applicable, syntaxOk }: { applicable: boolean; syntaxOk: boolean },
): ValidationStageStatus {
  if (!syntaxOk) return 'pending';
  if (!applicable) return 'pass';
  return toStageStatus(worstStatus(statuses));
}

export function policiesFor(item: ConfigItemDef): SecurityPolicy[] {
  return SECURITY_POLICIES.filter((policy) => policy.settings.includes(item.id));
}export function controlsFor(item: ConfigItemDef) {
  return COMPLIANCE_CHECKS.filter((check) => check.inspects.includes(item.id));
}

/* -------------------------------------------------------------------------- */
/* Stage 4 — configuration conflict detection                                 */
/* -------------------------------------------------------------------------- */

type Hypothetical = Record<string, string>;

function conflictChecks(
  item: ConfigItemDef,
  value: string,
  values: Hypothetical,
): { status: CheckStatus; detail: string }[] {
  const out: { status: CheckStatus; detail: string }[] = [];
  const enabled = (key: string) => values[key] === 'Enabled';
  const disabled = (key: string) => values[key] === 'Disabled';

  // Losing every remote administration path.
  if (item.id === 'mgmt.ssh' && value === 'Disabled' && disabled('mgmt.telnet') && disabled('mgmt.http')) {
    out.push({
      status: 'fail',
      detail: 'This change removes every remote administration path — SSH, Telnet and HTTP management are all disabled.',
    });
  }
  if (item.id === 'mgmt.https' && value === 'Disabled' && disabled('mgmt.http') && disabled('mgmt.ssh')) {
    out.push({
      status: 'fail',
      detail: 'The web management interface and SSH are both unavailable — local console would be the only access path.',
    });
  }
  if (item.id === 'mgmt.http' && value === 'Enabled' && enabled('mgmt.https')) {
    out.push({
      status: 'warn',
      detail: 'Two web management listeners will be active. Operators may silently fall back to the unencrypted one.',
    });
  }
  if (item.id === 'mgmt.mgmtAcl' && (value.includes('0.0.0.0/0') || value.trim() === 'any') && disabled('auth.mfa')) {
    out.push({
      status: 'warn',
      detail: 'Management access would be open to every source while MFA is disabled on this device.',
    });
  }
  if (item.id === 'log.firewall' && value === 'Disabled' && values['fw.defaultInbound'] === 'ALLOW') {
    out.push({
      status: 'warn',
      detail: 'Unmatched inbound traffic is permitted on this device but would no longer be logged.',
    });
  }
  if (item.id === 'fw.anyAnyRule' && value === 'Enabled' && values['fw.defaultInbound'] === 'DENY') {
    out.push({
      status: 'warn',
      detail: 'An any/any rule makes the default-deny posture ineffective for every zone it spans.',
    });
  }
  if (item.id === 'fw.defaultInbound' && value === 'ALLOW' && disabled('log.firewall')) {
    out.push({
      status: 'warn',
      detail: 'A permissive inbound default combined with disabled session logging removes both control and visibility.',
    });
  }
  if (item.id === 'auth.mfa' && value === 'Enabled' && disabled('auth.lockout')) {
    out.push({
      status: 'warn',
      detail: 'MFA will be enforced before account lockout, so repeated factor guessing will not be throttled.',
    });
  }
  if (item.id === 'svc.snmpVersion' && value === 'Disabled' && disabled('log.remoteSyslog')) {
    out.push({
      status: 'warn',
      detail: 'With SNMP and remote syslog both disabled, this device reports no telemetry to the monitoring platform.',
    });
  }
  if (item.id === 'sys.ntpSync' && value === 'Disabled' && enabled('log.configChanges')) {
    out.push({
      status: 'warn',
      detail: 'Configuration change logs will carry unreliable timestamps, breaking forensic correlation.',
    });
  }
  if (item.id === 'enc.tlsVersion' && (value === 'SSLv3' || value === 'TLS 1.0') && enabled('mgmt.https')) {
    out.push({
      status: 'warn',
      detail: 'The HTTPS management interface stays enabled and would negotiate a deprecated TLS version.',
    });
  }
  if (item.id === 'enc.passwordStorage' && value !== 'Plaintext' && !enabled('log.configChanges')) {
    out.push({
      status: 'warn',
      detail: 'Rotating stored credentials should be recorded, but configuration change logging is disabled.',
    });
  }
  if (item.id === 'mgmt.telnet' && value === 'Enabled' && disabled('auth.mfa')) {
    out.push({
      status: 'warn',
      detail: 'Telnet would expose cleartext credentials on a device without multi-factor authentication.',
    });
  }
  if (item.id === 'auth.passwordPolicy' && value === 'Strong' && enabled('auth.sharedAccounts')) {
    out.push({
      status: 'warn',
      detail: 'A strong policy cannot be enforced per person while shared administrative accounts exist.',
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                           */
/* -------------------------------------------------------------------------- */

export interface ValidateChangeInput {
  device: Device;
  item: ConfigItem;
  rawValue: string;
  now?: string;
}

export function validateChange({ device, item, rawValue, now }: ValidateChangeInput): ValidationReport {
  const value = normaliseValue(item, rawValue);
  const validatedAt = now ?? new Date().toISOString();
  const stages: ValidationStage[] = [];

  /* ---- Stage 1: syntax ---- */
  const syntax = validateSyntax(item, rawValue);
  stages.push({
    id: 'syntax',
    label: 'Syntax validation',
    detail: syntax.ok
      ? `Parsed “${value}” as ${item.type} for ${item.label}.`
      : 'The proposed value is not syntactically valid.',
    status: syntax.ok ? 'pass' : 'fail',
    messages: [syntax.message],
  });

  /* ---- Stage 2: security policy ---- */
  const policies = policiesFor(item);
  const policyVerdicts = syntax.ok && policies.length > 0
    ? policies.map((policy) => ({ policy, verdict: policy.evaluate(item, value) }))
    : [];
  const policyStatus = aggregateStageStatus(
    policyVerdicts.map((entry) => entry.verdict.status),
    { applicable: policyVerdicts.length > 0, syntaxOk: syntax.ok },
  );
  stages.push({
    id: 'policy',
    label: 'Security policy validation',
    detail: !syntax.ok
      ? 'Skipped — the syntax check did not pass.'
      : policies.length === 0
        ? 'No CYBERSURE security policy constrains this setting — baseline comparison applies.'
        : policyStatus === 'pass'
          ? `Checked against ${policyVerdicts.length} CYBERSURE security polic${policyVerdicts.length === 1 ? 'y' : 'ies'}.`
          : policyStatus === 'warn'
            ? 'Compliant with policy, with advisory notes.'
            : 'The proposed value violates an active security policy.',
    status: policyStatus,
    messages: !syntax.ok
      ? ['Not evaluated — fix the syntax error first.']
      : policyVerdicts.length > 0
        ? policyVerdicts.map((entry) => `[${entry.policy.id}] ${entry.verdict.detail}`)
        : ['No active security policy constrains this setting. Baseline comparison applies.'],
  });

  /* ---- Stage 3: compliance ---- */
  const controls = controlsFor(item);
  const hypothetical: Hypothetical = { ...device.config.values, [item.id]: value };
  const complianceEntries = syntax.ok
    ? controls.map((check) => {
        const before = check.evaluate(device.config.values);
        const after = check.evaluate(hypothetical);
        return { check, before, after };
      })
    : [];
  const complianceStatus = aggregateStageStatus(
    complianceEntries.map((entry) => entry.after),
    { applicable: complianceEntries.length > 0, syntaxOk: syntax.ok },
  );
  const improved = complianceEntries.filter(
    (entry) => entry.before === 'fail' && entry.after === 'pass',
  );
  const regressed = complianceEntries.filter(
    (entry) => entry.before === 'pass' && entry.after === 'fail',
  );
  stages.push({
    id: 'compliance',
    label: 'Compliance validation',
    detail: !syntax.ok
      ? 'Skipped — the syntax check did not pass.'
      : improved.length > 0
        ? `Restores ${improved.length} failing compliance control${improved.length === 1 ? '' : 's'}.`
        : regressed.length > 0
          ? `Would break ${regressed.length} currently passing compliance control${regressed.length === 1 ? '' : 's'}.`
          : complianceEntries.length === 0
            ? 'This setting is not mapped to a demo compliance control.'
            : `Evaluated against ${complianceEntries.length} mapped compliance control${complianceEntries.length === 1 ? '' : 's'}.`,
    status: complianceStatus,
    messages: syntax.ok
      ? complianceEntries.length > 0
        ? complianceEntries.map((entry) => {
            const label = entry.check.frameworks
              .map((framework) => framework.toUpperCase())
              .join('/');
            const verdict = entry.after === 'pass' ? 'PASS' : 'FAIL';
            return `[${entry.check.id}] ${verdict} — ${entry.check.name} (${label})`;
          })
        : ['This setting is not mapped to a demo compliance control.']
      : ['Not evaluated — fix the syntax error first.'],
  });

  /* ---- Stage 4: conflicts ---- */
  const conflicts = syntax.ok ? conflictChecks(item, value, hypothetical) : [];
  const conflictStatus = aggregateStageStatus(
    conflicts.map((entry) => entry.status),
    { applicable: conflicts.length > 0, syntaxOk: syntax.ok },
  );
  const unchanged = value === (device.config.values[item.id] ?? item.value);
  stages.push({
    id: 'conflict',
    label: 'Configuration conflict check',
    detail: !syntax.ok
      ? 'Skipped — the syntax check did not pass.'
      : unchanged
        ? 'The proposed value is identical to the current value; no state change will occur.'
        : conflicts.length === 0
          ? 'No conflicts detected against the rest of the device configuration.'
          : `${conflicts.length} interaction${conflicts.length === 1 ? '' : 's'} detected with the current configuration.`,
    status: !syntax.ok ? 'pending' : unchanged ? 'warn' : conflictStatus,
    messages: !syntax.ok
      ? ['Not evaluated — fix the syntax error first.']
      : unchanged
        ? ['Proposed value matches the current value. Pick a different value to record a change.']
        : conflicts.length > 0
          ? conflicts.map((entry) => entry.detail)
          : [`Cross-checked ${Object.keys(hypothetical).length} settings on ${device.name}.`],
  });

  const blocking = stages
    .filter((stage) => stage.status === 'fail')
    .flatMap((stage) => stage.messages);

  const advisories = stages
    .filter((stage) => stage.status === 'warn')
    .flatMap((stage) => stage.messages);

  return {
    valid: blocking.length === 0,
    stages,
    blocking: [...new Set(blocking)],
    advisories: [...new Set(advisories)],
    proposedValue: value,
    validatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Whole-device validation (Configuration page)                                */
/* -------------------------------------------------------------------------- */

export function validateDevice(device: Device, now?: string): DeviceValidationReport {
  const items = materialiseConfig(device);
  const deviations = items.filter((item) => !isValueCompliant(item, item.value));
  const blockingSyntax = deviations.filter((item) => validateSyntax(item, item.value).ok === false);

  const checks: DeviceValidationReport['checks'] = [
    {
      label: `Configuration syntax (${items.length} settings)`,
      status: blockingSyntax.length === 0 ? 'pass' : 'fail',
      detail:
        blockingSyntax.length === 0
          ? `All ${items.length} settings parsed successfully.`
          : `${blockingSyntax.length} setting(s) could not be parsed.`,
    },
    {
      label: 'Security policy compliance',
      status: deviations.length === 0 ? 'pass' : deviations.some((item) => item.severity === 'critical' || item.severity === 'high') ? 'fail' : 'warn',
      detail:
        deviations.length === 0
          ? 'Every setting matches the CYBERSURE baseline.'
          : `${deviations.length} setting(s) deviate from the baseline (${deviations
              .map((item) => item.setting)
              .join(', ')}).`,
    },
    {
      label: 'Management access paths',
      status:
        device.config.values['mgmt.ssh'] === 'Enabled' || device.config.values['mgmt.https'] === 'Enabled'
          ? 'pass'
          : 'fail',
      detail:
        device.config.values['mgmt.ssh'] === 'Enabled' || device.config.values['mgmt.https'] === 'Enabled'
          ? 'At least one encrypted management path is available.'
          : 'No encrypted management path remains on this device.',
    },
    {
      label: 'Referenced configuration items',
      status: 'pass',
      detail: `${items.filter((item) => item.complianceRefs.length > 0).length} settings are mapped to demo compliance controls.`,
    },
  ];

  return {
    deviceId: device.id,
    deviceName: device.name,
    violations: deviations.length,
    checks,
    valid: checks.every((check) => check.status === 'pass'),
    checkedAt: now ?? new Date().toISOString(),
  };
}

/** Applied when a baseline template is pushed to a device. */
export function templateItemValues(item: ConfigItem): string {
  return item.recommended;
}

export function itemLabelFor(configItemId: string): string {
  return CONFIG_BY_ID[configItemId]?.label ?? configItemId;
}

export function deviceValue(device: Device, configItemId: string): string {
  const def = CONFIG_BY_ID[configItemId];
  return getValue(device, configItemId) ?? def?.recommended ?? '';
}
