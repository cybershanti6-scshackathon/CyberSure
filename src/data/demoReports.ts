import type { ReportKind } from '@/types';

/* =============================================================================
 * Report catalogue
 * -----------------------------------------------------------------------------
 * The four report types CYBERSURE can produce in the demo. Each entry describes
 * what the report contains and which parts of the live demo state it draws from,
 * so a generated report always reflects the current estate.
 * ========================================================================== */

export interface ReportDefinition {
  kind: ReportKind;
  title: string;
  description: string;
  /** Sections rendered in the report detail view, in order. */
  sections: string[];
  /** Data sources, shown in the report "scope" line. */
  dataSources: string[];
  accent: 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'violet' | 'info';
}

export const REPORT_CATALOGUE: ReportDefinition[] = [
  {
    kind: 'security-assessment',
    title: 'Security Assessment Report',
    description:
      'Estate-wide security posture, severity breakdown, affected devices and prioritised remediation guidance.',
    sections: [
      'Executive Summary',
      'Security Posture',
      'Severity Breakdown',
      'Critical Findings',
      'High Findings',
      'Medium Findings',
      'Low Findings',
      'Affected Devices',
      'Configuration Changes',
      'Recommendations',
    ],
    dataSources: ['Security findings register', 'Device configuration baselines', 'Change audit trail'],
    accent: 'critical',
  },
  {
    kind: 'configuration-analysis',
    title: 'Configuration Analysis Report',
    description:
      'Per-device configuration drift against the CYBERSURE baseline, with the exact setting and value in each case.',
    sections: [
      'Executive Summary',
      'Configuration Baseline Overview',
      'Per-Device Analysis',
      'Drifted Settings',
      'Resolved Settings',
      'Recommendations',
    ],
    dataSources: ['Device configuration snapshots', 'Baseline catalogue', 'Change audit trail'],
    accent: 'info',
  },
  {
    kind: 'compliance',
    title: 'Compliance Report',
    description:
      'Control-level results for the CIS, NIST and ISO 27001 demo frameworks, including the current and expected state of every failure.',
    sections: [
      'Executive Summary',
      'Framework Scores',
      'Passing Controls',
      'Failing Controls',
      'Not Applicable Controls',
      'Remediation Plan',
      'Scope Statement',
    ],
    dataSources: ['Compliance control catalogue', 'Framework mappings', 'Finding register'],
    accent: 'ok',
  },
  {
    kind: 'conversion',
    title: 'Configuration Conversion Report',
    description:
      'Converter audit trail: platform pair, command mapping counts, manual-review items and validation outcome.',
    sections: [
      'Executive Summary',
      'Conversion Summary',
      'Source Platform',
      'Target Platform',
      'Command Mapping Detail',
      'Warnings & Manual Review',
      'Validation Results',
    ],
    dataSources: ['Converter run history', 'Mapping rule catalogue', 'Validation outcomes'],
    accent: 'violet',
  },
];

export const REPORT_BY_KIND: Record<ReportKind, ReportDefinition> = REPORT_CATALOGUE.reduce(
  (accumulator, definition) => {
    accumulator[definition.kind] = definition;
    return accumulator;
  },
  {} as Record<ReportKind, ReportDefinition>,
);

export function reportTitle(kind: ReportKind): string {
  return REPORT_BY_KIND[kind]?.title ?? kind;
}

/** A single scope line, used on the report cards and the report header. */
export function reportScope(kind: ReportKind, deviceCount: number): string {
  const base = `${deviceCount} devices`;
  switch (kind) {
    case 'security-assessment':
      return base;
    case 'configuration-analysis':
      return `${base} · baseline comparison`;
    case 'compliance':
      return `${base} · CIS, NIST, ISO 27001 (indicative)`;
    case 'conversion':
      return `${base} · converter audit trail`;
    default:
      return base;
  }
}
