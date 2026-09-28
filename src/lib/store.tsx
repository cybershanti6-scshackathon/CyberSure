import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  ConfigCategory,
  ConfigChange,
  ConversionResult,
  DemoNotification,
  Device,
  DeviceType,
  Environment,
  NotificationKind,
  ReportKind,
  ReportRecord,
  ScanResult,
  Vendor,
} from '@/types';
import { seedDevices } from '@/data/seedDevices';
import { seedChanges } from '@/data/seedChanges';
import { CONFIG_BY_ID, schemaForType } from '@/data/configSchema';
import { REPORT_CATALOGUE } from '@/data/demoReports';
import { analyse, type AnalysisResult } from './analysis';
import { nowIso } from '@/utils/format';

/* =============================================================================
 * CYBERSURE store
 * -----------------------------------------------------------------------------
 * One reducer owns the simulated estate. Every screen (dashboard, device pages,
 * issues, compliance, change history, reports) is derived from it, which is what
 * makes a remediation visible across the whole prototype.
 * ========================================================================== */

/** A completed converter run, retained so Reports and the assistant can cite it. */
export interface ConversionRecord {
  result: ConversionResult;
  deviceName: string | null;
  at: string;
}

export interface DemoState {
  devices: Device[];
  changes: ConfigChange[];
  lastScanAt: string | null;
  lastScanResult: ScanResult | null;
  scanRunning: boolean;
  scanPhase: number;
  notifications: DemoNotification[];
  conversions: ConversionRecord[];
  reports: ReportRecord[];
}

const initialState: DemoState = {
  devices: seedDevices,
  changes: seedChanges,
  lastScanAt: '2026-09-25T18:21:00Z',
  lastScanResult: null,
  scanRunning: false,
  scanPhase: 0,
  notifications: [],
  conversions: [],
  reports: [],
};

type Action =
  | { type: 'apply-change'; payload: { change: ConfigChange } }
  | { type: 'revert-change'; payload: { changeId: string } }
  | { type: 'add-device'; payload: { device: Device } }
  | { type: 'remove-device'; payload: { deviceId: string } }
  | { type: 'scan-start' }
  | { type: 'scan-phase'; payload: { phase: number } }
  | { type: 'scan-complete'; payload: { result: ScanResult; scannedAt: string } }
  | { type: 'notify'; payload: { notification: DemoNotification } }
  | { type: 'clear-notifications' }
  | { type: 'read-notification'; payload: { id: string } }
  | { type: 'conversion-complete'; payload: { record: ConversionRecord } }
  | { type: 'report-generate'; payload: { report: ReportRecord } }
  | { type: 'reset' };

let notificationCounter = 0;

export function buildNotification(
  kind: NotificationKind,
  title: string,
  detail: string,
  tone: DemoNotification['tone'],
  link?: DemoNotification['link'],
): DemoNotification {
  notificationCounter += 1;
  return {
    id: `ntf-${notificationCounter}-${Date.now().toString(36)}`,
    kind,
    title,
    detail,
    tone,
    createdAt: nowIso(),
    link,
  };
}

function nextChangeId(changes: ConfigChange[]): string {
  const highest = changes.reduce((max, change) => {
    const parsed = Number(change.id.replace('CHG-', ''));
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);
  return `CHG-${String(highest + 1).padStart(3, '0')}`;
}

function categoryOf(configItemId: string, deviceType: DeviceType): ConfigCategory {
  const def = CONFIG_BY_ID[configItemId];
  if (def) return def.category;
  return schemaForType(deviceType)[0]?.category ?? 'System';
}

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case 'apply-change': {
      const { change } = action.payload;
      return {
        ...state,
        devices: state.devices.map((device) =>
          device.id === change.deviceId
            ? {
                ...device,
                config: {
                  ...device.config,
                  values: { ...device.config.values, [change.configItemId]: change.newValue },
                },
              }
            : device,
        ),
        changes: [change, ...state.changes],
      };
    }

    case 'revert-change': {
      const change = state.changes.find((candidate) => candidate.id === action.payload.changeId);
      if (!change || change.changeStatus !== 'applied') return state;
      return {
        ...state,
        devices: state.devices.map((device) =>
          device.id === change.deviceId
            ? {
                ...device,
                config: {
                  ...device.config,
                  values: { ...device.config.values, [change.configItemId]: change.oldValue },
                },
              }
            : device,
        ),
        changes: state.changes.map((candidate) =>
          candidate.id === change.id ? { ...candidate, changeStatus: 'reverted' as const } : candidate,
        ),
      };
    }

    case 'add-device': {
      if (state.devices.some((device) => device.id === action.payload.device.id)) return state;
      return { ...state, devices: [...state.devices, action.payload.device] };
    }

    case 'remove-device': {
      return {
        ...state,
        devices: state.devices.filter((device) => device.id !== action.payload.deviceId),
        changes: state.changes.filter((change) => change.deviceId !== action.payload.deviceId),
      };
    }

    case 'scan-start':
      return { ...state, scanRunning: true, scanPhase: 0 };

    case 'scan-phase':
      return { ...state, scanPhase: action.payload.phase };

    case 'notify':
      return { ...state, notifications: [action.payload.notification, ...state.notifications].slice(0, 30) };

    case 'clear-notifications':
      return { ...state, notifications: [] };

    case 'read-notification':
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.payload.id ? { ...notification, read: true } : notification,
        ),
      };

    case 'conversion-complete':
      return { ...state, conversions: [action.payload.record, ...state.conversions].slice(0, 20) };

    case 'report-generate': {
      return {
        ...state,
        reports: [
          action.payload.report,
          ...state.reports.filter((report) => report.kind !== action.payload.report.kind),
        ],
      };
    }

    case 'scan-complete':
      return {
        ...state,
        scanRunning: false,
        scanPhase: 0,
        devices: state.devices.map((device) => ({ ...device, lastScan: action.payload.scannedAt })),
        lastScanAt: action.payload.result.finishedAt,
        lastScanResult: action.payload.result,
      };

    case 'reset':
      return { ...initialState };

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApplyChangeInput {
  deviceId: string;
  configItemId: string;
  newValue: string;
  source?: ConfigChange['source'];
  actor?: string;
  note?: string;
}

export interface AddDeviceInput {
  name: string;
  type: DeviceType;
  vendor: Vendor;
  ipAddress: string;
  environment: Environment;
  model?: string;
  site?: string;
}

export interface CyberSureContextValue extends DemoState {
  analysis: AnalysisResult;
  applyChange: (input: ApplyChangeInput) => ConfigChange | null;
  revertChange: (changeId: string) => void;
  addDevice: (input: AddDeviceInput) => Device | null;
  removeDevice: (deviceId: string) => void;
  runScan: () => Promise<ScanResult>;
  resetDemo: () => void;
  deviceById: (deviceId: string) => Device | undefined;
  changesForDevice: (deviceId: string) => ConfigChange[];
  notify: (notification: Omit<DemoNotification, 'id' | 'createdAt'>) => void;
  clearNotifications: () => void;
  markNotificationRead: (id: string) => void;
  recordConversion: (result: ConversionResult, deviceName?: string | null) => void;
  generateReport: (kind: ReportKind) => ReportRecord;
  reportByKind: (kind: ReportKind) => ReportRecord | undefined;
}

const CyberSureContext = createContext<CyberSureContextValue | null>(null);

export const SCAN_PHASES = [
  'Collecting configuration from devices…',
  'Analysing settings against baselines…',
  'Checking security rules…',
  'Checking compliance controls…',
  'Generating findings…',
] as const;

const SCAN_STEP_MS = 430;
const DEMO_ACTOR = 'demo.operator';
const VENDOR_OS: Record<Vendor, string> = {
  Cisco: 'IOS XE 17.9.4a',
  Fortinet: 'FortiOS 7.2.5',
  'Palo Alto Networks': 'PAN-OS 10.2.3',
  Juniper: 'Junos 21.4R3',
  MikroTik: 'RouterOS 7.13.3',
  Aruba: 'ArubaOS 8.10.0.10',
  Arista: 'EOS 4.29.2F',
  Huawei: 'VRP 8.20',
  Vyatta: 'VyOS 1.4.9',
  Other: 'Vendor OS 12.4.3',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function CyberSureProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Refs let the action callbacks build records from the latest state without
  // re-creating identities on every render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const scanInFlight = useRef(false);

  const analysis = useMemo(
    () => analyse(state.devices, state.changes),
    [state.devices, state.changes],
  );

  const buildChange = useCallback((input: ApplyChangeInput): ConfigChange | null => {
    const current = stateRef.current;
    const device = current.devices.find((candidate) => candidate.id === input.deviceId);
    if (!device) return null;
    const def = CONFIG_BY_ID[input.configItemId];
    if (!def) return null;
    const oldValue = device.config.values[input.configItemId] ?? def.recommended;
    if (oldValue === input.newValue) return null;
    return {
      id: nextChangeId(current.changes),
      deviceId: device.id,
      deviceName: device.name,
      configItemId: input.configItemId,
      setting: def.setting,
      category: categoryOf(input.configItemId, device.type),
      oldValue,
      newValue: input.newValue,
      recommended: def.recommended,
      validationStatus: 'validated',
      changeStatus: 'applied',
      timestamp: nowIso(),
      actor: input.actor ?? DEMO_ACTOR,
      source: input.source ?? 'remediation',
      note: input.note,
    };
  }, []);

  const applyChange = useCallback(
    (input: ApplyChangeInput) => {
      const change = buildChange(input);
      if (!change) return null;
      dispatch({ type: 'apply-change', payload: { change } });
      dispatch({
        type: 'notify',
        payload: {
          notification: buildNotification(
            'change',
            'Configuration change applied',
            `${change.deviceName} · ${change.setting}: ${change.oldValue} → ${change.newValue} (${change.id}).`,
            'ok',
            { to: '/changes', label: 'Open change history' },
          ),
        },
      });
      return change;
    },
    [buildChange],
  );

  const revertChange = useCallback((changeId: string) => {
    dispatch({ type: 'revert-change', payload: { changeId } });
  }, []);

  const addDevice = useCallback((input: AddDeviceInput): Device | null => {
    const current = stateRef.current;
    const id = `dev-${slugify(input.name)}`;
    if (current.devices.some((device) => device.id === id)) return null;

    const values: Record<string, string> = {};
    for (const def of schemaForType(input.type)) {
      // A freshly added device starts hardened, then gets one seeded
      // deviation so the analysis engine has something to report.
      values[def.id] = def.recommended;
    }
    if (values['mgmt.telnet'] !== undefined) values['mgmt.telnet'] = 'Enabled';
    if (values['auth.mfa'] !== undefined) values['auth.mfa'] = 'Disabled';
    if (values['log.configChanges'] !== undefined) values['log.configChanges'] = 'Disabled';

    const device: Device = {
      id,
      name: input.name.trim(),
      type: input.type,
      vendor: input.vendor,
      model: input.model?.trim() || `${input.vendor} device`,
      ipAddress: input.ipAddress.trim(),
      serial: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      site: input.site?.trim() || 'Local lab',
      environment: input.environment,
      status: 'online',
      lastScan: nowIso(),
      config: {
        values,
        osVersion: VENDOR_OS[input.vendor],
        configVersion: `cfg-${Math.floor(1000 + Math.random() * 8999)}`,
        collectedVia: 'Local collector (no live connection)',
      },
    };

    dispatch({ type: 'add-device', payload: { device } });
    return device;
  }, []);

  const removeDevice = useCallback((deviceId: string) => {
    dispatch({ type: 'remove-device', payload: { deviceId } });
  }, []);

  const runScan = useCallback(async (): Promise<ScanResult> => {
    if (scanInFlight.current) {
      const current = stateRef.current.lastScanResult;
      if (current) return current;
    }
    scanInFlight.current = true;

    const before = analyse(stateRef.current.devices, stateRef.current.changes);
    const beforeOpen = new Set(before.findings.filter((f) => f.status === 'open').map((f) => f.id));

    const startedAt = nowIso();
    const startedMs = Date.now();
    dispatch({ type: 'scan-start' });
    for (let phase = 0; phase < SCAN_PHASES.length; phase += 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(SCAN_STEP_MS);
      dispatch({ type: 'scan-phase', payload: { phase } });
    }

    // The scan re-collects configuration and re-evaluates every rule.
    const after = analyse(stateRef.current.devices, stateRef.current.changes);
    const afterOpen = new Set(after.findings.filter((f) => f.status === 'open').map((f) => f.id));
    const newFindingIds = [...afterOpen].filter((id) => !beforeOpen.has(id));
    const resolvedFindingIds = [...beforeOpen].filter((id) => !afterOpen.has(id));
    const finishedAt = nowIso();

    const result: ScanResult = {
      id: `SCAN-${finishedAt.replace(/[^0-9]/g, '').slice(0, 14)}`,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      devicesScanned: stateRef.current.devices.length,
      newFindings: newFindingIds.length,
      resolvedFindings: resolvedFindingIds.length,
      unresolvedFindings: afterOpen.size,
      postureBefore: before.posture,
      postureAfter: after.posture,
      newFindingIds,
      resolvedFindingIds,
      perDevice: after.devices.map((device) => ({
        deviceId: device.id,
        deviceName: device.name,
        issues: after.findingsByDevice[device.id]?.filter((f) => f.status === 'open').length ?? 0,
        posture: after.postureByDevice[device.id] ?? 0,
      })),
    };

    dispatch({ type: 'scan-complete', payload: { result, scannedAt: finishedAt } });
    dispatch({
      type: 'notify',
      payload: {
        notification: buildNotification(
          'scan',
          'Security scan complete',
          `${result.devicesScanned} devices analysed · ${result.newFindings} new · ${result.resolvedFindings} resolved · posture ${result.postureBefore} → ${result.postureAfter}.`,
          result.unresolvedFindings > 0 ? 'warning' : 'ok',
          { to: '/issues', label: 'View security analysis' },
        ),
      },
    });
    scanInFlight.current = false;
    return result;
  }, []);

  const resetDemo = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  const deviceById = useCallback(
    (deviceId: string) => stateRef.current.devices.find((device) => device.id === deviceId),
    [],
  );

  const changesForDevice = useCallback(
    (deviceId: string) => stateRef.current.changes.filter((change) => change.deviceId === deviceId),
    [],
  );

  const notify = useCallback((notification: Omit<DemoNotification, 'id' | 'createdAt'>) => {
    dispatch({
      type: 'notify',
      payload: {
        notification: { ...notification, id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, createdAt: nowIso() },
      },
    });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'clear-notifications' });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'read-notification', payload: { id } });
  }, []);

  const recordConversion = useCallback((result: ConversionResult, deviceName: string | null = null) => {
    const at = nowIso();
    dispatch({ type: 'conversion-complete', payload: { record: { result, deviceName, at } } });
    const fromLabel = result.from;
    const toLabel = result.to;
    dispatch({
      type: 'notify',
      payload: {
        notification: {
          id: `ntf-conv-${Date.now().toString(36)}`,
          kind: 'conversion',
          title: `Configuration converted: ${fromLabel} → ${toLabel}`,
          detail: `${result.converted} converted · ${result.needsReview} need review · ${result.warnings.length} warning(s).`,
          tone: result.needsReview > 0 ? 'warning' : 'ok',
          createdAt: at,
          link: { to: '/converter', label: 'Open converter' },
        },
      },
    });
  }, []);

  const generateReport = useCallback((kind: ReportKind): ReportRecord => {
    const current = stateRef.current;
    const snapshotAnalysis = analyse(current.devices, current.changes);
    const open = snapshotAnalysis.findings.filter((finding) => finding.status === 'open');
    const report: ReportRecord = {
      id: `RPT-${kind.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}`,
      kind,
      title: REPORT_CATALOGUE.find((entry) => entry.kind === kind)?.title ?? kind,
      generatedAt: nowIso(),
      status: 'ready',
      scope: `${current.devices.length} devices`,
      generatedBy: 'demo.operator',
      snapshot:
        kind === 'compliance'
          ? { posture: null, openFindings: null, compliance: snapshotAnalysis.compliance.overall, changes: null }
          : kind === 'conversion'
            ? { posture: null, openFindings: null, compliance: null, changes: current.conversions.length }
            : {
                posture: snapshotAnalysis.posture,
                openFindings: open.length,
                compliance: snapshotAnalysis.compliance.overall,
                changes: current.changes.length,
              },
    };
    dispatch({ type: 'report-generate', payload: { report } });
    dispatch({
      type: 'notify',
      payload: {
        notification: {
          id: `ntf-rpt-${Date.now().toString(36)}`,
          kind: 'report',
          title: `Report generated: ${report.title}`,
          detail: `Snapshot captured from ${report.scope}. This is report output — no PDF was produced.`,
          tone: 'info',
          createdAt: report.generatedAt ?? nowIso(),
          link: { to: `/reports?report=${kind}`, label: 'View report' },
        },
      },
    });
    return report;
  }, []);

  const reportByKind = useCallback(
    (kind: ReportKind) => stateRef.current.reports.find((report) => report.kind === kind),
    [],
  );

  const value: CyberSureContextValue = {
    ...state,
    analysis,
    applyChange,
    revertChange,
    addDevice,
    removeDevice,
    runScan,
    resetDemo,
    deviceById,
    changesForDevice,
    notify,
    clearNotifications,
    markNotificationRead,
    recordConversion,
    generateReport,
    reportByKind,
  };

  return <CyberSureContext.Provider value={value}>{children}</CyberSureContext.Provider>;
}

export function useCyberSure(): CyberSureContextValue {
  const context = useContext(CyberSureContext);
  if (!context) throw new Error('useCyberSure must be used inside <CyberSureProvider>');
  return context;
}
