import type {
  ComplianceResult,
  ComplianceCheckResult,
  ConfigChange,
  ConfigItem,
  ConfigItemDef,
  Device,
  Finding,
  FrameworkId,
  FrameworkResult,
  SecurityStatus,
  Severity,
} from '@/types';
import { CONFIG_BY_ID, CONFIG_SCHEMA } from '@/data/configSchema';
import { COMPLIANCE_CHECKS } from '@/data/complianceChecks';

/* =============================================================================
 * Analysis engine
 * -----------------------------------------------------------------------------
 * The prototype has no backend. Every piece of "intelligence" in CYBERSURE is
 * this deterministic rule engine: configuration in, security findings out.
 * Remediation works because fixing a value makes the derived finding disappear.
 * ========================================================================== */

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 1.6,
  high: 1,
  medium: 0.5,
  low: 0.2,
};

/**
 * How strongly one severity point affects a single device score. The estate
 * score is the mean of the device scores, so the two always move together.
 */
const DEVICE_POSTURE_SCALE = 12;

/** Weight used to score a framework once a control fails. */
const CONTROL_SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 2.6,
  high: 1.5,
  medium: 0.8,
  low: 0.35,
};

/* -------------------------------------------------------------------------- */
/* Materialisation                                                            */
/* -------------------------------------------------------------------------- */

/** Build the ordered list of configuration items for a device. */
export function materialiseConfig(device: Device): ConfigItem[] {
  return CONFIG_SCHEMA.filter((def) => def.deviceTypes.includes(device.type)).map((def) => ({
    ...def,
    value: device.config.values[def.id] ?? def.recommended,
  }));
}

export function getItem(device: Device, configItemId: string): ConfigItem | undefined {
  const def = CONFIG_BY_ID[configItemId];
  if (!def || !def.deviceTypes.includes(device.type)) return undefined;
  return { ...def, value: device.config.values[configItemId] ?? def.recommended };
}

export function getValue(device: Device, configItemId: string): string | undefined {
  if (!CONFIG_BY_ID[configItemId]?.deviceTypes.includes(device.type)) return undefined;
  return device.config.values[configItemId] ?? CONFIG_BY_ID[configItemId].recommended;
}

/* -------------------------------------------------------------------------- */
/* Compliance of a single setting                                             */
/* -------------------------------------------------------------------------- */

const numericInRange = (item: ConfigItemDef, value: string): boolean => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return false;
  if (!item.range) return true;
  return parsed >= item.range.min && parsed <= item.range.max;
};

/**
 * Is a value compliant with the baseline for this setting?
 * A setting is compliant when it matches the recommended value, one of the
 * explicitly accepted alternatives, or sits inside the allowed numeric range.
 */
export function isValueCompliant(item: ConfigItemDef, value: string): boolean {
  const trimmed = value.trim();
  if (item.type === 'number' || item.range) return numericInRange(item, trimmed);
  if (item.type === 'list') {
    if (item.id === 'mgmt.mgmtAcl') {
      return !(trimmed.includes('0.0.0.0/0') || trimmed === 'any');
    }
    if (item.id === 'sys.dnsServers') {
      const entries = trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (entries.length === 0) return false;
      return entries.every((entry) =>
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry),
      );
    }
    return entriesAreValid(trimmed);
  }
  if (trimmed === item.recommended) return true;
  return (item.alsoCompliant ?? []).includes(trimmed);
}

function entriesAreValid(value: string): boolean {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0;
}

export function complianceVerdict(item: ConfigItem, value: string): { compliant: boolean; reason: string } {
  if (isValueCompliant(item, value)) {
    if (item.range && value.trim() !== item.recommended) {
      return {
        compliant: true,
        reason: `Within the allowed range (${item.range.min}-${item.range.max} ${item.range.unit}).`,
      };
    }
    if (value.trim() === item.recommended) {
      return { compliant: true, reason: 'Matches the CYBERSURE baseline value.' };
    }
    return { compliant: true, reason: 'Accepted as an equivalent hardened value.' };
  }
  return { compliant: false, reason: describeDeviation(item, value) };
}

function describeDeviation(item: ConfigItem, value: string): string {
  const trimmed = value.trim();
  switch (item.id) {
    case 'mgmt.mgmtAcl':
      return 'Allows any source network (0.0.0.0/0) to reach the management plane.';
    case 'sys.dnsServers':
      return 'Points at a public resolver outside the approved internal ranges.';
    default:
      break;
  }
  if (item.range) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return 'Value is not a valid number.';
    if (parsed < item.range.min) {
      return `${trimmed} ${item.range.unit} is below the allowed minimum of ${item.range.min}.`;
    }
    return `${trimmed} ${item.range.unit} exceeds the allowed maximum of ${item.range.max}.`;
  }
  if (trimmed === '') return 'No value configured.';
  return `${trimmed} does not match the baseline value (${item.recommended}).`;
}

/* -------------------------------------------------------------------------- */
/* Findings (security issues)                                                 */
/* -------------------------------------------------------------------------- */

export function findingIdFor(deviceId: string, configItemId: string): string {
  return `${deviceId}::${configItemId}`;
}

/**
 * Derive the open findings for a device straight from its configuration.
 * A finding exists exactly when a setting deviates from the baseline.
 */
export function findingsForDevice(device: Device): Finding[] {
  const items = materialiseConfig(device);
  const findings: Finding[] = [];
  for (const item of items) {
    if (isValueCompliant(item, item.value)) continue;
    const { reason } = complianceVerdict(item, item.value);
    findings.push({
      id: findingIdFor(device.id, item.id),
      deviceId: device.id,
      configItemId: item.id,
      severity: item.severity,
      title: item.finding.title,
      issueCategory: item.finding.issueCategory,
      description: `${item.label} on ${device.name} is set to “${item.value}”. ${reason}`,
      why: item.finding.why,
      fix: item.finding.fix,
      reference: item.finding.reference,
      currentValue: item.value,
      recommendedValue: item.recommended,
      status: 'open',
      detectedAt: device.lastScan,
    });
  }
  return sortFindings(findings);
}

/**
 * Full finding register: open findings derived from configuration, plus a
 * "resolved" entry for any device/setting that was remediated by an applied
 * demo change. The resolved entries exist only in the audit trail — that is
 * what makes the Security Issues register show a real Resolved tab.
 */
export function findingRegister(devices: Device[], changes: ConfigChange[]): Finding[] {
  const open = devices.flatMap(findingsForDevice);
  const remediated = new Map<string, ConfigChange>();
  for (const change of changes) {
    if (change.changeStatus !== 'applied' || change.validationStatus !== 'validated') continue;
    remediated.set(findingIdFor(change.deviceId, change.configItemId), change);
  }

  const openIds = new Set(open.map((finding) => finding.id));
  const resolved: Finding[] = [];

  for (const [id, change] of remediated) {
    if (openIds.has(id)) continue;
    const [deviceId, configItemId] = id.split('::');
    const device = devices.find((candidate) => candidate.id === deviceId);
    const def = CONFIG_BY_ID[configItemId];
    if (!device || !def) continue;
    // Only a change that actually fixed a deviation counts as a remediation.
    if (isValueCompliant(def, change.oldValue)) continue;
    resolved.push({
      id,
      deviceId,
      configItemId,
      severity: def.severity,
      title: def.finding.title,
      issueCategory: def.finding.issueCategory,
      description: `${def.label} on ${device.name} was changed from “${change.oldValue}” to “${change.newValue}” and now matches the CYBERSURE baseline.`,
      why: def.finding.why,
      fix: def.finding.fix,
      reference: def.finding.reference,
      currentValue: change.newValue,
      recommendedValue: def.recommended,
      status: 'resolved',
      detectedAt: change.timestamp,
      resolvedAt: change.timestamp,
      resolvedByChangeId: change.id,
    });
  }

  return sortFindings([...open, ...resolved]);
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    const severityDelta = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDelta !== 0) return severityDelta;
    return a.title.localeCompare(b.title);
  });
}

/* -------------------------------------------------------------------------- */
/* Security posture                                                           */
/* -------------------------------------------------------------------------- */

/** Demo security posture for one device: 100 minus a severity-weighted penalty. */
export function postureFor(findings: Finding[]): number {
  const penalty = openFindingPenalty(findings);
  return clampScore(100 - penalty * DEVICE_POSTURE_SCALE);
}

function openFindingPenalty(findings: Finding[]): number {
  return findings
    .filter((finding) => finding.status === 'open')
    .reduce((total, finding) => total + SEVERITY_WEIGHT[finding.severity], 0);
}

/**
 * Estate security posture: the mean device posture, so fixing a finding on one
 * device moves both that device's score and the headline score.
 */
export function estatePosture(perDevice: Record<string, number>): number {
  const scores = Object.values(perDevice);
  if (scores.length === 0) return 100;
  return clampScore(scores.reduce((total, score) => total + score, 0) / scores.length);
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  resolved: number;
}

export function severityBreakdown(findings: Finding[]): SeverityBreakdown {
  const breakdown: SeverityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, open: 0, resolved: 0 };
  for (const finding of findings) {
    if (finding.status === 'resolved') {
      breakdown.resolved += 1;
      continue;
    }
    breakdown.open += 1;
    breakdown[finding.severity] += 1;
  }
  return breakdown;
}

export function securityStatusFor(findings: Finding[]): SecurityStatus {
  const open = findings.filter((finding) => finding.status === 'open');
  if (open.length === 0) return 'compliant';
  for (const severity of SEVERITY_ORDER) {
    if (open.some((finding) => finding.severity === severity)) return severity;
  }
  return 'compliant';
}

/* -------------------------------------------------------------------------- */
/* Compliance scoring                                                         */
/* -------------------------------------------------------------------------- */

export function complianceFor(devices: Device[], findings: Finding[]): ComplianceResult {
  const results: ComplianceCheckResult[] = [];

  for (const device of devices) {
    for (const check of COMPLIANCE_CHECKS) {
      const status = check.evaluate(device.config.values);
      if (status === 'na') {
        results.push({
          checkId: check.id,
          deviceId: device.id,
          status: 'na',
          currentState: 'Not applicable to this device type',
          severity: check.severity,
        });
        continue;
      }
      const related = findings.find(
        (finding) =>
          finding.status === 'open' &&
          finding.deviceId === device.id &&
          check.inspects.includes(finding.configItemId),
      );
      results.push({
        checkId: check.id,
        deviceId: device.id,
        status,
        currentState: check.currentState(device.config.values),
        severity: check.severity,
        findingId: related?.id,
      });
    }
  }

  const frameworks: FrameworkResult[] = (['cis', 'iso27001', 'nist'] as FrameworkId[]).map((frameworkId) => {
    const applicable = results.filter((result) =>
      COMPLIANCE_CHECKS.some(
        (check) => check.id === result.checkId && check.frameworks.includes(frameworkId),
      ),
    );
    let score = 100;
    let totalWeight = 0;
    let penalty = 0;
    for (const result of applicable) {
      const check = COMPLIANCE_CHECKS.find((candidate) => candidate.id === result.checkId)!;
      totalWeight += check.weight;
      if (result.status === 'fail') penalty += check.weight * CONTROL_SEVERITY_WEIGHT[result.severity];
    }
    if (totalWeight > 0) {
      score = clampScore(100 - (penalty / totalWeight) * 100);
    }
    return {
      id: frameworkId,
      score,
      passed: applicable.filter((result) => result.status === 'pass').length,
      failed: applicable.filter((result) => result.status === 'fail').length,
      na: applicable.filter((result) => result.status === 'na').length,
    };
  });

  const weightedTotal = frameworks.reduce((total, framework) => total + framework.score, 0);
  const overall = clampScore(weightedTotal / frameworks.length);

  return { overall, frameworks, results };
}

/* -------------------------------------------------------------------------- */
/* Device views                                                               */
/* -------------------------------------------------------------------------- */

export interface AnalysisResult {
  devices: Device[];
  findings: Finding[];
  itemsByDevice: Record<string, ConfigItem[]>;
  findingsByDevice: Record<string, Finding[]>;
  securityStatusByDevice: Record<string, SecurityStatus>;
  postureByDevice: Record<string, number>;
  posture: number;
  breakdown: SeverityBreakdown;
  compliance: ComplianceResult;
}

export function analyse(devices: Device[], changes: ConfigChange[]): AnalysisResult {
  const findings = findingRegister(devices, changes);
  const itemsByDevice: Record<string, ConfigItem[]> = {};
  const findingsByDevice: Record<string, Finding[]> = {};
  const securityStatusByDevice: Record<string, SecurityStatus> = {};
  const postureByDevice: Record<string, number> = {};

  for (const device of devices) {
    itemsByDevice[device.id] = materialiseConfig(device);
    const deviceFindings = findings.filter((finding) => finding.deviceId === device.id);
    findingsByDevice[device.id] = deviceFindings;
    securityStatusByDevice[device.id] = securityStatusFor(deviceFindings);
    postureByDevice[device.id] = postureFor(deviceFindings);
  }

  return {
    devices,
    findings,
    itemsByDevice,
    findingsByDevice,
    securityStatusByDevice,
    postureByDevice,
    posture: estatePosture(postureByDevice),
    breakdown: severityBreakdown(findings),
    compliance: complianceFor(devices, findings),
  };
}

/** Compliance status of a single device, derived from its own failing controls. */
export function deviceComplianceStatus(
  device: Device,
  findings: Finding[],
): 'compliant' | 'partial' | 'non-compliant' | 'not-assessed' {
  const controls = COMPLIANCE_CHECKS.filter((check) => check.inspects.some((id) => id in device.config.values));
  if (controls.length === 0) return 'not-assessed';
  const failed = controls.filter((check) => check.evaluate(device.config.values) === 'fail');
  if (failed.length === 0) return 'compliant';
  const openFindings = findings.filter(
    (finding) => finding.status === 'open' && finding.deviceId === device.id,
  );
  if (openFindings.some((finding) => finding.severity === 'critical' || finding.severity === 'high')) {
    return 'non-compliant';
  }
  const passedRatio = (controls.length - failed.length) / controls.length;
  return passedRatio >= 0.8 ? 'partial' : 'non-compliant';
}
