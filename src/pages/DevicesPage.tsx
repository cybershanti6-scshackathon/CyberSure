import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, LayoutGrid, Network, Plus, Rows3, ShieldCheck, X } from 'lucide-react';
import type { DeviceStatus, DeviceType, SecurityStatus, Vendor } from '@/types';
import { DEVICE_TYPES, VENDORS } from '@/data/configSchema';
import { useCyberSure } from '@/lib/store';
import { deviceComplianceStatus } from '@/lib/analysis';
import { cx, DEVICE_TYPE_LABEL, relativeTime } from '@/utils/format';
import { Badge, DeviceStatusBadge, SecurityStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, Tooltip } from '@/components/ui/Primitives';
import { DeviceTypeChip, VendorAvatar } from '@/components/common/Bits';
import { AddDeviceModal, FilterGroup, FilterSelect, SearchField } from '@/components/devices/AddDeviceModal';
import { TopologyMap } from '@/components/common/TopologyMap';

type TypeFilter = DeviceType | 'all';
type VendorFilter = Vendor | 'all';
type StatusFilter = DeviceStatus | 'all';
type SecurityFilter = SecurityStatus | 'all';
type ViewMode = 'table' | 'grid' | 'topology';

const SEVERITY_OPTIONS: { value: SecurityFilter; label: string }[] = [
  { value: 'all', label: 'Security: all' },
  { value: 'critical', label: 'Security: critical' },
  { value: 'high', label: 'Security: high' },
  { value: 'medium', label: 'Security: medium' },
  { value: 'low', label: 'Security: low' },
  { value: 'compliant', label: 'Security: compliant' },
];

export function DevicesPage() {
  const { devices, analysis } = useCyberSure();
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('table');

  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [vendor, setVendor] = useState<VendorFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [security, setSecurity] = useState<SecurityFilter>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return devices.filter((device) => {
      if (type !== 'all' && device.type !== type) return false;
      if (vendor !== 'all' && device.vendor !== vendor) return false;
      if (status !== 'all' && device.status !== status) return false;
      if (security !== 'all' && (analysis.securityStatusByDevice[device.id] ?? 'compliant') !== security) return false;
      if (needle.length > 0) {
        const haystack = `${device.name} ${device.vendor} ${device.model} ${device.ipAddress} ${device.site} ${device.serial}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [devices, query, type, vendor, status, security, analysis.securityStatusByDevice]);

  const activeFilters = [
    type !== 'all' ? `Type: ${DEVICE_TYPE_LABEL[type]}` : null,
    vendor !== 'all' ? `Vendor: ${vendor}` : null,
    status !== 'all' ? `Status: ${status}` : null,
    security !== 'all' ? `Security: ${security}` : null,
  ].filter(Boolean) as string[];

  const resetFilters = () => {
    setQuery('');
    setType('all');
    setVendor('all');
    setStatus('all');
    setSecurity('all');
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">
            Network Devices
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-dimmer">
            <span>Manage and analyze devices in your environment.</span>
            <span aria-hidden>·</span>
            <span>
              {filtered.length} of {devices.length} devices
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="hidden items-center gap-1 rounded-lg border border-ink-600 bg-ink-850 p-1 sm:flex [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50"
            role="radiogroup"
            aria-label="View mode"
          >
            {([
              { id: 'table', label: 'Table', icon: Rows3 },
              { id: 'grid', label: 'Cards', icon: LayoutGrid },
              { id: 'topology', label: 'Topology', icon: Network },
            ] as const).map((option) => {
              const Icon = option.icon;
              return (
                <Tooltip key={option.id} content={option.label} side="bottom">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={view === option.id}
                    onClick={() => setView(option.id)}
                    className={cx(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                      view === option.id
                        ? 'bg-accent-500/15 text-accent-300 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700'
                        : 'text-dimmer hover:text-ink-100 [html.light_&]:hover:text-ink-800',
                    )}
                    aria-label={option.label}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <Button variant="primary" onClick={() => setAddOpen(true)} icon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
            Add Device
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-dimmer" aria-hidden />
            <p className="eyebrow">Filters</p>
            {activeFilters.length > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-400 hover:underline [html.light_&]:text-accent-600"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear all
              </button>
            ) : null}
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,180px))]">
            <SearchField value={query} onChange={setQuery} placeholder="Search name, vendor, IP, model…" />
            <FilterGroup>
              <FilterSelect
                label="Filter by device type"
                value={type}
                onChange={setType}
                options={[
                  { value: 'all' as TypeFilter, label: 'Type: all' },
                  ...DEVICE_TYPES.map((entry) => ({ value: entry.id as TypeFilter, label: `Type: ${entry.label}` })),
                ]}
              />
              <FilterSelect
                label="Filter by vendor"
                value={vendor}
                onChange={setVendor}
                options={[
                  { value: 'all' as VendorFilter, label: 'Vendor: all' },
                  ...VENDORS.map((entry) => ({ value: entry as VendorFilter, label: `Vendor: ${entry}` })),
                ]}
              />
              <FilterSelect
                label="Filter by status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all' as StatusFilter, label: 'Status: all' },
                  { value: 'online' as StatusFilter, label: 'Status: online' },
                  { value: 'offline' as StatusFilter, label: 'Status: offline' },
                  { value: 'maintenance' as StatusFilter, label: 'Status: maintenance' },
                ]}
              />
              <FilterSelect
                label="Filter by security status"
                value={security}
                onChange={setSecurity}
                options={SEVERITY_OPTIONS}
              />
            </FilterGroup>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilters.map((label) => (
                <Badge key={label} tone="info">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Network className="h-5 w-5" />}
            tone="neutral"
            title={devices.length === 0 ? 'No devices added' : 'No devices match these filters'}
            description={
              devices.length === 0
                ? 'Add a device to begin configuration analysis.'
                : 'Adjust or clear the filters to see the rest of the inventory.'
            }
            action={
              devices.length === 0 ? (
                <Button variant="primary" onClick={() => setAddOpen(true)} icon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
                  Add Device
                </Button>
              ) : (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : view === 'topology' ? (
        <Card>
          <CardHeader title="Network topology" description="Click a node to open the device configuration." />
          <CardBody className="grid-noise p-2">
            <TopologyMap
              statusByDevice={analysis.securityStatusByDevice}
              offlineIds={devices.filter((device) => device.status !== 'online').map((device) => device.id)}
            />
          </CardBody>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((device) => {
            const securityStatus = analysis.securityStatusByDevice[device.id] ?? 'compliant';
            const openCount = (analysis.findingsByDevice[device.id] ?? []).filter((f) => f.status === 'open').length;
            return (
              <Link
                key={device.id}
                to={`/devices/${device.id}`}
                className="surface flex flex-col gap-3 p-3.5 transition-colors hover:border-accent-500/40"
              >
                <div className="flex items-start gap-2.5">
                  <VendorAvatar vendor={device.vendor} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">
                      {device.name}
                    </p>
                    <p className="truncate text-[11.5px] text-dimmer">
                      {device.vendor} · {device.ipAddress}
                    </p>
                  </div>
                  <DeviceStatusBadge status={device.status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <DeviceTypeChip type={device.type} />
                  <SecurityStatusBadge status={securityStatus} />
                </div>
                <dl className="grid grid-cols-2 gap-2 border-t border-ink-700/60 pt-2.5 text-[11.5px] [html.light_&]:border-ink-100">
                  <div>
                    <dt className="text-dimmer">Posture</dt>
                    <dd className="font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">
                      {analysis.postureByDevice[device.id] ?? 0}/100
                    </dd>
                  </div>
                  <div>
                    <dt className="text-dimmer">Open findings</dt>
                    <dd className="font-semibold tabular-nums text-ink-100 [html.light_&]:text-ink-800">{openCount}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-dimmer">Last scan</dt>
                    <dd className="text-ink-100 [html.light_&]:text-ink-800">{relativeTime(device.lastScan)}</dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <caption className="sr-only">
                Network device inventory with security and compliance status
              </caption>
              <thead>
                <tr className="border-b border-ink-700/70 text-[11px] uppercase tracking-[0.08em] text-dimmer">
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Device</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Type</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Vendor</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">IP address</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Security</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Compliance</th>
                  <th scope="col" className="px-3.5 py-2.5 font-semibold">Last scan</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => {
                  const securityStatus = analysis.securityStatusByDevice[device.id] ?? 'compliant';
                  const compliance = deviceComplianceStatus(device, analysis.findingsByDevice[device.id] ?? []);
                  return (
                    <tr
                      key={device.id}
                      className="border-b border-ink-700/40 transition-colors last:border-0 hover:bg-ink-850 [html.light_&]:hover:bg-ink-50"
                    >
                      <td className="px-3.5 py-2.5">
                        <Link
                          to={`/devices/${device.id}`}
                          className="flex items-center gap-2.5 hover:text-accent-300 [html.light_&]:hover:text-accent-700"
                        >
                          <VendorAvatar vendor={device.vendor} size={28} />
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium text-ink-50 [html.light_&]:text-ink-900">
                              {device.name}
                            </span>
                            <span className="block truncate text-[10.5px] text-dimmer">{device.model}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 text-[12px] text-ink-200 [html.light_&]:text-ink-700">
                        {DEVICE_TYPE_LABEL[device.type]}
                      </td>
                      <td className="px-3.5 py-2.5 text-[12px] text-ink-200 [html.light_&]:text-ink-700">{device.vendor}</td>
                      <td className="px-3.5 py-2.5 font-mono text-[12px] text-ink-200 [html.light_&]:text-ink-700">
                        {device.ipAddress}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <DeviceStatusBadge status={device.status} />
                      </td>
                      <td className="px-3.5 py-2.5">
                        <SecurityStatusBadge status={securityStatus} />
                      </td>
                      <td className="px-3.5 py-2.5">
                        {compliance === 'compliant' ? (
                          <Badge tone="ok" icon={<ShieldCheck className="h-3 w-3" aria-hidden />}>
                            Compliant
                          </Badge>
                        ) : compliance === 'partial' ? (
                          <Badge tone="medium">Partial</Badge>
                        ) : compliance === 'not-assessed' ? (
                          <Badge tone="neutral">Not assessed</Badge>
                        ) : (
                          <Badge tone="critical">Non-compliant</Badge>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11.5px] text-dimmer">{relativeTime(device.lastScan)}</td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Link
                          to={`/devices/${device.id}?tab=configuration`}
                          className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[11.5px] font-medium text-ink-200 transition-colors hover:border-accent-500/50 hover:text-accent-300 [html.light_&]:border-ink-200 [html.light_&]:text-ink-700 [html.light_&]:hover:border-accent-300 [html.light_&]:hover:text-accent-700"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
