import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileClock, ShieldCheck, X } from 'lucide-react';
import type { ChangeStatus, ChangeValidationStatus } from '@/types';
import { useCyberSure } from '@/lib/store';
import { FilterSelect, SearchField } from '@/components/devices/AddDeviceModal';
import { Card, CardBody, CardHeader, StatBlock } from '@/components/ui/Card';
import { ChangeTable } from '@/components/changes/ChangeTable';

type StatusFilter = ChangeStatus | 'all';
type ValidationFilter = ChangeValidationStatus | 'all';

export function ChangesPage() {
  const { changes, devices } = useCyberSure();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [validation, setValidation] = useState<ValidationFilter>('all');
  const [deviceId, setDeviceId] = useState('all');

  const focusId = searchParams.get('focus');
  useEffect(() => {
    if (focusId) {
      setQuery('');
      setStatus('all');
      setValidation('all');
      setDeviceId('all');
    }
  }, [focusId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return changes.filter((change) => {
      if (status !== 'all' && change.changeStatus !== status) return false;
      if (validation !== 'all' && change.validationStatus !== validation) return false;
      if (deviceId !== 'all' && change.deviceId !== deviceId) return false;
      if (needle.length > 0) {
        const haystack =
          `${change.id} ${change.deviceName} ${change.setting} ${change.oldValue} ${change.newValue} ${change.category} ${change.actor} ${change.note ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [changes, query, status, validation, deviceId]);

  const stats = {
    applied: changes.filter((change) => change.changeStatus === 'applied').length,
    pending: changes.filter((change) => change.changeStatus === 'pending').length,
    reverted: changes.filter((change) => change.changeStatus === 'reverted').length,
    validated: changes.filter((change) => change.validationStatus === 'validated').length,
  };

  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setValidation('all');
    setDeviceId('all');
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  };

  const hasFilters = query.length > 0 || status !== 'all' || validation !== 'all' || deviceId !== 'all';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
          Configuration Changes
        </h1>
        <p className="mt-1 text-[12.5px] text-dimmer">
          The audit trail. Every applied change was validated against syntax, security policy, compliance and
          configuration conflicts first.
        </p>
      </header>

      <Card>
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBlock label="Total changes" value={changes.length} hint="recorded in the trail" />
          <StatBlock label="Applied" value={stats.applied} tone="ok" hint="simulated writes" />
          <StatBlock label="Pending" value={stats.pending} tone="medium" hint="awaiting validation" />
          <StatBlock label="Reverted" value={stats.reverted} tone="critical" hint="rolled back" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Filters"
          icon={<FileClock className="h-4 w-4" aria-hidden />}
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear all
              </button>
            ) : null
          }
        />
        <CardBody>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,180px))]">
            <SearchField value={query} onChange={setQuery} placeholder="Search change ID, device, setting, actor…" />
            <FilterSelect
              label="Filter by change status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all' as StatusFilter, label: 'Status: all' },
                { value: 'applied' as StatusFilter, label: 'Status: applied' },
                { value: 'pending' as StatusFilter, label: 'Status: pending' },
                { value: 'reverted' as StatusFilter, label: 'Status: reverted' },
              ]}
            />
            <FilterSelect
              label="Filter by validation status"
              value={validation}
              onChange={setValidation}
              options={[
                { value: 'all' as ValidationFilter, label: 'Validation: all' },
                { value: 'validated' as ValidationFilter, label: 'Validation: validated' },
                { value: 'blocked' as ValidationFilter, label: 'Validation: blocked' },
                { value: 'pending' as ValidationFilter, label: 'Validation: not run' },
              ]}
            />
            <FilterSelect
              label="Filter by device"
              value={deviceId}
              onChange={setDeviceId}
              options={[
                { value: 'all', label: 'Device: all' },
                ...devices.map((device) => ({ value: device.id, label: `Device: ${device.name}` })),
              ]}
            />
          </div>
        </CardBody>
      </Card>

      <ChangeTable
        changes={filtered}
        emptyLabel={
          hasFilters
            ? 'No configuration changes match these filters.'
            : 'No configuration changes recorded yet. Apply a validated change to start the audit trail.'
        }
        highlightId={focusId}
      />

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-dimmer">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Changes are simulated in the browser. No device credentials, SNMP traps or management sessions are used
        anywhere in this prototype.
      </p>
    </div>
  );
}
