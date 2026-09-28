import type { CheckStatus, ConfigItemDef } from '@/types';

export const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
export const CIDR = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/([0-9]|[12][0-9]|3[0-2])$/;
export const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9](-*[a-zA-Z0-9])*)(\.[a-zA-Z0-9](-*[a-zA-Z0-9])*)*$/;

export function isIPv4(value: string): boolean {
  return IPV4.test(value.trim());
}

export function isCidr(value: string): boolean {
  return CIDR.test(value.trim());
}

export function isPort(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const port = Number(value.trim());
  return port >= 1 && port <= 65535;
}

export function isInteger(value: string): boolean {
  return /^-?\d+$/.test(value.trim());
}

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Normalise a raw control value into the shape stored on the device. */
export function normaliseValue(item: ConfigItemDef, raw: string): string {
  const trimmed = raw.trim();
  if (item.type === 'list') {
    return splitList(trimmed).join(', ');
  }
  if (item.type === 'number' || item.type === 'port') {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? String(parsed) : trimmed;
  }
  return trimmed;
}

export interface SyntaxResult {
  ok: boolean;
  message: string;
}

/** Stage 1 — type/syntax level validation of a proposed value. */
export function validateSyntax(item: ConfigItemDef, raw: string): SyntaxResult {
  const value = raw.trim();

  if (value.length === 0 && item.type !== 'list') {
    return { ok: false, message: 'A value is required for this setting.' };
  }

  switch (item.type) {
    case 'toggle': {
      const allowed = (item.options ?? []).map((option) => option.value);
      if (allowed.length > 0 && !allowed.includes(value)) {
        return { ok: false, message: `Value must be one of: ${allowed.join(', ')}.` };
      }
      return { ok: true, message: `Boolean setting accepted (${value}).` };
    }
    case 'select':
    case 'action': {
      const allowed = (item.options ?? []).map((option) => option.value);
      if (!allowed.includes(value)) {
        return {
          ok: false,
          message: `"${value}" is not a valid option for ${item.setting}. Expected one of: ${allowed.join(', ')}.`,
        };
      }
      return { ok: true, message: `Selected an enumerated value defined for ${item.setting}.` };
    }
    case 'port': {
      if (!isPort(value)) return { ok: false, message: 'Enter a valid TCP/UDP port between 1 and 65535.' };
      return { ok: true, message: `Port ${value} is within the valid range 1-65535.` };
    }
    case 'number': {
      if (!isInteger(value)) return { ok: false, message: 'Enter a whole number (digits only).' };
      const parsed = Number(value);
      if (item.range && (parsed < item.range.min || parsed > item.range.max)) {
        return {
          ok: false,
          message: `Enter a value between ${item.range.min} and ${item.range.max} ${item.range.unit}.`,
        };
      }
      if (parsed < 0) return { ok: false, message: 'Value cannot be negative.' };
      return { ok: true, message: `Numeric value ${value} accepted.` };
    }
    case 'ip': {
      if (!isIPv4(value)) return { ok: false, message: 'Enter a valid IPv4 address, for example 10.0.0.1.' };
      return { ok: true, message: `IPv4 address ${value} is well formed.` };
    }
    case 'cidr': {
      if (isIPv4(value) || isCidr(value)) {
        return { ok: true, message: `Address ${value} is well formed.` };
      }
      return { ok: false, message: 'Enter a valid IPv4 address or CIDR range, for example 10.10.0.0/16.' };
    }
    case 'list': {
      const entries = splitList(value);
      if (entries.length === 0) {
        return { ok: false, message: 'Enter at least one entry (comma separated).' };
      }
      for (const entry of entries) {
        if (!isIPv4(entry) && !isCidr(entry) && !HOSTNAME.test(entry)) {
          return {
            ok: false,
            message: `"${entry}" is not a valid entry. Use IPv4 addresses, CIDR ranges or hostnames.`,
          };
        }
      }
      return { ok: true, message: `${entries.length} valid entr${entries.length === 1 ? 'y' : 'ies'} parsed.` };
    }
    case 'text':
    default: {
      if (value.length > 120) return { ok: false, message: 'Value must be 120 characters or fewer.' };
      return { ok: true, message: 'Text value accepted.' };
    }
  }
}

/** Map a control status to the worst of a set of statuses. */
export function worstStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('pass')) return 'pass';
  return 'na';
}