import type { ConverterPlatformId, Platform, PlatformId } from '@/types';

/* =============================================================================
 * Supported network platforms
 * -----------------------------------------------------------------------------
 * Presentation metadata for every platform CYBERSURE knows about. The
 * authoritative *conversion* catalogue comes from the backend
 * (`GET /api/v1/devices`); this file supplies the labels, accent colours and
 * file extensions the UI needs, and acts as the offline fallback so the page
 * still renders when the API is unreachable.
 * ========================================================================== */

export const PLATFORMS: Platform[] = [
  {
    id: 'cisco-iosxe',
    name: 'Cisco IOS XE',
    vendor: 'Cisco',
    cliLabel: 'IOS XE CLI',
    fileExtension: 'cfg',
    accent: 'sky',
    description: 'IOS-XE running configuration (indent-based blocks, "!" separated).',
  },
  {
    id: 'cisco-ios',
    name: 'Cisco IOS',
    vendor: 'Cisco',
    cliLabel: 'Classic IOS CLI',
    fileExtension: 'cfg',
    accent: 'sky',
    description: 'Classic IOS 15.x running configuration for routers and switches.',
  },
  {
    id: 'cisco-nxos',
    name: 'Cisco NX-OS',
    vendor: 'Cisco',
    cliLabel: 'NX-OS CLI',
    fileExtension: 'cfg',
    accent: 'sky',
    description: 'NX-OS data-centre switching configuration with feature and VLAN handling.',
  },
  {
    id: 'juniper-junos',
    name: 'Juniper Junos',
    vendor: 'Juniper',
    cliLabel: 'Junos set / hierarchy',
    fileExtension: 'conf',
    accent: 'emerald',
    description: 'Junos hierarchical configuration in set or brace-block form.',
  },
  {
    id: 'fortinet-fortios',
    name: 'Fortinet FortiOS',
    vendor: 'Fortinet',
    cliLabel: 'FortiOS CLI',
    fileExtension: 'conf',
    accent: 'red',
    description: 'FortiGate configuration in config / edit / next block form.',
  },
  {
    id: 'paloalto-panos',
    name: 'Palo Alto PAN-OS',
    vendor: 'Palo Alto Networks',
    cliLabel: 'PAN-OS CLI',
    fileExtension: 'cfg',
    accent: 'orange',
    description: 'PAN-OS device configuration and security policy in XML-friendly form.',
  },
  {
    id: 'mikrotik-routeros',
    name: 'MikroTik RouterOS',
    vendor: 'MikroTik',
    cliLabel: 'RouterOS export',
    fileExtension: 'rsc',
    accent: 'violet',
    description: 'RouterOS export format with path-style commands.',
  },
  {
    id: 'cisco-asa',
    name: 'Cisco ASA',
    vendor: 'Cisco',
    cliLabel: 'ASA CLI',
    fileExtension: 'cfg',
    accent: 'red',
    description: 'Cisco Adaptive Security Appliance with security contexts and inspection policies.',
  },
  {
    id: 'arista-eos',
    name: 'Arista EOS',
    vendor: 'Arista',
    cliLabel: 'EOS CLI',
    fileExtension: 'cfg',
    accent: 'sky',
    description: 'Arista EOS leaf/spine switching configuration.',
  },
  {
    id: 'huawei-vrp',
    name: 'Huawei VRP',
    vendor: 'Huawei',
    cliLabel: 'VRP CLI',
    fileExtension: 'cfg',
    accent: 'orange',
    description: 'Huawei Versatile Routing Platform configuration.',
  },
  {
    id: 'aruba-aoscx',
    name: 'Aruba AOS-CX',
    vendor: 'Aruba',
    cliLabel: 'AOS-CX CLI',
    fileExtension: 'cfg',
    accent: 'cyan',
    description: 'Aruba AOS-CX campus switching configuration.',
  },
  {
    id: 'vyos',
    name: 'VyOS',
    vendor: 'Vyatta',
    cliLabel: 'VyOS CLI',
    fileExtension: 'cfg',
    accent: 'emerald',
    description: 'VyOS virtual router configuration in set form.',
  },
  {
    id: 'aruba-arubaos',
    name: 'ArubaOS',
    vendor: 'Aruba',
    cliLabel: 'ArubaOS CLI',
    fileExtension: 'cfg',
    accent: 'cyan',
    description: 'ArubaOS campus switching and wireless controller configuration.',
  },
];

export const PLATFORM_BY_ID: Record<PlatformId, Platform> = PLATFORMS.reduce(
  (accumulator, platform) => {
    accumulator[platform.id] = platform;
    return accumulator;
  },
  {} as Record<PlatformId, Platform>,
);

/**
 * Platforms the conversion backend can handle.
 *
 * The converter's dropdowns are populated from `GET /api/v1/devices` at runtime;
 * this list is the local mirror used for rendering (accent colours, file
 * extensions) and as the offline fallback when the API cannot be reached.
 * `aruba-arubaos` is deliberately excluded: it is not a conversion target.
 */
export const CONVERTER_PLATFORMS: Platform[] = PLATFORMS.filter(
  (platform) => platform.id !== 'aruba-arubaos',
);

export const PLATFORM_OPTIONS = PLATFORMS.map((platform) => ({ value: platform.id, label: platform.name }));

/** Selector options for the converter's From/To dropdowns. */
export const CONVERTER_PLATFORM_OPTIONS = CONVERTER_PLATFORMS.map((platform) => ({
  value: platform.id,
  label: platform.name,
}));

export function isConverterPlatform(id: string): id is ConverterPlatformId {
  return CONVERTER_PLATFORMS.some((platform) => platform.id === id);
}

export function platformName(id: PlatformId): string {
  return PLATFORM_BY_ID[id]?.name ?? id;
}

export function platformFileName(id: PlatformId, suffix: string): string {
  const platform = PLATFORM_BY_ID[id];
  return `cybersure-demo-${platform?.name.replace(/\s+/g, '-').toLowerCase() ?? id}-${suffix}.${platform?.fileExtension ?? 'cfg'}`;
}

/** Tailwind class fragments for the platform chip (kept literal for the compiler). */
export const PLATFORM_ACCENT: Record<Platform['accent'], { bg: string; border: string; text: string }> = {
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-300 [html.light_&]:text-sky-700' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300 [html.light_&]:text-emerald-700' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300 [html.light_&]:text-red-700' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300 [html.light_&]:text-orange-700' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300 [html.light_&]:text-violet-700' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300 [html.light_&]:text-cyan-700' },
};
