/* =============================================================================
 * Browser-accurate frontend -> backend test.
 *
 * Runs the REAL `src/lib/api.ts` (the module the Convert button uses) against a
 * LIVE uvicorn, through a `fetch` shim that behaves like a browser:
 *
 *   - a preflight OPTIONS for any request that is not CORS-simple
 *   - a hard block (TypeError) if the response omits access-control-allow-origin
 *     for the requesting origin, exactly as Chrome/Firefox/Safari do
 *
 * Without this, a Node client happily talks to a backend whose CORS policy the
 * browser would reject - which is how a healthy backend ends up reported as
 * "the service is not responding".
 *
 * Run:  node scripts/browser-flow.cjs        (skips cleanly if the API is down)
 *       node scripts/browser-flow.cjs --required
 * ========================================================================== */

const BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const API = `${BASE.replace(/\/+$/, '')}/api/v1`;
const REQUIRED = process.argv.includes('--required');
/** Origin the "browser" is on. `globalThis.__testOrigin` overrides it mid-run. */
const BASE_ORIGIN = process.env.CYBERSURE_TEST_ORIGIN ?? 'http://localhost:5173';
const origin = () => globalThis.__testOrigin ?? BASE_ORIGIN;

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

const SIMPLE_METHODS = new Set(['GET', 'HEAD', 'POST']);
const SIMPLE_HEADERS = new Set(['accept', 'accept-language', 'content-language', 'content-type']);
const SIMPLE_CONTENT_TYPES = new Set([
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
]);

/** Enforces CORS the way a browser does, then performs the request. */
async function browserFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = init.headers ?? {};

  // `mode: 'no-cors'` is exempt from CORS: it resolves for any server
  // response, and only rejects when nothing is listening. That is exactly what
  // api.ts uses to tell "blocked" from "unreachable".
  if (init.mode === 'no-cors') {
    return realFetch(url, { method, cache: init.cache });
  }

  // A request is CORS-simple when the method is safe AND every header is on
  // the safelist AND the content type (if any) is one of the three forms.
  const headerKeys = Object.keys(headers).map((key) => key.toLowerCase());
  const contentTypeRaw = headers['Content-Type'] ?? headers['content-type'] ?? '';
  const contentType = String(contentTypeRaw).split(';')[0].trim().toLowerCase();
  const isSimple =
    SIMPLE_METHODS.has(method) &&
    headerKeys.every((key) => SIMPLE_HEADERS.has(key)) &&
    (contentType === '' || SIMPLE_CONTENT_TYPES.has(contentType));

  if (!isSimple) {
    // The browser sends a preflight first and aborts if it is not approved.
    const requestHeaders = headerKeys.join(', ');
    const preflightHeaders = {
      Origin: origin(),
      'Access-Control-Request-Method': method,
    };
    // An empty Access-Control-Request-Headers is itself a malformed preflight,
    // so only send it when there is something to declare.
    if (requestHeaders) preflightHeaders['Access-Control-Request-Headers'] = requestHeaders;
    const preflight = await realFetch(url, { method: 'OPTIONS', headers: preflightHeaders });
    const allowed = preflight.headers.get('access-control-allow-origin');
    if (preflight.status >= 400 || (allowed !== origin() && allowed !== '*')) {
      console.log(`    (browser blocked: preflight ${preflight.status}, allow-origin=${allowed})`);
      throw new TypeError('Failed to fetch');
    }
  }

  const response = await realFetch(url, { ...init, headers: { ...headers, Origin: origin() } });
  const allow = response.headers.get('access-control-allow-origin');
  if (allow !== origin() && allow !== '*') {
    console.log(`    (browser blocked: no access-control-allow-origin for ${origin()})`);
    throw new TypeError('Failed to fetch');
  }
  return response;
}

const realFetch = globalThis.fetch;

async function loadApi() {
  // The bundle is produced by the npm script; this guards a missing build.
  try {
    const module = await import('./browser-flow.bundle.cjs');
    return module.default ?? module;
  } catch (error) {
    console.log(`  could not load the API bundle: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`Page origin: ${origin()}`);
  console.log(`API base:    ${BASE}\n`);

  // 1. The backend must be up before anything else means anything.
  try {
    await realFetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.log(`The backend is not reachable at ${BASE}. Start it with:`);
    console.log('  cd backend && uvicorn app.main:app --reload --port 8000 --reload-dir app');
    if (REQUIRED) process.exitCode = 1;
    console.log('Skipping the browser-flow checks.');
    return;
  }

  const api = await loadApi();
  if (!api) {
    console.log('scripts/browser-flow.bundle.cjs is missing. Run: npm run verify:browserflow');
    process.exitCode = 1;
    return;
  }

  console.log('=== 1. Health probe (the banner that gates the page) ===');
  globalThis.fetch = browserFetch;
  const health = await api.getHealth();
  check('getHealth() resolved', health.status === 'ok', JSON.stringify(health));
  check('engine reported', health.engine === 'normalized-ir', health.engine);
  check('12 platforms registered', health.platforms_supported === 12, String(health.platforms_supported));

  console.log('\n=== 2. Device catalogue (builds the From/To dropdowns) ===');
  const devices = await api.getDevices();
  check('getDevices() resolved', devices.count === 12, String(devices.count));
  const ids = new Set(devices.platforms.map((p) => p.id));
  for (const id of ['cisco-ios', 'cisco-iosxe', 'cisco-nxos', 'cisco-asa', 'juniper-junos',
    'fortinet-fortios', 'paloalto-panos', 'mikrotik-routeros', 'arista-eos', 'huawei-vrp',
    'aruba-aoscx', 'vyos']) {
    check(`dropdown offers ${id}`, ids.has(id));
  }

  const NXOS = `hostname Core-Switch-01
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

  console.log('\n=== 3. The Convert button path: convertConfiguration() ===');
  // This is literally what the Convert button calls.
  const result = await api.convertConfiguration({
    sourcePlatform: 'cisco-nxos',
    targetPlatform: 'juniper-junos',
    configuration: NXOS,
  });
  check('resolved with a result', Boolean(result?.converted_configuration));
  check('status is a success state', ['success', 'partial', 'requires_review'].includes(result.status), result.status);
  check('real Junos came back', result.converted_configuration.includes('set system host-name Core-Switch-01'));
  check('interface renamed to ge-1/0/1', result.converted_configuration.includes('ge-1/0/1'));
  check('address converted to /24', result.converted_configuration.includes('10.40.0.2/24'));
  check('access port translated', result.converted_configuration.includes('port-mode access'));
  check('warnings returned for the UI', result.warnings.length > 0);
  check('validation stages returned', result.validation.length === 4);
  check('line mapping returned', result.mapping.length > 5);

  console.log('\n=== 4. The required device pairs, through the browser path ===');
  const pairs = [
    ['cisco-ios', 'juniper-junos', 'hostname R1\n!\ninterface Gi0/1\n ip address 10.0.0.1 255.255.255.0\n', 'set system host-name R1'],
    ['cisco-iosxe', 'juniper-junos', 'hostname X1\n!\ninterface Gi1/0/1\n ip address 10.1.0.1 255.255.255.0\n', 'set system host-name X1'],
    ['cisco-nxos', 'juniper-junos', NXOS, 'set system host-name Core-Switch-01'],
    ['cisco-iosxe', 'fortinet-fortios', 'hostname F1\n!\ninterface Gi1/0/1\n ip address 10.2.0.1 255.255.255.0\n', 'config system global'],
    ['cisco-iosxe', 'paloalto-panos', 'hostname P1\n!\ninterface Gi1/0/1\n ip address 10.3.0.1 255.255.255.0\n', 'set deviceconfig hostname P1'],
    ['juniper-junos', 'cisco-iosxe', 'set system host-name J1\ncommit\n', 'hostname J1'],
    ['mikrotik-routeros', 'cisco-iosxe', '/system identity\nset name=M1\n/ip address\nadd address=10.9.0.1/24 interface=ether1\n', 'hostname M1'],
  ];
  for (const [from, to, config, expected] of pairs) {
    try {
      const r = await api.convertConfiguration({ sourcePlatform: from, targetPlatform: to, configuration: config });
      check(`${from} -> ${to}`, r.converted_configuration.includes(expected), r.converted_configuration.slice(0, 70));
    } catch (error) {
      check(`${from} -> ${to}`, false, error.message);
    }
  }

  console.log('\n=== 5. Validation + report download from the UI ===');
  const validated = await api.validateConfiguration('juniper-junos', result.converted_configuration);
  check('validateConfiguration() resolved', validated.valid === true, validated.status);
  const report = await api.getReport(result.id);
  check('getReport() resolved', report.report_id === result.id);
  check('report carries the converted configuration', report.converted_configuration.length > 0);

  console.log('\n=== 6. Errors are classified, not collapsed ===');
  const cases = [
    ['unknown platform', { sourcePlatform: 'nope', targetPlatform: 'juniper-junos', configuration: 'hostname x' }, 'rejected', 422],
    ['empty configuration', { sourcePlatform: 'cisco-ios', targetPlatform: 'juniper-junos', configuration: '  ' }, 'rejected', 400],
    ['unrecognisable text', { sourcePlatform: 'cisco-ios', targetPlatform: 'juniper-junos', configuration: 'lorem ipsum dolor' }, 'rejected', 422],
  ];
  for (const [label, payload, kind, status] of cases) {
    try {
      await api.convertConfiguration(payload);
      check(`${label} is reported as an error`, false, 'no error thrown');
    } catch (error) {
      check(`${label} -> ${kind}/${status}`, error.kind === kind && error.status === status,
        `${error.kind}/${error.status}: ${error.message}`);
      check(`${label} carries actionable advice`, Boolean(error.hint), '(no hint)');
    }
  }

  console.log('\n=== 7. The UI can never hang on Converting… ===');
  const aborted = await api
    .convertConfiguration(
      { sourcePlatform: 'cisco-ios', targetPlatform: 'juniper-junos', configuration: 'hostname x' },
      AbortSignal.timeout(1),
    )
    .then(() => null, (error) => error);
  check('an in-flight request is abandoned, not awaited forever', aborted !== null, 'request resolved anyway');
  check(
    'an abandoned request is reported as aborted, not as a service failure',
    aborted?.kind === 'aborted',
    String(aborted?.kind),
  );
  check(
    'an aborted request does not offer a retry (the caller cancelled it)',
    aborted?.retryable === false,
    String(aborted?.retryable),
  );

  // A timeout is the case that must offer a retry, so assert the whole table.
  const retryTable = [
    ['unavailable', true],
    ['timeout', true],
    ['server-error', true],
    ['rejected', false],
    ['parse', false],
    ['aborted', false],
  ];
  for (const [kind, expected] of retryTable) {
    const error = new api.ApiError(kind, 'x');
    check(`${kind} is ${expected ? 'retryable' : 'not retryable'}`, error.retryable === expected, String(error.retryable));
  }
  check('a 5xx is retryable', new api.ApiError('server-error', 'x', 500).retryable === true);
  check('a 422 is not retryable', new api.ApiError('rejected', 'x', 422).retryable === false);

  console.log('\n=== 8. A genuine CORS block is named, not misreported as an outage ===');
  {
    // A non-loopback origin the backend refuses: the exact failure mode that
    // used to be reported as "the service is not responding".
    const realOrigin = origin();
    globalThis.__testOrigin = 'http://app.internal:5173';
    let diagnosis = null;
    try {
      await api.getHealth();
    } catch (error) {
      diagnosis = error.diagnosis ?? null;
    }
    globalThis.__testOrigin = realOrigin;
    check('a refused origin is detected', diagnosis !== null);
    check('the backend is recognised as reachable', diagnosis?.reachable === true, JSON.stringify(diagnosis));
    check('the cause is identified as blocked, not an outage', diagnosis?.reason === 'blocked', String(diagnosis?.reason));
    check('the advice names CORS', /CORS/.test(diagnosis?.advice ?? ''), diagnosis?.advice);
    check(
      'the advice does not tell the operator to start a server that is already running',
      !/is not running/.test(diagnosis?.advice ?? ''),
      diagnosis?.advice,
    );
  }

  globalThis.fetch = realFetch;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Browser-flow checks: ${passed} passed, ${failed} failed`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('browser-flow crashed:', error);
  process.exitCode = 1;
});
