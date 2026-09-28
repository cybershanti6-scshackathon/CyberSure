/**
 * End-to-end check against a RUNNING backend.
 *
 * Unlike the jsdom harnesses, this talks to a real uvicorn process over HTTP, so
 * it proves the wire contract the browser actually uses: CORS, multipart
 * upload, error shapes and the JSON report download.
 *
 * Run: node scripts/api-check.mjs            (skips cleanly if the API is down)
 *      node scripts/api-check.mjs --required (fails if the API is down)
 */

const BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const API = `${BASE.replace(/\/+$/, '')}/api/v1`;
const REQUIRED = process.argv.includes('--required');

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function step(title) {
  console.log(`\n=== ${title} ===`);
}

const NXOS = `! NX-OS sample
hostname Core-Switch-01
!
feature interface-vlan
!
vlan 10
  name CLIENTS
!
interface Ethernet1/1
  description Server uplink
  no switchport
  ip address 10.40.0.2 255.255.255.0
  no shutdown
!
interface Ethernet1/2
  description Client access
  switchport
  switchport mode access
  switchport access vlan 10
!
ip route 0.0.0.0 0.0.0.0 10.40.0.254
!
end
`;

const IOSXE = `! IOS XE sample
hostname Edge-XE-01
!
interface GigabitEthernet1/0/10
 description Server
 ip address 10.20.0.2 255.255.255.0
 no shutdown
!
end
`;

async function post(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function main() {
  step('Health');
  let health;
  try {
    const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
    health = await response.json();
  } catch (error) {
    console.log(`\nThe backend is not reachable at ${BASE}.`);
    console.log('Start it with:  cd backend && uvicorn app.main:app --reload --port 8000 --reload-dir app');
    if (REQUIRED) {
      process.exit(1);
    }
    console.log('Skipping the live API checks.');
    return;
  }

  check('GET /health returns ok', health.status === 'ok');
  check('Engine is the normalized IR', health.engine === 'normalized-ir');
  check('12 platforms registered', health.platforms_supported === 12, String(health.platforms_supported));
  check('JSON is the only report format', JSON.stringify(health.report_formats) === '["json"]');

  // Monitors probe /health; it must not 404, or the log fills with entries
  // that look like a broken API.
  const alias = await fetch(`${BASE}/health`);
  check('unversioned /health alias returns 200', alias.status === 200, String(alias.status));
  const aliasBody = await alias.json();
  check('alias reports ok', aliasBody.status === 'ok', JSON.stringify(aliasBody));

  step('Devices');
  const devices = await (await fetch(`${API}/devices`)).json();
  check('GET /devices lists 12 platforms', devices.count === 12, String(devices.count));
  const required = [
    'cisco-ios', 'cisco-iosxe', 'cisco-nxos', 'cisco-asa', 'juniper-junos',
    'fortinet-fortios', 'paloalto-panos', 'mikrotik-routeros', 'arista-eos',
    'huawei-vrp', 'aruba-aoscx', 'vyos',
  ];
  const ids = new Set(devices.platforms.map((p) => p.id));
  check('Every required platform is present', required.every((id) => ids.has(id)));

  step('CORS preflight from the Vite origin');
  const preflight = await fetch(`${API}/conversions`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  check('Preflight is allowed', preflight.status < 400, String(preflight.status));
  check(
    'Vite dev origin is echoed back',
    (preflight.headers.get('access-control-allow-origin') ?? '').includes('localhost:5173'),
    preflight.headers.get('access-control-allow-origin') ?? '(none)',
  );
  const evil = await fetch(`${API}/conversions`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
  });
  check('Unknown origin is not allowed', !evil.headers.get('access-control-allow-origin'));

  // A dev server moves off 5173 when the port is busy. If the backend only
  // trusted a fixed port list, the browser would block every request and the
  // UI would report the service as down while it is perfectly healthy.
  for (const port of [5174, 5175, 5187, 3000]) {
    const shifted = await fetch(`${API}/conversions`, {
      method: 'OPTIONS',
      headers: {
        Origin: `http://localhost:${port}`,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    check(
      `Preflight from a shifted dev port (${port}) is allowed`,
      shifted.headers.get('access-control-allow-origin') === `http://localhost:${port}`,
      shifted.headers.get('access-control-allow-origin') ?? '(none)',
    );
  }
  for (const origin of ['http://localhost.evil.example', 'http://notlocalhost:5173', 'null']) {
    const spoof = await fetch(`${API}/conversions`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    });
    check(`Lookalike origin refused (${origin})`, !spoof.headers.get('access-control-allow-origin'));
  }
  check('CORS never answers with a wildcard', (preflight.headers.get('access-control-allow-origin') ?? '') !== '*');

  // Exactly what the browser does when the operator clicks Convert.
  step('Browser-shaped conversion request (preflight, then POST)');
  const origin = 'http://localhost:5173';
  const pre = await fetch(`${API}/conversions`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  check('Preflight granted', pre.status === 200);
  const browserPost = await fetch(`${API}/conversions`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_platform: 'cisco-nxos',
      target_platform: 'juniper-junos',
      configuration: NXOS,
    }),
  });
  const postBody = await browserPost.json();
  check('POST answered 200', browserPost.status === 200, String(browserPost.status));
  check(
    'POST response carries the CORS header the browser requires',
    browserPost.headers.get('access-control-allow-origin') === origin,
    browserPost.headers.get('access-control-allow-origin') ?? '(none)',
  );
  check('Browser-visible response is the real conversion', (postBody.converted_configuration ?? '').includes('set system host-name Core-Switch-01'));

  step('The critical flow: Cisco NX-OS -> Juniper Junos');
  const nxosToJunos = await post('/conversions', {
    source_platform: 'cisco-nxos',
    target_platform: 'juniper-junos',
    configuration: NXOS,
  });
  check('POST /conversions returns 200', nxosToJunos.status === 200, String(nxosToJunos.status));
  const result = nxosToJunos.body;
  if (result) {
    check('Status is a success state', ['success', 'partial', 'requires_review'].includes(result.status), result.status);
    check('Output is real Junos syntax', result.converted_configuration.includes('set system host-name Core-Switch-01'));
    check('Interface translated to ge-1/0/1', result.converted_configuration.includes('set interfaces ge-1/0/1'));
    check('Address uses prefix notation', result.converted_configuration.includes('10.40.0.2/24'));
    check('Access port translated', result.converted_configuration.includes('port-mode access'));
    check('Static route translated', result.converted_configuration.includes('routing-options static route 0.0.0.0/0'));
    check('Configuration is committed', result.converted_configuration.trim().endsWith('commit'));
    check('No fabricated firewall terms', !result.converted_configuration.includes('firewall family inet'));
    check('Four validation stages returned', result.validation.length === 4);
    check('Line mapping returned', result.mapping.length > 5);
  }

  step('Other required pairs');
  const pairs = [
    ['cisco-iosxe', 'juniper-junos', IOSXE, 'set system host-name Edge-XE-01'],
    ['cisco-iosxe', 'fortinet-fortios', IOSXE, 'config system interface'],
    ['cisco-iosxe', 'paloalto-panos', IOSXE, 'set deviceconfig hostname Edge-XE-01'],
    ['juniper-junos', 'cisco-iosxe', 'set system host-name R1\ncommit\n', 'hostname R1'],
    ['mikrotik-routeros', 'cisco-iosxe', '/system identity\nset name=r1\n/ip address\nadd address=10.0.0.1/24 interface=ether1\n', 'hostname r1'],
  ];
  for (const [source, target, config, expected] of pairs) {
    const response = await post('/conversions', {
      source_platform: source,
      target_platform: target,
      configuration: config,
    });
    const produced = response.body?.converted_configuration ?? '';
    check(`${source} -> ${target}`, response.status === 200 && produced.includes(expected), produced.slice(0, 60));
  }

  step('Error handling');
  const badPlatform = await post('/conversions', {
    source_platform: 'not-a-platform',
    target_platform: 'juniper-junos',
    configuration: 'hostname x',
  });
  check('Unknown platform returns 422', badPlatform.status === 422, String(badPlatform.status));
  check('Error explains how to list platforms', /GET \/api\/v1\/devices/.test(badPlatform.body?.detail ?? ''));

  const empty = await post('/conversions', {
    source_platform: 'cisco-ios',
    target_platform: 'juniper-junos',
    configuration: '   \n',
  });
  check('Empty configuration returns 400', empty.status === 400, String(empty.status));

  const gibberish = await post('/conversions', {
    source_platform: 'cisco-ios',
    target_platform: 'juniper-junos',
    configuration: 'lorem ipsum dolor sit amet',
  });
  check('Unrecognised text returns 422', gibberish.status === 422, String(gibberish.status));
  check('No stack trace leaks', !/Traceback|site-packages/.test(JSON.stringify(gibberish.body)));

  const hostile = await post('/conversions', {
    source_platform: 'cisco-ios',
    target_platform: 'juniper-junos',
    configuration: "hostname x\n__import__('os').system('id')\n",
  });
  check('Hostile text is data, not code', hostile.status === 200 && JSON.stringify(hostile.body).includes('__import__'));

  step('Detection');
  const detect = await (await fetch(`${API}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configuration: NXOS }),
  })).json();
  check('NX-OS detected', detect.platform === 'cisco-nxos', String(detect.platform));
  check('Confidence reported', detect.confidence > 0.3, String(detect.confidence));
  check('Reasons given', Array.isArray(detect.reasons) && detect.reasons.length > 0);

  step('Validation');
  const validate = await (await fetch(`${API}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'cisco-nxos', configuration: NXOS }),
  })).json();
  check('Valid configuration passes', validate.valid === true, validate.status);
  check('Parse stage reports what it found', /interfaces/.test(validate.stages[0].detail), validate.stages[0].detail);

  step('Upload');
  const form = new FormData();
  form.append('file', new Blob([NXOS], { type: 'text/plain' }), 'core.cfg');
  form.append('source_platform', 'cisco-nxos');
  form.append('target_platform', 'juniper-junos');
  const upload = await fetch(`${API}/conversions/upload`, { method: 'POST', body: form });
  const uploadBody = await upload.json();
  check('Upload returns 200', upload.status === 200, String(upload.status));
  check('Uploaded file converted', (uploadBody.converted_configuration ?? '').includes('set system host-name Core-Switch-01'));

  const badForm = new FormData();
  badForm.append('file', new Blob([NXOS], { type: 'text/plain' }), 'payload.exe');
  badForm.append('source_platform', 'cisco-nxos');
  badForm.append('target_platform', 'juniper-junos');
  const badUpload = await fetch(`${API}/conversions/upload`, { method: 'POST', body: badForm });
  check('Bad extension returns 415', badUpload.status === 415, String(badUpload.status));

  step('JSON report download');
  const reportId = result?.id;
  const report = await (await fetch(`${API}/reports/${reportId}`)).json();
  for (const key of ['source_platform', 'target_platform', 'status', 'converted_configuration', 'warnings', 'unsupported_commands', 'requires_review', 'validation']) {
    check(`Report has ${key}`, key in report);
  }
  const download = await fetch(`${API}/reports/${reportId}/download`);
  const disposition = download.headers.get('content-disposition') ?? '';
  check('Download filename is configuration-report.json', disposition.includes('configuration-report.json'), disposition);
  check('Content type is JSON', (download.headers.get('content-type') ?? '').includes('application/json'));
  check('No DOC/DOCX/PDF produced', !/\.(doc|docx|pdf)/i.test(disposition));
  const roundTrip = await download.json();
  check('Downloaded report parses as JSON', typeof roundTrip === 'object' && roundTrip.report_id === reportId);

  console.log(`\n${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`Live API checks: ${passed} passed, ${failed} failed`);
  } else {
    console.log(`Live API checks: ${passed} passed, ${failed} FAILED`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
}

/* -------------------------------------------------------------------------- */
/* Exit cleanly: Node on Windows can assert if `process.exit` races undici's   */
/* keep-alive sockets, so the dispatcher is closed first.                      */
/* -------------------------------------------------------------------------- */

async function finish(code) {
  process.exitCode = code;
  try {
    const dispatcher = globalThis[Symbol.for('undici.globalDispatcher.1')];
    await dispatcher?.close();
  } catch {
    /* nothing to close */
  }
}

main()
  .then(() => finish(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error('api-check crashed:', error);
    return finish(1);
  });
