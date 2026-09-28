import type {
  AssistantContext,
  AssistantMessage,
  ConversionResult,
  Device,
  Finding,
  ReportRecord,
  Severity,
} from '@/types';
import type { AnalysisResult } from '@/lib/analysis';
import { CONFIG_BY_ID } from '@/data/configSchema';
import { PLATFORM_BY_ID } from '@/data/platforms';
import { nowIso, relativeTime } from '@/utils/format';

/* =============================================================================
 * CYBERSURE assistant (DEMO LOGIC — NO EXTERNAL AI SERVICE)
 * -----------------------------------------------------------------------------
 * Every answer is composed locally from the same demo state the rest of the
 * console renders. The assistant therefore stays consistent with the findings
 * register: remediate Telnet in the UI and this text changes with it.
 *
 * It deliberately never claims to have network access.
 * ========================================================================== */

const DISCLAIMER =
  'Assistant answers are composed locally from the configuration in this prototype — the assistant has no connection to any real network.';

export interface AssistantContextBundle {
  analysis: AnalysisResult;
  devices: Device[];
  lastConversion?: ConversionResult | null;
  report?: ReportRecord | null;
}

let messageCounter = 0;

function makeId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function userMessage(text: string, context?: AssistantContext): AssistantMessage {
  return { id: makeId('user'), role: 'user', text, createdAt: nowIso(), context };
}

export interface AssistantAnswer {
  text: string;
  bullets?: string[];
  related?: AssistantMessage['related'];
}

function findingRelated(finding: Finding): NonNullable<AssistantMessage['related']>[number] {
  return {
    kind: 'finding',
    id: finding.id,
    title: `${finding.title} — ${finding.deviceId}`,
    to: `/issues?focus=${encodeURIComponent(finding.id)}`,
  };
}

function severityWord(severity: Severity): string {
  return severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'medium';
}

/* -------------------------------------------------------------------------- */
/* Intent detection — deliberately simple keyword matching                     */
/* -------------------------------------------------------------------------- */

type Intent =
  | 'telnet'
  | 'explain-finding'
  | 'remediate'
  | 'posture'
  | 'conversion'
  | 'report'
  | 'compliance'
  | 'configuration'
  | 'device'
  | 'fallback';

function detectIntent(query: string, context?: AssistantContext): Intent {
  const q = query.toLowerCase();
  if (context?.topic === 'posture' || /posture|overall|summary|summarise|summarize/.test(q)) return 'posture';
  if (context?.topic === 'conversion' || /conversion|convert|translated|mapping|review flag/.test(q)) return 'conversion';
  if (context?.topic === 'report' || /report/.test(q)) return 'report';
  if (context?.topic === 'compliance' || /compliance|cis|nist|iso ?27001|framework|control/.test(q)) return 'compliance';
  if (context?.topic === 'device' || /device|core-router|firewall|switch|router/.test(q)) return 'device';
  if (/telnet/.test(q)) return 'telnet';
  if (/fix|remediate|remediation|resolve|repair|how should i/.test(q)) return 'remediate';
  if (/explain|what does|why is|what is|meaning|means/.test(q)) return 'explain-finding';
  if (/configuration|config/.test(q)) return 'configuration';
  return 'fallback';
}

/* -------------------------------------------------------------------------- */
/* Answer builders                                                             */
/* -------------------------------------------------------------------------- */

function answerPosture(bundle: AssistantContextBundle): AssistantAnswer {
  const { analysis, devices } = bundle;
  const b = analysis.breakdown;
  const posture = analysis.posture;
  const top = analysis.findings.filter((finding) => finding.status === 'open').slice(0, 3);
  const verdict =
    posture >= 85
      ? 'in good shape'
      : posture >= 70
        ? 'acceptable but with clear remediation work outstanding'
        : 'below the target baseline';
  return {
    text: `Estate security posture is ${posture}/100 across ${devices.length} devices, which is ${verdict}. ${b.open} findings are open (${b.critical} critical, ${b.high} high, ${b.medium} medium, ${b.low} low) and ${b.resolved} have been resolved through validated changes. Overall compliance sits at ${analysis.compliance.overall}%.`,
    bullets: [
      `Highest-impact open findings: ${top.map((f) => `${f.title} (${f.deviceId})`).join('; ') || 'none'}.`,
      'Posture is derived from a severity-weighted mean of per-device scores, so remediating one high finding moves both that device and the estate score.',
      'Fixing a critical finding usually lifts compliance too, because the same setting backs several controls.',
    ],
    related: top.map(findingRelated),
  };
}

function answerTelnet(bundle: AssistantContextBundle): AssistantAnswer {
  const telnetFindings = bundle.analysis.findings.filter(
    (finding) =>
      finding.configItemId === 'mgmt.telnet' || /telnet/i.test(finding.title) || /telnet/i.test(finding.currentValue),
  );
  const open = telnetFindings.filter((finding) => finding.status === 'open');
  return {
    text:
      'Telnet transmits the whole administrative session — including the username and password — in clear text, and it negotiates no cryptography at all. Anyone able to observe traffic on the management path can capture credentials, then replay them against the device. SSHv2 replaces every one of those weaknesses: it encrypts the session, authenticates the host key, and is the protocol the CIS, NIST and ISO 27001 baselines expect for administrative access. CYBERSURE flags Telnet as a finding because it is a credential-exposure risk on the management plane, not because the protocol is merely old.',
    bullets: [
      'Remediation: set Telnet Access to "Disabled" and keep SSH version 2 enabled.',
      'Confirm the SSH service is enabled before disabling Telnet, or you can lock yourself out of the device.',
      'Restrict the management ACL to your administrative subnets while you are in there.',
      open.length > 0
        ? `Open in this estate on: ${open.map((f) => f.deviceId).join(', ')}.`
        : 'No open Telnet findings remain in the estate — it has been remediated.',
    ],
    related: [...telnetFindings].slice(0, 4).map(findingRelated),
  };
}

function answerFinding(finding: Finding, device: Device | undefined, bundle: AssistantContextBundle): AssistantAnswer {
  const def = CONFIG_BY_ID[finding.configItemId];
  const siblings = bundle.analysis.findings.filter(
    (candidate) => candidate.configItemId === finding.configItemId && candidate.deviceId !== finding.deviceId,
  );
  const resolved = finding.status === 'resolved';
  return {
    text: `“${finding.title}” is a ${severityWord(finding.severity)}-severity configuration finding on ${device?.name ?? finding.deviceId}. The setting “${def?.label ?? finding.configItemId}” is set to “${finding.currentValue}” while the CYBERSURE baseline expects “${finding.recommendedValue}”. ${finding.why}${
      resolved
        ? ` This finding was resolved ${finding.resolvedAt ? relativeTime(finding.resolvedAt) : ''}${finding.resolvedByChangeId ? ` by change ${finding.resolvedByChangeId}` : ''} and now appears in the audit trail rather than the open register.`
        : ''
    }`,
    bullets: [
      `Why it matters: ${finding.why}`,
      `Recommended fix: ${finding.fix}`,
      `Policy reference: ${finding.reference}`,
      siblings.length > 0
        ? `The same setting is also flagged on ${siblings.length} other device${siblings.length === 1 ? '' : 's'}: ${siblings.map((s) => s.deviceId).join(', ')}.`
        : 'No other device in the estate has this setting in a non-compliant state.',
    ],
    related: [findingRelated(finding), ...siblings.slice(0, 3).map(findingRelated)],
  };
}

function answerRemediation(finding: Finding | undefined, device: Device | undefined): AssistantAnswer {
  if (!finding) {
    return {
      text: 'I need a finding to give you a remediation plan. Open the security analysis register, choose a finding, then use “Ask Assistant” on it — I will pick up the exact device, setting and current value.',
      bullets: [
        'Security Analysis → pick a finding → Ask Assistant',
        'The Device Detail → Security Issues tab also has an Ask Assistant action per finding.',
      ],
    };
  }
  return {
    text: `To remediate “${finding.title}” on ${device?.name ?? finding.deviceId}, set ${finding.configItemId} to “${finding.recommendedValue}”. The remediation flow is: open the finding, choose Review & fix, change the value, then run Validate Change. Validation checks syntax, security policy, compliance and configuration conflicts. Only when all four pass can you apply the demo change, which resolves the finding, updates posture and compliance, and writes an entry to the change history.`,
    bullets: [
      `Current value: ${finding.currentValue} → recommended: ${finding.recommendedValue}`,
      `Why the change is safe: ${finding.fix}`,
      `Policy reference: ${finding.reference}`,
      'Applying a change in this prototype is a local simulation — no real device is contacted.',
    ],
    related: [findingRelated(finding)],
  };
}

function answerCompliance(bundle: AssistantContextBundle): AssistantAnswer {
  const { analysis } = bundle;
  const frameworks = analysis.compliance.frameworks
    .map((framework) => `${framework.id.toUpperCase()} ${framework.score}% (${framework.passed} passed / ${framework.failed} failed)`)
    .join(', ');
  const failed = analysis.compliance.results.filter((result) => result.status === 'fail');
  const top = failed.slice(0, 4);
  return {
    text: `Overall demo compliance is ${analysis.compliance.overall}%. Framework coverage: ${frameworks}. ${failed.length} control evaluations are currently failing across the estate. A compliance warning is not a separate class of problem — it is almost always the same underlying configuration deviation the security register already flags, mapped to a control in the framework. Fix the configuration and the control flips to passing.`,
    bullets: [
      ...top.map((result) => {
        const device = bundle.devices.find((candidate) => candidate.id === result.deviceId);
        return `${result.severity.toUpperCase()} on ${device?.name ?? result.deviceId}: ${result.currentState}`;
      }),
      'The Compliance page lists requirement, current state, expected state, affected device and recommended action for each failure.',
      'These are indicative indicators only — CYBERSURE does not provide or claim certification for CIS, NIST or ISO 27001.',
    ],
    related: top
      .map((result) => analysis.findings.find((finding) => finding.id === result.findingId))
      .filter((finding): finding is Finding => Boolean(finding))
      .slice(0, 3)
      .map(findingRelated),
  };
}

function answerConversion(result: ConversionResult | null | undefined): AssistantAnswer {
  if (!result) {
    return {
      text: 'No conversion has been run in this session yet. Open the Configuration Converter, choose a source and target platform, then run the conversion — I will then explain the mapping, the warnings and the validation outcome.',
      bullets: [
        'Fully mapped demo pairs: Cisco IOS XE ↔ Juniper Junos.',
        'Partial coverage: Cisco IOS XE → FortiOS, Cisco IOS XE → PAN-OS, Cisco IOS → Junos, RouterOS → Cisco IOS XE.',
        'Any other combination is reported as unsupported rather than guessed.',
      ],
    };
  }
  const from = PLATFORM_BY_ID[result.from]?.name ?? result.from;
  const to = PLATFORM_BY_ID[result.to]?.name ?? result.to;
  const reviewItems = result.mapping.filter((entry) => entry.status !== 'converted');
  const reviewDetail = reviewItems
    .slice(0, 3)
    .map((entry) => `Line ${entry.line} (${entry.source}): ${entry.note ?? entry.ruleLabel}`);
  return {
    text: `The ${from} → ${to} conversion processed ${result.processed} commands: ${result.converted} converted automatically, ${result.needsReview} mapped with a manual-review flag, and ${result.unsupported} not converted. ${result.status === 'valid' ? 'Validation passed cleanly' : result.status === 'valid-with-review' ? 'Validation completed with review items' : 'Validation reported a problem that needs fixing'}. The review flags are the honest part of the output: a converter translates intent, not vendor behaviour. Security policy, credentials, SNMP communities and management-access models rarely survive a platform change automatically, and CYBERSURE marks those lines rather than pretending they did.`,
    bullets: [
      ...(reviewDetail.length > 0 ? reviewDetail : ['No command needed manual review in this run.']),
      `Warnings raised: ${result.warnings.length} (including the standing vendor-specific caveat).`,
      'Review the diff against the target platform documentation before any deployment.',
    ],
    related: [{ kind: 'conversion', id: result.id, title: `${from} → ${to} (${result.id})`, to: '/converter' }],
  };
}

function answerReport(report: ReportRecord | null | undefined, bundle: AssistantContextBundle): AssistantAnswer {
  if (!report) {
    return {
      text: 'No report has been generated in this session. Open Reports, choose a report type and select Generate — the report captures a snapshot of the current demo state, and I can then walk you through any section of it.',
    };
  }
  const { analysis } = bundle;
  return {
    text: `The ${report.title} was generated ${report.generatedAt ? relativeTime(report.generatedAt) : 'just now'} against ${report.scope}. Headline figures at generation time: security posture ${report.snapshot.posture ?? 'n/a'}/100, ${report.snapshot.openFindings ?? 'n/a'} open findings, compliance ${report.snapshot.compliance ?? 'n/a'}%, and ${report.snapshot.changes ?? 'n/a'} configuration changes recorded. Reports capture a point-in-time snapshot, so regenerating after a remediation will show the improved numbers — the live dashboard always reflects the current state (posture ${analysis.posture}/100).`,
    bullets: [
      'Each report section is populated from the live demo state at generation time.',
      'Use Download Demo PDF to open the browser print dialog and save the report as a PDF.',
      'Downloaded output is clearly watermarked.',
    ],
    related: [{ kind: 'report', id: report.id, title: report.title, to: `/reports?report=${report.kind}` }],
  };
}

function answerDevice(device: Device, bundle: AssistantContextBundle): AssistantAnswer {
  const findings = bundle.analysis.findingsByDevice[device.id] ?? [];
  const open = findings.filter((finding) => finding.status === 'open');
  const posture = bundle.analysis.postureByDevice[device.id] ?? 0;
  const settings = bundle.analysis.itemsByDevice[device.id] ?? [];
  const drifted = settings.filter((item) => item.value !== item.recommended);
  return {
    text: `${device.name} is a ${device.vendor} ${device.type.replace('-', ' ')} at ${device.ipAddress} in the ${device.environment} environment, running ${device.config.osVersion} (configuration ${device.config.configVersion}). Security posture ${posture}/100 with ${open.length} open finding${open.length === 1 ? '' : 's'}. ${drifted.length} of ${settings.length} applicable settings deviate from the CYBERSURE baseline, and ${findings.length - open.length} finding${findings.length - open.length === 1 ? ' has' : 's have'} been resolved through the change history.`,
    bullets: [
      ...(open.length > 0
        ? open.map((finding) => `${finding.severity.toUpperCase()}: ${finding.title} (${finding.currentValue} → ${finding.recommendedValue})`)
        : ['No open configuration findings on this device.']),
      `Last analysed ${relativeTime(device.lastScan)}.`,
    ],
    related: [
      { kind: 'device', id: device.id, title: device.name, to: `/devices/${device.id}` },
      ...open.slice(0, 3).map(findingRelated),
    ],
  };
}

function answerConfiguration(query: string, bundle: AssistantContextBundle): AssistantAnswer {
  const q = query.toLowerCase();
  const match = bundle.analysis.findings.find(
    (finding) => q.includes(finding.currentValue.toLowerCase()) || finding.title.toLowerCase().includes(q.split(' ').pop() ?? ''),
  );
  if (match) return answerFinding(match, bundle.devices.find((d) => d.id === match.deviceId), bundle);

  const converterNote = bundle.analysis.itemsByDevice[bundle.devices[0]?.id ?? ''] ?? [];
  return {
    text: `A CYBERSURE configuration is judged line by line against a shared baseline catalogue. Each setting has a recommended value, an accepted set of equivalent hardened values, and the severity of the finding raised when it deviates. In this estate there are ${bundle.analysis.itemsByDevice[bundle.devices[0]?.id ?? '']?.length ?? 0} applicable settings on the first device and ${bundle.analysis.findings.filter((f) => f.status === 'open').length} open deviations across the estate. Give me a setting name (for example “Telnet”, “Password Policy” or “Firewall Logging”) and I will explain its current state.`,
    bullets: [
      `Settings available on ${bundle.devices[0]?.name ?? 'the first device'}: ${converterNote.slice(0, 6).map((item) => item.setting).join(', ')}…`,
      'Configuration Converter translates a configuration between platforms; it does not change the baseline.',
      'Any change you apply is validated (syntax, security policy, compliance, conflicts) before it is recorded.',
    ],
  };
}

function answerFallback(query: string, bundle: AssistantContextBundle, context?: AssistantContext): AssistantAnswer {
  const open = bundle.analysis.findings.filter((finding) => finding.status === 'open');
  return {
    text: `I can explain anything CYBERSURE knows about this estate: ${bundle.devices.length} devices, ${open.length} open findings, posture ${bundle.analysis.posture}/100 and compliance ${bundle.analysis.compliance.overall}%. You asked: “${query}”. ${
      context?.label ? `I am currently anchored to ${context.label}, so I will keep answering about that unless you switch context.` : ''
    } Try one of the questions below, or open a finding, device, conversion or report and use the Ask Assistant action there — the answer is grounded in that exact object.`,
    bullets: [
      '“Why is Telnet considered insecure?”',
      '“What does this firewall finding mean?”',
      '“How should I remediate this issue?”',
      '“Explain the configuration conversion result.”',
      '“Summarize security posture.”',
      '“What does this compliance warning mean?”',
    ],
    related: open.slice(0, 2).map(findingRelated),
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function buildAssistantAnswer(
  query: string,
  context: AssistantContext | undefined,
  bundle: AssistantContextBundle,
): AssistantAnswer {
  const intent = detectIntent(query, context);

  // Context beats keywords: a finding-scoped question always answers about it.
  if (context?.topic === 'finding' && context.refId) {
    const finding = bundle.analysis.findings.find((candidate) => candidate.id === context.refId);
    if (finding) {
      if (intent === 'remediate') return answerRemediation(finding, bundle.devices.find((d) => d.id === finding.deviceId));
      if (finding.configItemId === 'mgmt.telnet' || /telnet/i.test(finding.title)) return answerTelnet(bundle);
      return answerFinding(finding, bundle.devices.find((device) => device.id === finding.deviceId), bundle);
    }
  }
  if (context?.topic === 'device' && context.refId) {
    const device = bundle.devices.find((candidate) => candidate.id === context.refId);
    if (device && intent !== 'remediate') return answerDevice(device, bundle);
  }
  if (context?.topic === 'conversion') return answerConversion(bundle.lastConversion ?? null);
  if (context?.topic === 'report') return answerReport(bundle.report ?? null, bundle);
  if (context?.topic === 'compliance') return answerCompliance(bundle);
  if (context?.topic === 'posture') return answerPosture(bundle);

  switch (intent) {
    case 'telnet':
      return answerTelnet(bundle);
    case 'posture':
      return answerPosture(bundle);
    case 'compliance':
      return answerCompliance(bundle);
    case 'conversion':
      return answerConversion(bundle.lastConversion ?? null);
    case 'report':
      return answerReport(bundle.report ?? null, bundle);
    case 'remediate': {
      const finding =
        (context?.refId ? bundle.analysis.findings.find((candidate) => candidate.id === context.refId) : undefined) ??
        openTelnet(bundle);
      return answerRemediation(finding, finding ? bundle.devices.find((device) => device.id === finding.deviceId) : undefined);
    }
    case 'explain-finding': {
      const finding =
        (context?.refId ? bundle.analysis.findings.find((candidate) => candidate.id === context.refId) : undefined) ??
        bundle.analysis.findings.find((candidate) => {
          const q = query.toLowerCase();
          return candidate.title.toLowerCase().includes(q) || q.includes(candidate.title.toLowerCase());
        }) ??
        openTelnet(bundle);
      if (finding) return answerFinding(finding, bundle.devices.find((device) => device.id === finding.deviceId), bundle);
      return answerConfiguration(query, bundle);
    }
    case 'configuration':
      return answerConfiguration(query, bundle);
    case 'device': {
      const named = bundle.devices.find(
        (device) => query.toLowerCase().includes(device.name.toLowerCase()) || device.name.toLowerCase().includes(query.toLowerCase()),
      );
      if (named) return answerDevice(named, bundle);
      if (context?.topic === 'device' && context.refId) {
        const device = bundle.devices.find((candidate) => candidate.id === context.refId);
        if (device) return answerDevice(device, bundle);
      }
      return answerPosture(bundle);
    }
    case 'fallback':
    default:
      return answerFallback(query, bundle, context);
  }
}

function openTelnet(bundle: AssistantContextBundle): Finding | undefined {
  return bundle.analysis.findings.find(
    (finding) => finding.status === 'open' && (finding.configItemId === 'mgmt.telnet' || /telnet/i.test(finding.title)),
  );
}

export function assistantMessage(answer: AssistantAnswer, context?: AssistantContext): AssistantMessage {
  return {
    id: makeId('assistant'),
    role: 'assistant',
    text: answer.text,
    bullets: answer.bullets,
    related: answer.related,
    createdAt: nowIso(),
    context,
  };
}

export const ASSISTANT_DISCLAIMER = DISCLAIMER;

/** Quick prompts offered above the conversation. */
export const QUICK_ACTIONS: { id: string; label: string; prompt: string; context?: AssistantContext }[] = [
  { id: 'explain-finding', label: 'Explain this finding', prompt: 'Explain this finding', context: { topic: 'finding', label: 'Current finding' } },
  { id: 'analyse-config', label: 'Analyze this configuration', prompt: 'Analyze this configuration' },
  { id: 'conversion-warning', label: 'Explain conversion warning', prompt: 'Explain the configuration conversion result', context: { topic: 'conversion', label: 'Latest conversion' } },
  { id: 'remediate', label: 'How should I remediate this?', prompt: 'How should I remediate this issue?' },
  { id: 'posture', label: 'Summarize security posture', prompt: 'Summarize security posture', context: { topic: 'posture', label: 'Estate security posture' } },
];
