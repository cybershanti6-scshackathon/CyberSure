import { useMemo } from 'react';
import { useCyberSure } from '@/lib/store';
import { CONFIG_SCHEMA } from '@/data/configSchema';
import { REPORT_CATALOGUE } from '@/data/demoReports';
import { DEVICE_TYPE_LABEL } from '@/utils/format';
import type { ReportKind } from '@/types';

export interface DeviceResult {
  kind: 'device';
  id: string;
  deviceId: string;
  title: string;
  subtitle: string;
  meta: string;
  score: number;
}

export interface FindingResult {
  kind: 'finding';
  id: string;
  deviceId: string;
  configItemId: string;
  title: string;
  subtitle: string;
  meta: string;
  status: 'open' | 'resolved';
  score: number;
}

export interface SettingResult {
  kind: 'setting';
  id: string;
  deviceId: string;
  configItemId: string;
  title: string;
  subtitle: string;
  meta: string;
  score: number;
}

export interface ReportResult {
  kind: 'report';
  id: string;
  reportKind: ReportKind;
  title: string;
  subtitle: string;
  meta: string;
  score: number;
}

export type SearchResult = DeviceResult | FindingResult | SettingResult | ReportResult;

export interface SearchResults {
  query: string;
  devices: DeviceResult[];
  findings: FindingResult[];
  settings: SettingResult[];
  reports: ReportResult[];
  total: number;
}

/**
 * Global search across devices, security findings, configuration settings and
 * reports. Ranking favours prefix matches, then substring matches, then severity.
 */
export function useGlobalSearch(query: string): SearchResults {
  const { devices, analysis, reports } = useCyberSure();
  const trimmed = query.trim().toLowerCase();

  return useMemo(() => {
    if (trimmed.length === 0) {
      return { query: trimmed, devices: [], findings: [], settings: [], reports: [], total: 0 };
    }

    const scoreOf = (haystack: string, needle: string): number => {
      const value = haystack.toLowerCase();
      const index = value.indexOf(needle);
      if (index === 0) return 100;
      if (index > 0) return 70 - Math.min(index, 40);
      // Also try matching on word boundaries inside the string.
      if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(value)) return 55;
      return 0;
    };

    const deviceResults: DeviceResult[] = devices
      .map((device) => ({
        kind: 'device' as const,
        id: device.id,
        deviceId: device.id,
        title: device.name,
        subtitle: `${device.vendor} · ${DEVICE_TYPE_LABEL[device.type]} · ${device.ipAddress}`,
        meta: analysis.securityStatusByDevice[device.id] ?? 'compliant',
        score: Math.max(
          scoreOf(device.name, trimmed),
          scoreOf(device.vendor, trimmed) * 0.8,
          scoreOf(device.ipAddress, trimmed),
          scoreOf(device.model, trimmed) * 0.7,
          scoreOf(DEVICE_TYPE_LABEL[device.type], trimmed) * 0.6,
        ),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const findingResults: FindingResult[] = analysis.findings
      .map((finding) => {
        const device = devices.find((candidate) => candidate.id === finding.deviceId);
        const relevance = Math.max(
          scoreOf(finding.title, trimmed),
          scoreOf(finding.issueCategory, trimmed) * 0.8,
          scoreOf(finding.currentValue, trimmed),
          scoreOf(finding.why, trimmed) * 0.5,
          scoreOf(device?.name ?? '', trimmed) * 0.5,
        );
        // The severity bonus only ranks matches; it must never create one.
        const bonus = finding.severity === 'critical' ? 6 : finding.severity === 'high' ? 3 : 0;
        return {
          kind: 'finding' as const,
          id: finding.id,
          deviceId: finding.deviceId,
          configItemId: finding.configItemId,
          title: finding.title,
          subtitle: `${device?.name ?? finding.deviceId} · ${finding.currentValue} → ${finding.recommendedValue}`,
          meta: finding.severity,
          status: finding.status,
          score: relevance > 0 ? relevance + bonus : 0,
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const settingResults: SettingResult[] = devices
      .flatMap((device) =>
        (analysis.itemsByDevice[device.id] ?? []).map((item) => ({
          kind: 'setting' as const,
          id: `${device.id}:${item.id}`,
          deviceId: device.id,
          configItemId: item.id,
          title: item.setting,
          subtitle: `${device.name} · ${item.category} · ${item.value}`,
          meta: item.severity,
          score: Math.max(
            scoreOf(item.setting, trimmed),
            scoreOf(item.label, trimmed),
            scoreOf(item.description, trimmed) * 0.6,
            scoreOf(item.value, trimmed) * 0.7,
            scoreOf(item.category, trimmed) * 0.5,
          ),
        })),
      )
      .concat(
        CONFIG_SCHEMA.filter((item) => scoreOf(item.setting, trimmed) > 0 && !deviceResults.some((device) => device.id === item.id)).map(
          (item) => ({
            kind: 'setting' as const,
            id: `schema:${item.id}`,
            deviceId: '',
            configItemId: item.id,
            title: item.setting,
            subtitle: `Setting definition · ${item.category}`,
            meta: item.severity,
            score: scoreOf(item.setting, trimmed) * 0.9,
          }),
        ),
      )
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const reportResults: ReportResult[] = REPORT_CATALOGUE.map((definition) => {
      const record = reports.find((report) => report.kind === definition.kind);
      return {
        kind: 'report' as const,
        id: definition.kind,
        reportKind: definition.kind,
        title: definition.title,
        subtitle: `${record ? `Generated ${record.generatedAt ?? ''}` : 'Not generated'} · ${definition.description}`,
        meta: record ? 'ready' : 'not-generated',
        score: Math.max(
          scoreOf(definition.title, trimmed),
          scoreOf(definition.description, trimmed) * 0.5,
          scoreOf(definition.kind, trimmed) * 0.8,
          ...definition.sections.map((section) => scoreOf(section, trimmed) * 0.6),
        ),
      };
    })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return {
      query: trimmed,
      devices: deviceResults,
      findings: findingResults,
      settings: settingResults,
      reports: reportResults,
      total: deviceResults.length + findingResults.length + settingResults.length + reportResults.length,
    };
  }, [trimmed, devices, analysis, reports]);
}
