import { useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, ExternalLink, Info, ShieldAlert, Wrench } from 'lucide-react';
import type { Device, Finding } from '@/types';
import { cx, relativeTime } from '@/utils/format';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { VendorAvatar } from '@/components/common/Bits';
import { useNavigate } from 'react-router-dom';

export function FindingCard({
  finding,
  device,
  onFix,
  onAskAssistant,
  highlighted,
  compact,
}: {
  finding: Finding;
  device?: Device;
  onFix?: (configItemId: string) => void;
  onAskAssistant?: () => void;
  highlighted?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(Boolean(highlighted));
  const navigate = useNavigate();
  const resolved = finding.status === 'resolved';

  return (
    <article
      className={cx(
        'surface overflow-hidden transition-colors',
        highlighted && 'ring-1 ring-accent-500/40',
        resolved && 'opacity-90',
      )}
      aria-label={`${finding.severity} finding: ${finding.title}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-700/60 px-3.5 py-2.5 [html.light_&]:border-ink-100">
        <div className="flex min-w-0 items-start gap-2">
          {resolved ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <ShieldAlert
              className={cx(
                'mt-0.5 h-4 w-4 shrink-0',
                finding.severity === 'critical'
                  ? 'text-red-500'
                  : finding.severity === 'high'
                    ? 'text-orange-500'
                    : finding.severity === 'medium'
                      ? 'text-amber-500'
                      : 'text-accent-500',
              )}
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold leading-snug text-ink-50 [html.light_&]:text-ink-900">
              {finding.title}
            </h3>
            {device ? (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-dimmer">
                <VendorAvatar vendor={device.vendor} size={16} />
                <span className="font-medium text-ink-300 [html.light_&]:text-ink-600">{device.name}</span>
                <span aria-hidden>·</span>
                <span className="font-mono">{device.ipAddress}</span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <SeverityBadge severity={finding.severity} size="sm" />
          {resolved ? (
            <Badge tone="ok">Resolved</Badge>
          ) : (
            <Badge tone="neutral">{finding.issueCategory}</Badge>
          )}
        </div>
      </div>

      <div className="space-y-2.5 px-3.5 py-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-700/60 bg-ink-850 px-2.5 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
            <p className="eyebrow">Current configuration</p>
            <p className="mt-1 font-mono text-[12px] font-semibold text-red-300 [html.light_&]:text-red-600">
              {finding.currentValue}
            </p>
          </div>
          <div className="rounded-lg border border-ink-700/60 bg-ink-850 px-2.5 py-2 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
            <p className="eyebrow">Recommended</p>
            <p className="mt-1 font-mono text-[12px] font-semibold text-emerald-300 [html.light_&]:text-emerald-600">
              {finding.recommendedValue}
            </p>
          </div>
        </div>

        {!compact ? (
          <div>
            <p className="eyebrow mb-1">Risk</p>
            <p className="text-[12px] leading-relaxed text-dim">{finding.why}</p>
          </div>
        ) : null}

        {expanded && !compact ? (
          <div className="rounded-lg border border-accent-500/25 bg-accent-500/[0.06] px-2.5 py-2">
            <p className="eyebrow mb-1">Recommended fix</p>
            <p className="text-[12px] leading-relaxed text-dim">{finding.fix}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-dimmer">
              <Badge tone="violet">{finding.reference}</Badge>
              <span>
                {resolved
                  ? `Remediated ${finding.resolvedAt ? relativeTime(finding.resolvedAt) : ''}`
                  : `Detected ${relativeTime(finding.detectedAt)}`}
              </span>
              {resolved && finding.resolvedByChangeId ? (
                <span className="font-mono">{finding.resolvedByChangeId}</span>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/60 px-3.5 py-2.5 [html.light_&]:border-ink-100">
        {!compact ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-dimmer transition-colors hover:text-ink-100 [html.light_&]:hover:text-ink-800"
            aria-expanded={expanded}
          >
            <Info className="h-3 w-3" aria-hidden />
            {expanded ? 'Hide remediation detail' : 'Why it matters &amp; how to fix'}
          </button>
        ) : (
          <span className="text-[11px] text-dimmer">{finding.issueCategory}</span>
        )}

        <div className="flex items-center gap-2">
          {onAskAssistant ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAskAssistant}
              icon={<Bot className="h-3.5 w-3.5" aria-hidden />}
            >
              Ask Assistant
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/devices/${finding.deviceId}?tab=issues&focus=${finding.configItemId}`)}
            icon={<ExternalLink className="h-3.5 w-3.5" aria-hidden />}
          >
            View Configuration
          </Button>
          {onFix && !resolved ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onFix(finding.configItemId)}
              icon={<Wrench className="h-3.5 w-3.5" aria-hidden />}
              iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
            >
              Review &amp; fix
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
