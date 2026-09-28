/* =============================================================================
 * CYBERSURE domain model
 * -----------------------------------------------------------------------------
 * All demo/sample data in this prototype is hand-authored and lives in src/data.
 * Nothing here talks to a real network device.
 * ========================================================================== */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type DeviceType = 'router' | 'switch' | 'firewall' | 'wireless-controller' | 'server';

export type Vendor =
  | 'Cisco'
  | 'Fortinet'
  | 'Palo Alto Networks'
  | 'Juniper'
  | 'MikroTik'
  | 'Arista'
  | 'Huawei'
  | 'Vyatta'
  | 'Aruba'
  | 'Other';

export type DeviceStatus = 'online' | 'offline' | 'maintenance';

export type Environment = 'Production' | 'DMZ' | 'Branch' | 'Lab' | 'Management';

export type SecurityStatus = Severity | 'compliant';

export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant' | 'not-assessed';

export type IssueCategory =
  | 'Access Control'
  | 'Authentication'
  | 'Network Services'
  | 'Firewall'
  | 'Logging'
  | 'Encryption'
  | 'Configuration';

export type ConfigCategory =
  | 'Management Access'
  | 'Authentication'
  | 'Firewall'
  | 'Network Services'
  | 'Logging'
  | 'Encryption'
  | 'System';

/** Control widgets used by the configuration editor. */
export type ControlType =
  | 'toggle'
  | 'select'
  | 'action'
  | 'text'
  | 'number'
  | 'ip'
  | 'port'
  | 'cidr'
  | 'list';

export type FrameworkId = 'cis' | 'iso27001' | 'nist';

export type CheckStatus = 'pass' | 'fail' | 'na' | 'warn';

export type ValidationStageStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail';

export type ChangeValidationStatus = 'pending' | 'validated' | 'blocked';
export type ChangeStatus = 'applied' | 'pending' | 'reverted';

/* -------------------------------------------------------------------------- */
/* Configuration schema                                                       */
/* -------------------------------------------------------------------------- */

export interface ConfigOption {
  value: string;
  label: string;
  hint?: string;
}

export interface FindingMeta {
  /** Finding headline shown in the Security Issues register. */
  title: string;
  issueCategory: IssueCategory;
  /** Why the deviation matters, in operator language. */
  why: string;
  /** Concrete remediation guidance. */
  fix: string;
  /** Policy / baseline reference for the deviation. */
  reference: string;
}

/**
 * A *definition* of a configuration setting. Device values are materialised on
 * top of these definitions, so every device shares one centrally maintained
 * catalogue of settings and baselines.
 */
export interface ConfigItemDef {
  id: string;
  category: ConfigCategory;
  /** Short setting name, e.g. "Telnet". */
  setting: string;
  /** Descriptive label, e.g. "Telnet Administrative Access". */
  label: string;
  description: string;
  type: ControlType;
  options?: ConfigOption[];
  /** Baseline (recommended) value. */
  recommended: string;
  /** Severity of the finding raised when the value deviates from baseline. */
  severity: Severity;
  /** Optional numeric bounds that a value must stay inside to be compliant. */
  range?: { min: number; max: number; unit: string };
  /** Additional compliant values beyond `recommended` (e.g. "Disabled" or "AES-128-GCM"). */
  alsoCompliant?: string[];
  /** Baseline requirements the setting satisfies when compliant. */
  complianceRefs: { framework: FrameworkId; control: string; label: string }[];
  finding: FindingMeta;
  /** Device types this setting applies to. */
  deviceTypes: DeviceType[];
  /** Settings that must be disabled before this one may be enabled. */
  conflictsWith?: string[];
  unit?: string;
  placeholder?: string;
  editable?: boolean;
}

/** A definition plus the value configured on a specific device. */
export interface ConfigItem extends ConfigItemDef {
  value: string;
}

/* -------------------------------------------------------------------------- */
/* Devices                                                                    */
/* -------------------------------------------------------------------------- */

export interface DeviceConfig {
  /** Setting id -> configured value. Materialised from the schema + overrides. */
  values: Record<string, string>;
  /** Vendor-specific CLI/OS version string. */
  osVersion: string;
  configVersion: string;
  collectedVia: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  vendor: Vendor;
  model: string;
  ipAddress: string;
  serial: string;
  site: string;
  environment: Environment;
  status: DeviceStatus;
  lastScan: string;
  config: DeviceConfig;
}

/** Materialised device + derived analysis. */
export interface DeviceView extends Device {
  items: ConfigItem[];
  findings: Finding[];
  securityStatus: SecurityStatus;
  complianceStatus: ComplianceStatus;
  postureScore: number;
}

/* -------------------------------------------------------------------------- */
/* Findings (security issues)                                                 */
/* -------------------------------------------------------------------------- */

export interface Finding {
  id: string;
  deviceId: string;
  configItemId: string;
  severity: Severity;
  title: string;
  issueCategory: IssueCategory;
  description: string;
  why: string;
  fix: string;
  reference: string;
  currentValue: string;
  recommendedValue: string;
  status: 'open' | 'resolved';
  detectedAt: string;
  resolvedAt?: string;
  resolvedByChangeId?: string;
}

/* -------------------------------------------------------------------------- */
/* Configuration changes                                                      */
/* -------------------------------------------------------------------------- */

export interface ConfigChange {
  id: string;
  deviceId: string;
  deviceName: string;
  configItemId: string;
  setting: string;
  category: ConfigCategory;
  oldValue: string;
  newValue: string;
  recommended: string;
  validationStatus: ChangeValidationStatus;
  changeStatus: ChangeStatus;
  timestamp: string;
  actor: string;
  source: 'remediation' | 'baseline-template' | 'manual' | 'seed';
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Compliance                                                                 */
/* -------------------------------------------------------------------------- */

export interface ComplianceCheck {
  id: string;
  name: string;
  requirement: string;
  category: ConfigCategory;
  /** Relative weight of the control when scoring a framework. */
  weight: number;
  /** Severity assigned to a failing control. */
  severity: Severity;
  frameworks: FrameworkId[];
  /** Settings this control inspects on a device. */
  inspects: string[];
  evaluate: (values: Record<string, string>) => CheckStatus;
  currentState: (values: Record<string, string>) => string;
  expectedState: string;
  remediation: string;
}

export interface ComplianceCheckResult {
  checkId: string;
  deviceId: string;
  status: CheckStatus;
  currentState: string;
  severity: Severity;
  findingId?: string;
}

export interface FrameworkResult {
  id: FrameworkId;
  score: number;
  passed: number;
  failed: number;
  na: number;
}

export interface ComplianceResult {
  overall: number;
  frameworks: FrameworkResult[];
  results: ComplianceCheckResult[];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface ValidationStage {
  id: string;
  label: string;
  detail: string;
  status: ValidationStageStatus;
  messages: string[];
}

export interface ValidationReport {
  valid: boolean;
  stages: ValidationStage[];
  blocking: string[];
  advisories: string[];
  proposedValue: string;
  validatedAt: string;
}

export interface DeviceValidationReport {
  deviceId: string;
  deviceName: string;
  violations: number;
  checks: { label: string; status: CheckStatus; detail: string }[];
  valid: boolean;
  checkedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

export interface BaselineTemplate {
  id: string;
  name: string;
  description: string;
  appliesTo: DeviceType[];
  appliesToLabel: string;
  settings: string[];
  checks: string[];
}

/* -------------------------------------------------------------------------- */
/* Scans                                                                      */
/* -------------------------------------------------------------------------- */

export interface ScanResult {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  devicesScanned: number;
  newFindings: number;
  resolvedFindings: number;
  unresolvedFindings: number;
  postureBefore: number;
  postureAfter: number;
  newFindingIds: string[];
  resolvedFindingIds: string[];
  perDevice: { deviceId: string; deviceName: string; issues: number; posture: number }[];
}

/* -------------------------------------------------------------------------- */
/* Notification preferences (demo settings)                                   */
/* -------------------------------------------------------------------------- */

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Preferences {
  theme: ThemePreference;
  alertsOnSecurityIssues: boolean;
  alertsOnValidation: boolean;
  sidebarCollapsed: boolean;
}

/* ========================================================================== */
/* Configuration converter                                                     */
/* ========================================================================== */

/**
 * A network platform CYBERSURE can read from and write to.
 *
 * The converter's platform list is served by the backend
 * (`GET /api/v1/devices`); this union is the compile-time contract that keeps
 * the two in step. `aruba-arubaos` appears in the estate data but is not a
 * conversion target, so it is not in the backend registry.
 */
export type PlatformId =
  | 'cisco-iosxe'
  | 'cisco-ios'
  | 'cisco-nxos'
  | 'cisco-asa'
  | 'juniper-junos'
  | 'fortinet-fortios'
  | 'paloalto-panos'
  | 'mikrotik-routeros'
  | 'arista-eos'
  | 'huawei-vrp'
  | 'aruba-aoscx'
  | 'vyos'
  | 'aruba-arubaos';

/** Platform ids the conversion backend can parse and render. */
export type ConverterPlatformId = Exclude<PlatformId, 'aruba-arubaos'>;

export interface Platform {
  id: PlatformId;
  name: string;
  vendor: Vendor;
  /** CLI family label shown in the converter selector, e.g. "IOS XE CLI". */
  cliLabel: string;
  /** Extension used when a configuration is downloaded. */
  fileExtension: string;
  accent: 'sky' | 'emerald' | 'red' | 'orange' | 'violet' | 'cyan';
  description: string;
}

/** One parsed line of a configuration file. */
export interface ParsedCommand {
  line: number;
  raw: string;
  /** Indentation depth, used to rebuild block structure in hierarchical CLIs. */
  depth: number;
  /** Normalised "intent" key the mapping rules match on (e.g. "set interface"). */
  intent: string;
  /** True for comment/blank lines, which are never mapped. */
  passthrough: boolean;
  /** Values captured by the parser, e.g. the interface name for `interface.ipv4`. */
  args: Record<string, string>;
}

export type MappedStatus = 'converted' | 'review' | 'unsupported';

export interface MappedCommand {
  line: number;
  source: string;
  /** Lines emitted in the target configuration (possibly none). */
  target: string[];
  status: MappedStatus;
  /** The rule that handled this command. */
  ruleId: string;
  ruleLabel: string;
  /** Operator-facing explanation, shown for `review` rows. */
  note?: string;
}

export interface ConversionWarning {
  id: string;
  severity: 'medium' | 'low';
  title: string;
  detail: string;
  /** Source line the warning refers to, when it is line-specific. */
  line?: number;
}

export interface ValidationOutcome {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ConversionResult {
  id: string;
  from: PlatformId;
  to: PlatformId;
  sourceConfig: string;
  targetConfig: string;
  /** Total non-comment source commands considered. */
  processed: number;
  converted: number;
  needsReview: number;
  unsupported: number;
  warnings: ConversionWarning[];
  mapping: MappedCommand[];
  validation: ValidationOutcome[] | null;
  /** "valid" | "valid-with-review" | "invalid" | "not-run" */
  status: 'valid' | 'valid-with-review' | 'invalid' | 'not-run';
  createdAt: string;
  /**
   * Status exactly as the backend reported it. Drives the converter's
   * CONVERSION SUCCESSFUL / PARTIAL / REQUIRES REVIEW / UNSUPPORTED labels.
   */
  backendStatus?: ApiConversionStatus;
  /** Id of the JSON report the backend generated for this run. */
  reportId?: string;
}

/** Status vocabulary returned by the conversion API. */
export type ApiConversionStatus =
  | 'success'
  | 'partial'
  | 'requires_review'
  | 'unsupported'
  | 'invalid'
  | 'error';

/* ========================================================================== */
/* Reports                                                                     */
/* ========================================================================== */

export type ReportKind = 'security-assessment' | 'configuration-analysis' | 'compliance' | 'conversion';

export type ReportStatus = 'ready' | 'generating' | 'not-generated';

export interface ReportRecord {
  id: string;
  kind: ReportKind;
  title: string;
  generatedAt: string | null;
  status: ReportStatus;
  /** Scope description captured at generation time. */
  scope: string;
  generatedBy: string;
  /** Snapshot of headline figures at generation time. */
  snapshot: {
    posture: number | null;
    openFindings: number | null;
    compliance: number | null;
    changes: number | null;
  };
}

/* ========================================================================== */
/* Notifications (demo event feed)                                            */
/* ========================================================================== */

export type NotificationKind =
  | 'security'
  | 'validation'
  | 'change'
  | 'report'
  | 'conversion'
  | 'scan'
  | 'info';

export interface DemoNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  tone: 'critical' | 'high' | 'ok' | 'info' | 'warning';
  createdAt: string;
  /** Optional in-app destination. */
  link?: { to: string; label: string };
  read?: boolean;
}

/* ========================================================================== */
/* AI assistant                                                                */
/* ========================================================================== */

export type AssistantTopic =
  | 'general'
  | 'posture'
  | 'finding'
  | 'device'
  | 'conversion'
  | 'report'
  | 'compliance';

export interface AssistantContext {
  topic: AssistantTopic;
  /** Finding id, device id, conversion id or report id depending on the topic. */
  refId?: string;
  label: string;
  detail?: string;
}

export interface AssistantCitation {
  label: string;
  to: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  context?: AssistantContext;
  /** Findings/devices this answer is grounded in (demo logic, not a model). */
  related?: { kind: 'finding' | 'device' | 'report' | 'conversion'; id: string; title: string; to: string }[];
  citations?: AssistantCitation[];
  bullets?: string[];
}
