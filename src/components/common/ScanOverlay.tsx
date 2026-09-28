import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MinusCircle, PlusCircle, Radar, ShieldCheck } from 'lucide-react';
import type { ScanResult } from '@/types';
import { SCAN_PHASES, useCyberSure } from '@/lib/store';
import { cx, formatDateTime, relativeTime } from '@/utils/format';
import { Modal } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Primitives';

/**
 * Scan progress + result panel. The animation is deliberately short so the
 * prototype never feels like it is waiting on a network.
 */
export function ScanOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { scanRunning, scanPhase, lastScanResult, analysis } = useCyberSure();
  const [visibleResult, setVisibleResult] = useState<ScanResult | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!scanRunning && open && lastScanResult) {
      setVisibleResult(lastScanResult);
    }
  }, [scanRunning, open, lastScanResult]);

  const progress = scanRunning ? ((scanPhase + 1) / SCAN_PHASES.length) * 100 : 100;
  const findingName = (id: string) => analysis.findings.find((finding) => finding.id === id)?.title ?? id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={scanRunning ? 'Running security scan' : 'Scan complete'}
      description={
        scanRunning
          ? 'CYBERSURE is re-collecting the configuration and re-evaluating every rule.'
          : 'The configuration was re-analysed against all baselines, policies and compliance controls.'
      }
      icon={<Radar className="h-4 w-4" aria-hidden />}
      size="md"
      footer={
        scanRunning ? (
          <Button variant="secondary" onClick={onClose} disabled>
            Scanning…
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                navigate('/issues');
              }}
            >
              View security issues
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        )
      }
    >
      {scanRunning ? (
        <div className="space-y-4">
          <ProgressBar value={progress} label="Scan progress" />
          <ol className="space-y-1.5">
            {SCAN_PHASES.map((phase, index) => {
              const done = index < scanPhase;
              const current = index === scanPhase;
              return (
                <li key={phase} className="flex items-center gap-2.5 text-[12.5px]">
                  <span
                    className={cx(
                      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px]',
                      done && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
                      current && 'border-accent-500/50 bg-accent-500/15 text-accent-300',
                      !done && !current && 'border-ink-600 text-dimmer',
                    )}
                    aria-hidden
                  >
                    {done ? <CheckCircle2 className="h-2.5 w-2.5" /> : current ? <Radar className="h-2.5 w-2.5 animate-pulse" /> : index + 1}
                  </span>
                  <span className={cx(current ? 'font-medium text-ink-50 [html.light_&]:text-ink-900' : 'text-dimmer')}>
                    {phase}
                  </span>
                  {current ? <span className="sr-only">in progress</span> : null}
                </li>
              );
            })}
          </ol>
          <p className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2 text-[11.5px] text-dimmer [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50">
            Scan — no real device is contacted. Findings are produced by CYBERSURE's local rule engine.
          </p>
        </div>
      ) : visibleResult ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Devices scanned', value: visibleResult.devicesScanned, tone: 'text-ink-50 [html.light_&]:text-ink-900' },
              { label: 'New findings', value: visibleResult.newFindings, tone: 'text-orange-400 [html.light_&]:text-orange-600' },
              { label: 'Resolved', value: visibleResult.resolvedFindings, tone: 'text-emerald-400 [html.light_&]:text-emerald-600' },
              { label: 'Still open', value: visibleResult.unresolvedFindings, tone: 'text-red-400 [html.light_&]:text-red-600' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
              >
                <p className="eyebrow">{stat.label}</p>
                <p className={cx('mt-1 text-[20px] font-semibold leading-none tabular-nums', stat.tone)}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-500/8 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-accent-400" aria-hidden />
            <p className="text-[12.5px] text-ink-200 [html.light_&]:text-ink-800">
              Security posture updated:{' '}
              <span className="font-semibold tabular-nums">{visibleResult.postureBefore}</span>
              <span className="px-1 text-dimmer">→</span>
              <span className="font-semibold tabular-nums text-accent-300 [html.light_&]:text-accent-700">
                {visibleResult.postureAfter}
              </span>
            </p>
            <Badge tone="neutral" className="ml-auto">
              {relativeTime(visibleResult.finishedAt)}
            </Badge>
          </div>

          {visibleResult.newFindingIds.length > 0 ? (
            <div>
              <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                <PlusCircle className="h-3 w-3" aria-hidden /> New findings
              </p>
              <ul className="space-y-1">
                {visibleResult.newFindingIds.map((id) => (
                  <li key={id} className="truncate rounded-md bg-ink-850 px-2.5 py-1.5 text-[12px] text-ink-200 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-700">
                    {findingName(id)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {visibleResult.resolvedFindingIds.length > 0 ? (
            <div>
              <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                <MinusCircle className="h-3 w-3" aria-hidden /> Resolved since last scan
              </p>
              <ul className="space-y-1">
                {visibleResult.resolvedFindingIds.map((id) => (
                  <li
                    key={id}
                    className="truncate rounded-md bg-emerald-500/8 px-2.5 py-1.5 text-[12px] text-emerald-300 [html.light_&]:bg-emerald-50 [html.light_&]:text-emerald-700"
                  >
                    {findingName(id)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[11px] text-dimmer">
            Scan {visibleResult.id} · finished {formatDateTime(visibleResult.finishedAt)} ·{' '}
            {(visibleResult.durationMs / 1000).toFixed(1)}s
          </p>
        </div>
      ) : (
        <p className="py-6 text-center text-[12.5px] text-dimmer">No scan results yet.</p>
      )}
    </Modal>
  );
}
