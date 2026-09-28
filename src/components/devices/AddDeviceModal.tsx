import { useState, type ReactNode } from 'react';
import { AlertCircle, Plus, Search, X } from 'lucide-react';
import type { Device, DeviceType, Environment, Vendor } from '@/types';
import { DEVICE_TYPES, VENDORS } from '@/data/configSchema';
import { useCyberSure } from '@/lib/store';
import { useNotify } from '@/components/ui/Toast';
import { isIPv4 } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';

const ENVIRONMENTS: Environment[] = ['Production', 'DMZ', 'Branch', 'Lab', 'Management'];

export function AddDeviceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addDevice, devices } = useCyberSure();
  const notify = useNotify();

  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('router');
  const [vendor, setVendor] = useState<Vendor>('Cisco');
  const [ipAddress, setIpAddress] = useState('');
  const [environment, setEnvironment] = useState<Environment>('Production');
  const [touched, setTouched] = useState(false);

  const trimmedName = name.trim().toLowerCase();
  const duplicate = devices.some((device) => device.name.toLowerCase() === trimmedName);
  const nameError =
    trimmedName.length === 0 ? 'Enter a device name.' : duplicate ? 'A device with this name already exists.' : null;
  const ipError = !isIPv4(ipAddress) ? 'Enter a valid IPv4 address, for example 10.0.0.1.' : null;
  const valid = !nameError && !ipError;

  const reset = () => {
    setName('');
    setType('router');
    setVendor('Cisco');
    setIpAddress('');
    setEnvironment('Production');
    setTouched(false);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!valid) return;
    const device: Device | null = addDevice({ name, type, vendor, ipAddress, environment });
    if (!device) {
      notify.error('Device already exists', `A device named “${name}” is already in the inventory.`);
      return;
    }
    notify.success(
      'Device added',
      `${device.name} was added to the inventory and analysed against the ${type === 'wireless-controller' ? 'wireless controller' : type} baseline.`,
    );
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add device"
      description="Devices added here are local prototype objects. CYBERSURE never contacts a real network device."
      icon={<Plus className="h-4 w-4" aria-hidden />}
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} icon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
            Add Device
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5">
          <p className="text-[11.5px] leading-relaxed text-ink-200 [html.light_&]:text-ink-700">
            The new device starts from the CYBERSURE baseline with three seeded deviations so the analysis engine has
            something to report.
          </p>
        </div>

        <Field label="Device name" required htmlFor="add-device-name" error={touched ? nameError : undefined}>
          <TextInput
            id="add-device-name"
            value={name}
            invalid={touched && Boolean(nameError)}
            placeholder="e.g. Core-Router-02"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Device type" required htmlFor="add-device-type">
            <Select
              id="add-device-type"
              value={type}
              onChange={(event) => setType(event.target.value as DeviceType)}
              options={DEVICE_TYPES.map((entry) => ({ value: entry.id, label: entry.label }))}
            />
          </Field>
          <Field label="Vendor" required htmlFor="add-device-vendor">
            <Select
              id="add-device-vendor"
              value={vendor}
              onChange={(event) => setVendor(event.target.value as Vendor)}
              options={VENDORS.map((entry) => ({ value: entry, label: entry }))}
            />
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="IP address"
            required
            htmlFor="add-device-ip"
            error={touched ? ipError : undefined}
            hint="IPv4 address used to identify the device in the inventory."
          >
            <TextInput
              id="add-device-ip"
              value={ipAddress}
              mono
              invalid={touched && Boolean(ipError)}
              placeholder="10.0.0.1"
              onChange={(event) => setIpAddress(event.target.value)}
            />
          </Field>
          <Field label="Environment" required htmlFor="add-device-env">
            <Select
              id="add-device-env"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as Environment)}
              options={ENVIRONMENTS.map((entry) => ({ value: entry, label: entry }))}
            />
          </Field>
        </div>

        {touched && (nameError || ipError) ? (
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-red-400 [html.light_&]:text-red-600" role="alert">
            <AlertCircle className="h-3 w-3" aria-hidden />
            Fix the highlighted fields before adding the device.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dimmer" aria-hidden />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="field pr-8"
          style={{ paddingLeft: '2.1rem' }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-dimmer transition-colors hover:text-ink-100 [html.light_&]:hover:text-ink-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <Select
        aria-label={label}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        options={options}
      />
    </label>
  );
}

export function FilterGroup({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
