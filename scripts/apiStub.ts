/* =============================================================================
 * Conversion API stub for the jsdom verification harnesses.
 * -----------------------------------------------------------------------------
 * The converter runs on the FastAPI backend, which is not available inside
 * jsdom. This module installs a `fetch` that speaks the same wire protocol the
 * real backend does, so the harnesses exercise the real `src/lib/api.ts`,
 * the real page and the real adapter without a server.
 *
 * It is NOT a converter: it recognises a handful of configuration shapes and
 * returns a representative response. Its job is to let the UI be driven, not to
 * stand in for the engine. The engine's own correctness is covered by
 * `backend/tests` and `scripts/api-check.mjs` against a live uvicorn.
 * ========================================================================== */

import type { ApiConversionResult, ApiDevice } from '@/lib/api';

export interface StubOptions {
  /** Force every call to fail, to exercise the offline UI. */
  offline?: boolean;
  /** Fail only `/conversions`, to exercise the error panel. */
  failConversion?: boolean;
  /** Make `/health` succeed but `/devices` fail, to exercise "degraded". */
  failDevices?: boolean;
}

const DEVICES: ApiDevice[] = [
  ['cisco-ios', 'Cisco IOS', 'Cisco', 'Classic IOS CLI', 'cfg'],
  ['cisco-iosxe', 'Cisco IOS XE', 'Cisco', 'IOS XE CLI', 'cfg'],
  ['cisco-nxos', 'Cisco NX-OS', 'Cisco', 'NX-OS CLI', 'cfg'],
  ['cisco-asa', 'Cisco ASA', 'Cisco', 'ASA CLI', 'cfg'],
  ['juniper-junos', 'Juniper Junos', 'Juniper', 'Junos set / hierarchy', 'conf'],
  ['fortinet-fortios', 'Fortinet FortiOS', 'Fortinet', 'FortiOS CLI', 'conf'],
  ['paloalto-panos', 'Palo Alto PAN-OS', 'Palo Alto Networks', 'PAN-OS CLI', 'cfg'],
  ['mikrotik-routeros', 'MikroTik RouterOS', 'MikroTik', 'RouterOS export', 'rsc'],
  ['arista-eos', 'Arista EOS', 'Arista', 'EOS CLI', 'cfg'],
  ['huawei-vrp', 'Huawei VRP', 'Huawei', 'VRP CLI', 'cfg'],
  ['aruba-aoscx', 'Aruba AOS-CX', 'Aruba', 'AOS-CX CLI', 'cfg'],
  ['vyos', 'VyOS', 'Vyatta', 'VyOS CLI', 'cfg'],
].map(([id, name, vendor, cli_label, file_extension]) => ({
  id,
  name,
  vendor,
  family: 'cisco_like',
  cli_label,
  file_extension,
  description: `${name} configuration.`,
  capabilities: ['hostname', 'interfaces', 'ipv4_addressing'],
}));

/* -------------------------------------------------------------------------- */
/* Tiny recogniser: enough syntax to shape a plausible response               */
/* -------------------------------------------------------------------------- */

function lines(text: string): string[] {
  return text.split('\n');
}

function significant(text: string): { line: number; source: string }[] {
  return lines(text)
    .map((source, index) => ({ line: index + 1, source: source.trim() }))
    .filter(
      (entry) =>
        entry.source.length > 0 &&
        !entry.source.startsWith('!') &&
        !entry.source.startsWith('#') &&
        !['end', 'exit', 'return', 'quit', 'commit', 'configure', 'next'].includes(
          entry.source.toLowerCase(),
        ),
    );
}

function hostnameOf(text: string): string {
  const setMatch = text.match(/set system host-name\s+(\S+)/i) ?? text.match(/host-name\s+'?([\w.-]+)'?/i);
  if (setMatch) return setMatch[1];
  const cisco = text.match(/^hostname\s+(\S+)/mi) ?? text.match(/^sysname\s+(\S+)/mi);
  if (cisco) return cisco[1];
  const ros = text.match(/name=([\w.-]+)/);
  if (ros) return ros[1];
  return 'device-01';
}

function junosName(name: string): string {
  if (name.includes('-')) return name;
  const match = name.match(/^(.*?)(\d+(?:[/:]\d+)*)$/);
  if (!match) return `ge-0/0/${name.replace(/\D/g, '') || '0'}`;
  const alias = /TenGig/i.test(match[1]) ? 'xe' : /Fast/i.test(match[1]) ? 'fe' : 'ge';
  const numbers = match[2].split(/[/:]/);
  // Mirrors the backend: `Ethernet1/1` -> ge-1/0/1, `Gi1/0/1` -> ge-1/0/1.
  const slot = numbers.length > 2 ? numbers[numbers.length - 2] : numbers[0];
  return `${alias}-${slot}/0/${numbers[numbers.length - 1]}`;
}

function ciscoName(name: string): string {
  if (!name.includes('-')) return name;
  const alias = name.startsWith('xe-') ? 'TenGigabitEthernet' : name.startsWith('fe-') ? 'FastEthernet' : 'GigabitEthernet';
  return alias + name.slice(name.indexOf('-') + 1);
}

/** Produces output shaped like the real target renderer for the stub's inputs. */
function renderTarget(source: string, target: string): { text: string; converted: number; review: number } {
  const out: string[] = [];
  const entries = significant(source);
  let converted = 0;
  let review = 0;
  const push = (line: string) => out.push(line);

  const comment = target === 'juniper-junos' ? '#' : '!';
  push(`${comment} CYBERSURE conversion`);
  push('');

  const name = hostnameOf(source);

  for (const entry of entries) {
    const text = entry.source;

    if (/^(hostname|sysname)\s+/i.test(text) || /^set system host-name/i.test(text)) {
      if (target === 'juniper-junos') push(`set system host-name ${name}`);
      else if (target === 'huawei-vrp') push(`sysname ${name}`);
      else if (target === 'mikrotik-routeros') push(`/system identity\nset name=${name}`);
      else if (target === 'vyos') push(`set host-name '${name}'`);
      else if (target.startsWith('fortinet')) push(`config system global\n    set hostname "${name}"\nend`);
      else if (target.startsWith('paloalto')) push(`set deviceconfig hostname ${name}`);
      else push(`hostname ${name}`);
      converted += 1;
      continue;
    }
    if (/^ip domain-name\s+/i.test(text)) {
      const domain = text.split(/\s+/)[2];
      if (target === 'juniper-junos') push(`set system domain-name ${domain}`);
      else push(`ip domain-name ${domain}`);
      converted += 1;
      continue;
    }
    if (/^interface\s+(\S+)/i.test(text)) {
      const port = text.match(/^interface\s+(\S+)/i)![1];
      if (target === 'juniper-junos') push(`set interfaces ${junosName(port)} description "stub"`);
      else if (target === 'huawei-vrp') push(`interface ${port}\n description stub\nquit`);
      else if (target === 'mikrotik-routeros') push(`/interface ethernet\nadd name=${port}`);
      else if (target === 'vyos') push(`set interfaces ethernet eth0 description 'stub'`);
      else if (target.startsWith('fortinet')) push(`config system interface\n    edit "port1"\n    next\nend`);
      else if (target.startsWith('paloalto')) push(`set interface ethernet1/1 comment "stub"`);
      else push(`interface ${ciscoName(port)}\n description stub\n exit`);
      converted += 1;
      continue;
    }
    if (/^set interfaces\s+(\S+)\s+description/i.test(text)) {
      if (target === 'juniper-junos') {
        const value = text.replace(/^set interfaces\s+\S+\s+description\s+/i, '');
        push(`set interfaces ${text.split(/\s+/)[2]} description "${value}"`);
      } else {
        push(`interface ${ciscoName(text.split(/\s+/)[2])}\n description stub\n exit`);
      }
      converted += 1;
      continue;
    }
    if (/^\s*ip address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/i.test(text)) {
      const [, address, mask] = text.match(/ip address (\d+\.\d+\.\d+\.\d+) (\d+\.\d+\.\d+\.\d+)/i)!;
      const prefix = maskToPrefix(mask);
      if (target === 'juniper-junos') push(`set interfaces ge-0/0/1 unit 0 family inet address ${address}/${prefix}`);
      else if (target.startsWith('fortinet')) push(`        set ip ${address} ${mask}`);
      else if (target.startsWith('paloalto')) push(`set interface ethernet1/1 ip-address ${address}/${prefix}`);
      else if (target === 'huawei-vrp') push(` ip address ${address} ${mask}`);
      else if (target === 'mikrotik-routeros') push(`add address=${address}/${prefix} interface=ether1`);
      else if (target === 'vyos') push(`set interfaces ethernet eth0 address '${address}/${prefix}'`);
      else push(` ip address ${address} ${mask}`);
      converted += 1;
      continue;
    }
    if (/^(ip route|ip route-static|set routing-options static route|set ip route)/i.test(text)) {
      if (target === 'juniper-junos') push('set routing-options static route 0.0.0.0/0 next-hop 10.0.0.1');
      else if (target === 'huawei-vrp') push('ip route-static 0.0.0.0 0.0.0.0 10.0.0.1');
      else if (target === 'mikrotik-routeros') push('/ip route\nadd dst-address=0.0.0.0/0 gateway=10.0.0.1');
      else if (target === 'vyos') push("set ip route 0.0.0.0/0 via '10.0.0.1'");
      else if (target.startsWith('fortinet')) push('config router static\n    edit 0\n        set gateway 10.0.0.1\n    next\nend');
      else push('ip route 0.0.0.0 0.0.0.0 10.0.0.1');
      converted += 1;
      continue;
    }
    if (/^ntp server/i.test(text) || /^set system ntp server/i.test(text)) {
      push(target === 'juniper-junos' ? 'set system ntp server 10.0.0.123' : 'ntp server 10.0.0.123');
      converted += 1;
      continue;
    }
    if (/^logging host/i.test(text) || /^set system syslog host/i.test(text)) {
      push(target === 'juniper-junos' ? 'set system syslog host 10.0.0.99' : 'logging host 10.0.0.99');
      review += 1;
      continue;
    }
    if (/^ip name-server/i.test(text) || /^set system name-server/i.test(text) || /^set system name-server/i.test(text)) {
      const server = text.split(/\s+/).pop()!;
      push(target === 'juniper-junos' ? `set system name-server ${server}` : `ip name-server ${server}`);
      converted += 1;
      continue;
    }
    if (/^(crypto|aaa|snmp-server|ip access-list|access-list|neighbor|router|line vty|ip ssh|ip ntp|service)/i.test(text)) {
      // Deliberately not translated: reported as a review/unsupported item.
      review += 1;
      continue;
    }
    converted += 1;
  }

  if (target === 'juniper-junos') push('commit');
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), converted, review };
}

function maskToPrefix(mask: string): number {
  const octets = mask.split('.').map(Number);
  let bits = 0;
  for (const octet of octets) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      if (octet & (1 << bit)) bits += 1;
    }
  }
  return bits;
}

/* -------------------------------------------------------------------------- */
/* Response builders                                                          */
/* -------------------------------------------------------------------------- */

let counter = 0;

function buildConversion(source: string, target: string, configuration: string): ApiConversionResult {
  counter += 1;
  const { text, converted, review } = renderTarget(configuration, target);
  const entries = significant(configuration);
  const warnings: ApiConversionResult['warnings'] = [
    {
      id: 'standing-caveat',
      status: 'requires_review',
      concept: 'Vendor-specific behaviour',
      detail:
        'Some vendor-specific commands may require manual review. The engine translates configuration intent, not vendor behaviour.',
    },
  ];
  let unsupported = 0;
  entries.forEach((entry, index) => {
    if (!converted) return;
    if (/^(crypto|aaa|snmp-server|ip access-list|access-list|neighbor|router|line vty|ip ssh|service)/i.test(entry.source)) {
      unsupported += 1;
      warnings.push({
        id: `unparsed-${index}`,
        status: 'unsupported',
        concept: 'Unparsed statement',
        detail: `Line ${entry.line}: unrecognised in the stub engine.`,
        source_command: entry.source,
        original_line: entry.source,
      });
    }
  });

  const status: ApiConversionResult['status'] =
    unsupported > 0 ? 'partial' : review > 0 ? 'requires_review' : 'success';

  return {
    id: `CONV-STUB${String(counter).padStart(4, '0')}`,
    source_platform: source,
    target_platform: target,
    status,
    converted_configuration: `${text}\n`,
    commands_processed: entries.length,
    commands_converted: converted,
    requires_review: review,
    unsupported,
    warnings,
    validation: [
      { id: 'syntax', label: 'Syntax Check', status: 'pass', detail: `All emitted lines use valid ${target} syntax.` },
      {
        id: 'mapping',
        label: 'Command Mapping',
        status: review + unsupported > 0 ? 'warn' : 'pass',
        detail: `${converted} constructs converted, ${review} need review, ${unsupported} could not be converted.`,
      },
      { id: 'parameters', label: 'Required Parameters', status: 'pass', detail: 'Baseline elements required by the target platform are present.' },
      {
        id: 'conflicts',
        label: 'Potential Conflicts',
        status: review > 0 ? 'warn' : 'pass',
        detail: review > 0 ? `${review} statement(s) flagged for manual review.` : 'No conflicting or duplicate statements detected.',
      },
    ],
    mapping: entries.map((entry) => ({
      line: entry.line,
      source: entry.source,
      target: [],
      status: 'converted' as const,
      rule_id: 'normalized',
      rule_label: 'Normalized model translation',
    })),
    ignored_lines: lines(configuration).length - entries.length,
    created_at: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* fetch installation                                                         */
/* -------------------------------------------------------------------------- */

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export interface InstalledStub {
  options: StubOptions;
  /** Number of conversion calls served, for assertions. */
  calls: () => number;
  /** Lets a test flip the stub's behaviour mid-run. */
  configure: (next: Partial<StubOptions>) => void;
  restore: () => void;
}

/**
 * Installs the stub onto `globalThis.fetch` and returns a handle for
 * inspecting and reconfiguring it.
 */
export function installApiStub(initial: StubOptions = {}): InstalledStub {
  const options: StubOptions = { ...initial };
  const original = globalThis.fetch;
  let calls = 0;

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    const method = (init?.method ?? 'GET').toUpperCase();

    if (options.offline) {
      throw new TypeError('Failed to fetch');
    }

    // `mode: 'no-cors'` is exempt from CORS; api.ts uses it to tell a blocked
    // origin from a dead server. It always resolves if the "server" answers.
    if (init?.mode === 'no-cors') {
      if (path.includes('/health')) return json({ status: 'ok' });
      return json({ detail: 'ok' });
    }

    // ---- GET /api/v1/health -------------------------------------------------
    if (path.endsWith('/api/v1/health')) {
      return json({
        status: 'ok',
        service: 'CYBERSURE Conversion API',
        version: '1.0.0',
        platforms_supported: DEVICES.length,
        platform_ids: DEVICES.map((device) => device.id),
        engine: 'normalized-ir',
        report_formats: ['json'],
      });
    }

    // ---- GET /api/v1/devices -----------------------------------------------
    if (path.endsWith('/api/v1/devices') && method === 'GET') {
      if (options.failDevices) throw new TypeError('Failed to fetch');
      return json({ count: DEVICES.length, platforms: DEVICES });
    }

    // ---- POST /api/v1/conversions ------------------------------------------
    if (path.endsWith('/api/v1/conversions') && method === 'POST') {
      calls += 1;
      if (options.failConversion) {
        return json({ detail: 'The conversion engine encountered an internal error.' }, 500);
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        source_platform: string;
        target_platform: string;
        configuration: string;
      };
      if (!body.configuration?.trim()) {
        return json({ detail: 'Configuration is empty. Paste a configuration or upload a file.' }, 400);
      }
      return json(buildConversion(body.source_platform, body.target_platform, body.configuration));
    }

    // ---- POST /api/v1/conversions/upload -----------------------------------
    if (path.endsWith('/api/v1/conversions/upload') && method === 'POST') {
      calls += 1;
      const form = init?.body as FormData;
      const file = form?.get('file') as File;
      const source = String(form?.get('source_platform') ?? 'cisco-ios');
      const target = String(form?.get('target_platform') ?? 'juniper-junos');
      if (!/\.(cfg|conf|txt|rsc|ios|junos|config|rcf)$/i.test(file?.name ?? '')) {
        return json({ detail: `Unsupported file type for '${file?.name}'.` }, 415);
      }
      const text = await file.text();
      return json(buildConversion(source, target, text));
    }

    // ---- POST /api/v1/validate ---------------------------------------------
    if (path.endsWith('/api/v1/validate') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { platform: string; configuration: string };
      const entries = significant(body.configuration);
      const recognised = entries.some((entry) => !/^(crypto|aaa|snmp-server)\b/i.test(entry.source));
      if (!recognised) {
        return json({
          platform: body.platform,
          valid: false,
          status: 'invalid',
          stages: [{ id: 'parse', label: 'Parse', status: 'fail', detail: 'No recognised statements were found.' }],
          unparsed_count: entries.length,
        });
      }
      return json({
        platform: body.platform,
        valid: true,
        status: 'valid',
        stages: [
          { id: 'parse', label: 'Parse', status: 'pass', detail: `${entries.length} statements recognised.` },
          { id: 'syntax', label: 'Syntax Check', status: 'pass', detail: `All emitted lines use valid ${body.platform} syntax.` },
          { id: 'mapping', label: 'Command Mapping', status: 'pass', detail: 'No mapping problems detected.' },
          { id: 'parameters', label: 'Required Parameters', status: 'pass', detail: 'Baseline elements present.' },
          { id: 'conflicts', label: 'Potential Conflicts', status: 'pass', detail: 'No conflicts detected.' },
        ],
        unparsed_count: 0,
      });
    }

    // ---- GET /api/v1/reports/{id} ------------------------------------------
    if (/\/api\/v1\/reports\/[^/]+$/.test(path)) {
      return json({
        report_id: path.split('/').pop(),
        report_type: 'configuration-conversion',
        generated_at: new Date().toISOString(),
        source_platform: 'cisco-nxos',
        target_platform: 'juniper-junos',
        status: 'success',
        summary: { commands_processed: 1, commands_converted: 1, requires_review: 0, unsupported: 0, warning_count: 1 },
        converted_configuration: '# stub\ncommit\n',
        warnings: [],
        unsupported_commands: [],
        requires_review: [],
        validation: { status: 'valid', stages: [] },
      });
    }

    return json({ detail: `Stub has no route for ${method} ${path}` }, 404);
  };

  globalThis.fetch = handler as typeof fetch;

  return {
    options,
    calls: () => calls,
    configure: (next) => Object.assign(options, next),
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
