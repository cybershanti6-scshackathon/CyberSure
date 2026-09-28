import { useMemo } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Pencil, ShieldAlert } from 'lucide-react';
import type { ConfigCategory, ConfigItem, Device, Finding } from '@/types';
import { complianceVerdict, isValueCompliant } from '@/lib/analysis';
import { cx } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Primitives';
import { SectionHeading } from '@/components/common/Bits';

const CATEGORY_ICON: Record<ConfigCategory, typeof ShieldAlert> = {
  'Management Access': ShieldAlert,
  Authentication: CheckCircle2,
  Firewall: ShieldAlert,
  'Network Services': Info,
  Logging: Info,
  Encryption: CheckCircle2,
  System: Info,
};

const CATEGORY_DESCRIPTION: Record<ConfigCategory, string> = {
  'Management Access': 'How administrators reach the device management plane',
  Authentication: 'Identity, credential strength and session controls',
  Firewall: 'Traffic filtering posture and zone segmentation',
  'Network Services': 'Legacy and auxiliary services exposed by the device',
  Logging: 'Audit trail, session logs and retention',
  Encryption: 'Transport and at-rest cryptographic strength',
  System: 'Platform hardening, firmware and lifecycle state',
};

/** Small status marker: icon + text, never colour alone. */
function VerdictBadge({ item }: { item: ConfigItem }) {
  const compliant = isValueCompliant(item, item.value);
  if (compliant) {
    return (
      <Badge tone="ok" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
        Baseline
      </Badge>
    );
  }
  return (
    <Badge
      tone={item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'high' : item.severity === 'medium' ? 'medium' : 'low'}
      icon={item.severity === 'critical' ? <AlertOctagon className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
    >
      Deviation
    </Badge>
  );
}

export function ConfigRow({
  item,
  device,
  finding,
  onEdit,
  highlighted,
  compact,
}: {
  item: ConfigItem;
  device: Device;
  finding?: Finding;
  onEdit: () => void;
  highlighted?: boolean;
  compact?: boolean;
}) {
  const compliant = isValueCompliant(item, item.value);

  return (
    <div
      className={cx(
        'group grid grid-cols-1 items-start gap-2 border-b border-ink-700/50 px-3.5 py-3 transition-colors last:border-0 sm:grid-cols-[minmax(0,1.1fr)_auto] sm:gap-4',
        '[html.light_&]:border-ink-100',
        highlighted && 'bg-accent-500/8 ring-1 ring-inset ring-accent-500/30',
        compliant && !highlighted && 'hover:bg-ink-850/60 [html.light_&]:hover:bg-ink-50',
        !compliant && !highlighted && 'bg-red-500/[0.03] hover:bg-red-500/[0.06]',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-ink-50 [html.light_&]:text-ink-900">{item.setting}</p>
          <VerdictBadge item={item} />
          {item.complianceRefs.length > 0 && !compact ? (
            <Tooltip content={item.complianceRefs.map((ref) => `${ref.framework.toUpperCase()} ${ref.control} — ${ref.label}`).join('\n')}>
              <span className="text-[10.5px] text-dimmer">
                {item.complianceRefs.length} baseline ref{item.complianceRefs.length === 1 ? '' : 's'}
              </span>
            </Tooltip>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-dimmer">{item.description}</p>
        {!compliant && finding ? (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300 [html.light_&]:text-ink-600">
            <span className="font-semibold text-red-400 [html.light_&]:text-red-600">{finding.title}.</span>{' '}
            {complianceVerdict(item, item.value).reason}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <div className="min-w-0 text-left sm:text-right">
          <p
            className={cx(
              'font-mono text-[12.5px] font-semibold',
              compliant ? 'text-ink-100 [html.light_&]:text-ink-800' : 'text-red-300 [html.light_&]:text-red-600',
            )}
          >
            {item.value}
          </p>
          <p className="mt-0.5 text-[10.5px] text-dimmer">
            Recommended: <span className="font-mono">{item.recommended}</span>
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          icon={<Pencil className="h-3.5 w-3.5" aria-hidden />}
          aria-label={`Edit ${item.setting} on ${device.name}`}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

export function ConfigSectionList({
  device,
  items,
  findings,
  onEdit,
  highlightId,
  compact,
  showIntro,
}: {
  device: Device;
  items: ConfigItem[];
  findings: Finding[];
  onEdit: (item: ConfigItem) => void;
  highlightId?: string | null;
  compact?: boolean;
  showIntro?: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<ConfigCategory, ConfigItem[]>();
    for (const item of items) {
      const bucket = map.get(item.category) ?? [];
      bucket.push(item);
      map.set(item.category, bucket);
    }
    return [...map.entries()];
  }, [items]);

  const findingByItem = useMemo(() => {
    const map = new Map<string, Finding>();
    for (const finding of findings) {
      if (finding.status === 'open') map.set(finding.configItemId, finding);
    }
    return map;
  }, [findings]);

  return (
    <div className="space-y-4">
      {showIntro ? (
        <SectionHeading
          title="Device configuration"
          description={`Configuration collected from ${device.name} via ${device.config.collectedVia}. Values are compared against the CYBERSURE baseline; deviations raise findings.`}
        />
      ) : null}

      {grouped.map(([category, categoryItems]) => {
        const Icon = CATEGORY_ICON[category];
        const deviations = categoryItems.filter((item) => !isValueCompliant(item, item.value)).length;
        return (
          <section key={category} className="surface overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 bg-ink-850/60 px-3.5 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-accent-400 [html.light_&]:text-accent-600" aria-hidden />
                <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-100 [html.light_&]:text-ink-800">
                  {category}
                </h3>
                <span className="text-[11px] text-dimmer">{categoryItems.length} settings</span>
              </div>
              {deviations > 0 ? (
                <Badge tone="high" icon={<AlertTriangle className="h-3 w-3" aria-hidden />}>
                  {deviations} deviation{deviations === 1 ? '' : 's'}
                </Badge>
              ) : (
                <Badge tone="ok" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
                  All at baseline
                </Badge>
              )}
            </header>
            <p className="border-b border-ink-700/50 px-3.5 py-1.5 text-[11px] text-dimmer [html.light_&]:border-ink-100">
              {CATEGORY_DESCRIPTION[category]}
            </p>
            <div>
              {categoryItems.map((item) => (
                <ConfigRow
                  key={item.id}
                  item={item}
                  device={device}
                  finding={findingByItem.get(item.id)}
                  onEdit={() => onEdit(item)}
                  highlighted={highlightId === item.id}
                  compact={compact}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
