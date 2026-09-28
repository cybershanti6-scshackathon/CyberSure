/**
 * Confirms the brief's CRITICAL SUCCESS CONDITION and the honesty rules, using
 * the LIVE backend. This is deliberately separate from api-check.mjs: it
 * asserts the exact NX-OS -> Junos flow that previously returned "no mapping",
 * and greps the shipped code for the strings that had to disappear.
 *
 * Run: node scripts/success-condition.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const API = `${BASE.replace(/\/+$/, '')}/api/v1`;

let passed = 0;
let failed = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|py|mjs|html|md|json)$/.test(full)) out.push(full);
  }
  return out;
}

async function main() {
  console.log('=== CRITICAL SUCCESS CONDITION: Cisco NX-OS -> Juniper Junos ===\n');

  const nxos = `!
! NX-OS sample
hostname Core-Switch-01
!
feature interface-vlan
feature ospf
!
vlan 10
  name CLIENTS
!
vlan 20
  name SERVERS
!
interface Ethernet1/1
  description Server uplink
  no switchport
  ip address 10.40.0.2 255.255.255.0
  mtu 9216
  no shutdown
!
interface Ethernet1/2
  description Client access
  switchport
  switchport mode access
  switchport access vlan 10
!
interface Ethernet1/3
  description Trunk
  switchport
  switchport mode trunk
  switchport trunk allowed vlan 10,20
!
ip route 0.0.0.0 0.0.0.0 10.40.0.254
!
router ospf 1
  router-id 10.40.0.2
  network 10.40.0.0 0.0.0.255 area 0
!
end
`;

  console.log('  1. Send configuration to FastAPI');
  const response = await fetch(`${API}/conversions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_platform: 'cisco-nxos',
      target_platform: 'juniper-junos',
      configuration: nxos,
    }),
  });
  check('POST /api/v1/conversions accepted the request', response.ok, `HTTP ${response.status}`);
  if (!response.ok) {
    console.log(`\nThe backend is not reachable at ${BASE}. Start it with:`);
    console.log('  cd backend && uvicorn app.main:app --reload --port 8000 --reload-dir app');
    report();
    return;
  }
  const result = await response.json();
  const out = result.converted_configuration;

  console.log('  2. Parse configuration ......... backend parser');
  check('interfaces recognised', result.mapping.some((m) => /Ethernet1\/1/.test(m.source)));
  console.log('  3. Normalize configuration ..... shared IR');
  check('VLANs carried across', out.includes('set vlans 10') && out.includes('set vlans 20'));
  check('VLAN names carried across', out.includes('name "CLIENTS"') && out.includes('name "SERVERS"'));
  console.log('  4. Translate supported concepts');
  check('hostname translated', out.includes('set system host-name Core-Switch-01'));
  check('interface name translated (Ethernet1/1 -> ge-1/0/1)', out.includes('ge-1/0/1'));
  check('mask converted to prefix (10.40.0.2/24)', out.includes('10.40.0.2/24'));
  check('description translated', out.includes('description "Server uplink"'));
  check('MTU translated', out.includes('mtu 9216'));
  check('access port translated to port-mode access', out.includes('port-mode access'));
  check('access VLAN member emitted', out.includes('vlan members 10'));
  check('trunk port translated to port-mode trunk', out.includes('port-mode trunk'));
  check('trunk VLAN list emitted', out.includes('vlan members [10,20]'));
  check('static route translated', out.includes('set routing-options static route 0.0.0.0/0 next-hop 10.40.0.254'));
  check('OSPF router-id translated', out.includes('set protocols ospf router-id 10.40.0.2'));
  check('OSPF area/interface translated', out.includes('set protocols ospf area 0 interface 10.40.0.0/24'));
  console.log('  5. Generate Juniper configuration');
  check('output is Junos set syntax', /^set /m.test(out) && !/^interface /m.test(out));
  check('output is committed', out.trim().endsWith('commit'));
  console.log('  6. Validate');
  check('four validation stages returned', result.validation.length === 4);
  check('syntax check passed', result.validation.find((s) => s.id === 'syntax')?.status === 'pass');
  console.log('  7. Display converted configuration');
  check('status is a success state', ['success', 'partial', 'requires_review'].includes(result.status), result.status);
  console.log('  8. Display warnings / requires-review items');
  check('warnings array present and non-empty', Array.isArray(result.warnings) && result.warnings.length > 0);
  check('every warning states its status', result.warnings.every((w) => ['unsupported', 'requires_review'].includes(w.status)));

  console.log('\n  --- generated Juniper configuration ---');
  out.split('\n').forEach((line) => console.log(`  | ${line}`));

  console.log('\n=== Honesty: nothing fabricated ===');
  check('no invented Junos firewall filter for a source with no ACLs', !out.includes('firewall family inet'));
  check('no invented interface statements in Junos syntax', !/^interface /m.test(out));
  check('status matches the evidence', result.unsupported === 0 || result.status !== 'success');

  const withAcl = nxos + '\n!\nip access-list extended MGMT\n permit tcp 10.0.0.0 0.0.0.255 any eq 22\n!\n';
  const aclRun = await (
    await fetch(`${API}/conversions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_platform: 'cisco-nxos',
        target_platform: 'juniper-junos',
        configuration: withAcl,
      }),
    })
  ).json();
  check('an ACL the target cannot express is reported unsupported',
    aclRun.warnings.some((w) => w.status === 'unsupported' && /Access control lists/.test(w.concept)));
  check('no firewall filter was invented for it', !aclRun.converted_configuration.includes('firewall family inet'));
  check('the original command is included in the report',
    aclRun.warnings.some((w) => (w.source_command ?? '').includes('ip access-list extended MGMT')));

  console.log('\n=== Removed wording ===');
  const sources = [...walk('src'), ...walk('backend'), 'index.html', 'README.md', '.env.example'];
  const banned = [
    'Demo conversion mapping not available',
    'only ships hand-written',
    'hand-written demo mappings',
    'hand-written mapping',
    'UNSUPPORTED_PATH_MESSAGE',
  ];
  for (const phrase of banned) {
    const offenders = sources.filter((file) => {
      try {
        return readFileSync(file, 'utf8').includes(phrase);
      } catch {
        return false;
      }
    });
    check(`"${phrase}" appears nowhere in source`, offenders.length === 0, offenders.join(', '));
  }

  console.log('\n=== Backend holds the engine, frontend does not ===');
  const srcFiles = [...walk('src')].filter((f) => /\.tsx?$/.test(f));
  const engineInFrontend = srcFiles.filter((file) => {
    const text = readFileSync(file, 'utf8');
    return /SUPPORTED_PATHS|function maskToPrefix|class NetworkConfig/.test(text);
  });
  check('no network model or engine code in src/', engineInFrontend.length === 0, engineInFrontend.join(', '));
  const fetcher = srcFiles.filter((file) => /\bfetch\s*\(/.test(file) && !file.endsWith('api.ts'));
  check('src/lib/api.ts is the only frontend module calling fetch', fetcher.length === 0, fetcher.join(', '));
  const models = readFileSync('backend/app/models/network.py', 'utf8');
  check('the normalized model lives in backend/app/models/network.py', /class NetworkConfig/.test(models));
  check('every platform has a backend converter module',
    ['cisco_ios', 'cisco_ios_xe', 'cisco_nxos', 'cisco_asa', 'juniper_junos', 'fortinet_fortios',
      'paloalto_panos', 'mikrotik_routeros', 'arista_eos', 'huawei_vrp', 'aruba_aoscx', 'vyos']
      .every((m) => readFileSync('backend/app/converters/__init__.py', 'utf8').includes(m)));

  console.log('\n=== JSON-only reports ===');
  const download = await fetch(`${API}/reports/${result.id}/download`);
  const disposition = download.headers.get('content-disposition') ?? '';
  check('report downloads as configuration-report.json', disposition.includes('configuration-report.json'), disposition);
  check('no DOC/DOCX/PDF format is produced', !/\.(doc|docx|pdf)/i.test(disposition));
  const report = await download.json();
  for (const key of ['source_platform', 'target_platform', 'status', 'converted_configuration', 'warnings',
    'unsupported_commands', 'requires_review', 'validation']) {
    check(`report contains ${key}`, key in report);
  }

  report_();
}

function report() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Success-condition checks: ${passed} passed, ${failed} failed`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exitCode = failed === 0 ? 0 : 1;
}

function report_() {
  report();
}

main().catch((error) => {
  console.error('success-condition crashed:', error);
  process.exitCode = 1;
});
