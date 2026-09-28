import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, FlaskConical, Layers, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { BaselineTemplate, ConfigItem, Device } from '@/types';
import { CONFIG_BY_ID } from '@/data/configSchema';
import { BASELINE_TEMPLATES } from '@/data/templates';
import { useCyberSure } from '@/lib/store';
import { isValueCompliant } from '@/lib/analysis';
import { cx, DEVICE_TYPE_LABEL } from '@/utils/format';
import { Badge, DeviceStatusBadge, SecurityStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Primitives';
import { Modal } from '@/components/ui/Overlay';
import { DeviceTypeChip, VendorAvatar } from '@/components/common/Bits';
import { ConfigSectionList } from '@/components/config/ConfigSectionList';
import { EditSettingModal } from '@/components/config/EditSettingModal';
import { useNotify } from '@/components/ui/Toast';

/* -------------------------------------------------------------------------- */
/* Baseline template dialog                                                   */
/* -------------------------------------------------------------------------- */

function TemplateDialog({
  template,
  onClose,
}: {
  template: BaselineTemplate | null;
  onClose: () => void;
}) {
  const { devices, applyChange } = useCyberSure();
  const notify = useNotify();
  const [deviceId, setDeviceId] = useState<string>('');
  const [confirm, setConfirm] = useState(false);

  const candidates = useMemo(
    () => (template ? devices.filter((device) => template.appliesTo.includes(device.type)) : []),
    [devices, template],
  );

  useEffect(() => {
    setDeviceId(candidates[0]?.id ?? '');
    setConfirm(false);
  }, [template, candidates]);

  if (!template) return null;

  const device = candidates.find((candidate) => candidate.id === deviceId);
  const settings = template.settings
    .map((id) => CONFIG_BY_ID[id])
    .filter((def) => def && device && def.deviceTypes.includes(device.type));

  const pending = device
    ? settings.filter((def) => !isValueCompliant(def, device.config.values[def.id] ?? def.recommended))
    : [];

  const handleApply = () => {
    if (!device) return;
    let applied = 0;
    for (const def of settings) {
      const current = device.config.values[def.id] ?? def.recommended;
      if (current === def.recommended) continue;
      const change = applyChange({
        deviceId: device.id,
        configItemId: def.id,
        newValue: def.recommended,
        source: 'baseline-template',
        note: `Applied from the ${template.name} template.`,
      });
      if (change) applied += 1;
    }
    notify.success(
      'Baseline template applied',
      applied > 0
        ? `${applied} setting(s) on ${device.name} now match the ${template.name}. Findings were re-evaluated.`
        : `${device.name} already matches the ${template.name} — no changes were needed.`,
    );
    setConfirm(false);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Layers className="h-4 w-4" aria-hidden />}
      title={template.name}
      description={template.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            disabled={!device}
            loading={confirm}
            onClick={handleApply}
            icon={<FlaskConical className="h-3.5 w-3.5" aria-hidden />}
          >
            Apply to Device
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-1.5">Applies to</p>
            <p className="text-[12.5px] text-ink-100 [html.light_&]:text-ink-800">{template.appliesToLabel}</p>
          </div>
          <div>
            <label htmlFor="template-device" className="eyebrow mb-1.5 block">
              Target device
            </label>
            <select
              id="template-device"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="field cursor-pointer"
            >
              {candidates.length === 0 ? (
                <option value="">No device of this type</option>
              ) : (
                candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} — {candidate.vendor}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-1.5">Security checks covered</p>
          <ul className="space-y-1">
            {template.checks.map((check) => (
              <li key={check} className="flex items-start gap-2 text-[12px] text-dim">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                {check}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-1.5">
            Required settings ({settings.length})
            {device ? ` · ${pending.length} deviation${pending.length === 1 ? '' : 's'} on ${device.name}` : ''}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-700/70 scroll-thin [html.light_&]:border-ink-100">
            <table className="w-full border-collapse text-left text-[11.5px]">
              <thead className="sticky top-0 bg-ink-850 text-dimmer [html.light_&]:bg-ink-50">
                <tr>
                  <th scope="col" className="px-2.5 py-2 font-semibold">Setting</th>
                  <th scope="col" className="px-2.5 py-2 font-semibold">Current</th>
                  <th scope="col" className="px-2.5 py-2 font-semibold">Recommended</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((def) => {
                  const current = device ? (device.config.values[def.id] ?? def.recommended) : def.recommended;
                  const compliant = isValueCompliant(def, current);
                  return (
                    <tr key={def.id} className="border-t border-ink-700/50 [html.light_&]:border-ink-100">
                      <td className="px-2.5 py-1.5 text-ink-200 [html.light_&]:text-ink-700">
                        {def.setting}
                        <span className="ml-1.5 text-[10px] text-dimmer">{def.category}</span>
                      </td>
                      <td
                        className={cx(
                          'px-2.5 py-1.5 font-mono',
                          compliant ? 'text-ink-300 [html.light_&]:text-ink-600' : 'text-red-300 [html.light_&]:text-red-600',
                        )}
                      >
                        {current}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-emerald-300 [html.light_&]:text-emerald-600">
                        {def.recommended}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-200 [html.light_&]:text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Applying a template simulates the change locally. Every modified setting is validated and written to the
          audit trail; no real device is contacted.
        </p>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Configuration page                                                         */
/* -------------------------------------------------------------------------- */

export function ConfigurationPage() {
  const { devices, analysis, changes, applyChange } = useCyberSure();
  const navigate = useNavigate();
  const notify = useNotify();
  const [deviceId, setDeviceId] = useState<string>(devices[0]?.id ?? '');
  const [editItem, setEditItem] = useState<ConfigItem | null>(null);
  const [template, setTemplate] = useState<BaselineTemplate | null>(null);

  useEffect(() => {
    if (!devices.some((device) => device.id === deviceId)) {
      setDeviceId(devices[0]?.id ?? '');
    }
  }, [devices, deviceId]);

  const device: Device | undefined = devices.find((candidate) => candidate.id === deviceId);
  const items = device ? (analysis.itemsByDevice[device.id] ?? []) : [];
  const findings = device ? (analysis.findingsByDevice[device.id] ?? []) : [];
  const openFindings = findings.filter((finding) => finding.status === 'open');
  const deviceChanges = changes.filter((change) => change.deviceId === deviceId);
  const deviations = items.filter((item) => !isValueCompliant(item, item.value));

  const handleApply = ({ newValue }: { newValue: string; note?: string }) => {
    if (!device || !editItem) return;
    const change = applyChange({
      deviceId: device.id,
      configItemId: editItem.id,
      newValue,
      source: 'manual',
    });
    if (!change) {
      notify.warning('No change recorded', 'The proposed value matches the current configuration.');
      return;
    }
    notify.success(
      'Configuration change applied',
      `${device.name} · ${change.setting}: ${change.oldValue} → ${change.newValue} (${change.id}).`,
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
            Configuration
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-dimmer">
            <span>Inspect and edit the configuration collected from each device.</span>
          </p>
        </div>
        <Button variant="secondary" onClick={() => setTemplate(BASELINE_TEMPLATES[0])} icon={<Layers className="h-3.5 w-3.5" aria-hidden />}>
          Baseline templates
        </Button>
      </header>

      {/* Device selector */}
      <Card>
        <CardHeader
          title="Select a device"
          description="Configuration is grouped by category and compared against the CYBERSURE baseline."
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
          action={
            device ? (
              <div className="flex items-center gap-2">
                <SecurityStatusBadge status={analysis.securityStatusByDevice[device.id] ?? 'compliant'} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/devices/${device.id}?tab=configuration`)}
                >
                  Open device page
                </Button>
              </div>
            ) : null
          }
        />
        <CardBody>
          {devices.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              tone="neutral"
              title="No devices added"
              description="Add a device to begin configuration analysis."
              action={
                <Button variant="primary" onClick={() => navigate('/devices')}>
                  Go to device inventory
                </Button>
              }
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {devices.map((candidate) => {
                const count = (analysis.findingsByDevice[candidate.id] ?? []).filter((f) => f.status === 'open').length;
                const active = candidate.id === deviceId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setDeviceId(candidate.id)}
                    aria-pressed={active}
                    className={cx(
                      'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-accent-500/50 bg-accent-500/8'
                        : 'border-ink-700/60 hover:border-accent-500/30 hover:bg-ink-850 [html.light_&]:border-ink-100 [html.light_&]:hover:bg-ink-50',
                    )}
                  >
                    <VendorAvatar vendor={candidate.vendor} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink-50 [html.light_&]:text-ink-900">
                        {candidate.name}
                      </span>
                      <span className="block truncate text-[11px] text-dimmer">
                        {DEVICE_TYPE_LABEL[candidate.type]} · {candidate.ipAddress}
                      </span>
                    </span>                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {count > 0 ? (
                        <Badge tone="high">{count}</Badge>
                      ) : (
                        <Badge tone="ok" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
                          OK
                        </Badge>
                      )}
                      <DeviceStatusBadge status={candidate.status} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader
          title="Configuration baseline templates"
          description="Curated hardening profiles. Applying one simulates the recommended values on a device."
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="grid gap-3 md:grid-cols-3">
          {BASELINE_TEMPLATES.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-2 rounded-lg border border-ink-700/60 bg-ink-850 p-3 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[12.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{entry.name}</h3>
                <Badge tone="info">{entry.appliesToLabel}</Badge>
              </div>
              <p className="flex-1 text-[11.5px] leading-relaxed text-dimmer">{entry.description}</p>
              <p className="text-[11px] text-dimmer">
                {entry.settings.length} settings · {entry.checks.length} security checks
              </p>
              <Button variant="secondary" size="sm" onClick={() => setTemplate(entry)}>
                View template
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Configuration sections */}
      {device ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <VendorAvatar vendor={device.vendor} size={34} />
              <div>
                <p className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{device.name}</p>
                <p className="text-[11.5px] text-dimmer">
                  {device.config.osVersion} · {device.config.configVersion} · {items.length} settings
                </p>
              </div>
              <DeviceTypeChip type={device.type} />
            </div>
            <div className="flex items-center gap-2">
              {deviations.length > 0 ? (
                <Badge tone="high" icon={<AlertTriangle className="h-3 w-3" aria-hidden />}>
                  {deviations.length} deviation{deviations.length === 1 ? '' : 's'}
                </Badge>
              ) : (
                <Badge tone="ok" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
                  Matches baseline
                </Badge>
              )}
              <Badge tone="neutral">{openFindings.length} open findings</Badge>
              <Badge tone="neutral">{deviceChanges.length} changes</Badge>
            </div>
          </div>

          <ConfigSectionList device={device} items={items} findings={findings} onEdit={setEditItem} />
        </>
      ) : null}

      <EditSettingModal
        device={device!}
        item={editItem}
        open={Boolean(editItem) && Boolean(device)}
        onClose={() => setEditItem(null)}
        onApply={handleApply}
      />

      <TemplateDialog template={template} onClose={() => setTemplate(null)} />
    </div>
  );
}
