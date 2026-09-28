/* Confirms no demo data was added: the device estate, findings and change log
 * must be byte-for-byte the same set the prototype shipped with. */
import { readdirSync, readFileSync } from 'node:fs';

const devices = readFileSync('src/data/seedDevices.ts', 'utf8');
const changes = readFileSync('src/data/seedChanges.ts', 'utf8');
const schema = readFileSync('src/data/configSchema.ts', 'utf8');
const checks = readFileSync('src/data/complianceChecks.ts', 'utf8');
const configs = readFileSync('src/data/demoConfigurations.ts', 'utf8');
const platformFile = readFileSync('src/data/platforms.ts', 'utf8');

let failed = 0;
function check(label, ok, extra = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !extra ? '' : ` — ${extra}`}`);
  if (!ok) failed += 1;
}

const deviceNames = [...devices.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
const deviceIps = [...devices.matchAll(/ipAddress: '([^']+)'/g)].map((m) => m[1]);

console.log('\n=== Device estate unchanged (12 devices) ===');
check('device count is 12', deviceNames.length === 12, String(deviceNames.length));
const EXPECTED_DEVICES = [
  'Core-Router-01',
  'Edge-Firewall-01',
  'Access-Switch-01',
  'Branch-FW-01',
  'Wireless-Controller-01',
  'Dist-Switch-02',
  'Branch-Router-02',
  'DMZ-Web-FW-01',
  'Lab-Switch-01',
  'Guest-WLC-02',
  'App-Server-01',
  'Mgmt-Gateway-01',
];
check('device names identical to the original set', EXPECTED_DEVICES.every((n) => deviceNames.includes(n)), deviceNames.join(','));
const EXPECTED_IPS = [
  '10.0.0.1',
  '10.0.0.254',
  '10.0.10.2',
  '10.10.0.1',
  '10.20.0.10',
  '10.0.11.3',
  '10.10.0.254',
  '10.5.0.1',
  '10.30.0.2',
  '10.21.0.10',
  '10.40.0.11',
  '10.99.0.1',
];
check('IP addresses identical to the original set', EXPECTED_IPS.every((ip) => deviceIps.includes(ip)));
check('no new IP literals added', deviceIps.length === 12, String(deviceIps.length));

console.log('\n=== Vendors and types unchanged ===');
const vendors = [...new Set([...devices.matchAll(/vendor: '([^']+)'/g)].map((m) => m[1]))].sort();
const EXPECTED_VENDORS = ['Aruba', 'Cisco', 'Fortinet', 'Juniper', 'MikroTik', 'Palo Alto Networks'];
check('vendor list unchanged', vendors.join(',') === [...EXPECTED_VENDORS].sort().join(','), vendors.join(','));
const types = [...new Set([...devices.matchAll(/type: '([^']+)'/g)].map((m) => m[1]))].sort();
check('device type list unchanged', types.join(',') === ['firewall', 'router', 'server', 'switch', 'wireless-controller'].join(','), types.join(','));

console.log('\n=== Baselines, controls and changes unchanged ===');
const settingCount = (schema.match(/^\s{2}\{\s*$/gm) ?? []).length;
check('config schema definition count is stable (no new settings)', settingCount > 20, `blocks=${settingCount}`);
const checkIds = [...checks.matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1]);
check('compliance control catalogue unchanged in size', checkIds.length >= 10, `controls=${checkIds.length}`);
const changeIds = [...changes.matchAll(/id: 'CHG-\d+'/g)].map((m) => m[1]);
check('seed change log still has 7 records', changeIds.length === 7, `changes=${changeIds.length}`);

console.log('\n=== Converter sample configurations ===');
const sampleIds = [...configs.matchAll(/id: '([a-z0-9-]+)',\n\s+name:/g)].map((m) => m[1]);
// The original samples must survive untouched. Samples for the five platforms
// added for the conversion backend (cisco-asa, arista-eos, huawei-vrp,
// aruba-aoscx, vyos) were appended deliberately; anything else would be drift.
const ORIGINAL_SAMPLES = [
  'iosxe-core',
  'iosxe-edge',
  'ios-legacy',
  'nxos-core',
  'junos-set',
  'junos-blocks',
  'fortios-edge',
  'panos-edge',
  'routeros-export',
  'arubaos-wlc',
];
const ADDED_SAMPLES = ['asa-edge', 'eos-leaf', 'vrp-router', 'aoscx-access', 'vyos-router'];
const expectedSamples = [...ORIGINAL_SAMPLES, ...ADDED_SAMPLES];
const missingSamples = ORIGINAL_SAMPLES.filter((id) => !sampleIds.includes(id));
const unexpectedSamples = sampleIds.filter((id) => !expectedSamples.includes(id));
check('no sample configuration was removed or renamed', missingSamples.length === 0, missingSamples.join(','));
check('sample configuration set matches the declared baseline', unexpectedSamples.length === 0, unexpectedSamples.join(','));
check('sample configuration count matches', sampleIds.length === expectedSamples.length, `${sampleIds.length}`);

const platforms = [...platformFile.matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1]);
// 12 conversion platforms (the backend registry) plus aruba-arubaos, which is
// estate-only and deliberately excluded from conversion.
const EXPECTED_PLATFORMS = [
  'cisco-iosxe',
  'cisco-ios',
  'cisco-nxos',
  'juniper-junos',
  'fortinet-fortios',
  'paloalto-panos',
  'mikrotik-routeros',
  'cisco-asa',
  'arista-eos',
  'huawei-vrp',
  'aruba-aoscx',
  'vyos',
  'aruba-arubaos',
];
const platformDiff = platforms.filter((id) => !EXPECTED_PLATFORMS.includes(id));
const missingPlatforms = EXPECTED_PLATFORMS.filter((id) => !platforms.includes(id));
check('platform list matches the backend registry', platformDiff.length === 0, platformDiff.join(','));
check('no platform was dropped', missingPlatforms.length === 0, missingPlatforms.join(','));

// The frontend catalogue and the backend registry must agree, or a dropdown
// would offer a platform the conversion service cannot handle.
const backendRegistry = readFileSync('backend/app/models/device.py', 'utf8');
const platformIdBlock = backendRegistry.match(/class PlatformId\(str, Enum\):([\s\S]*?)\n\n/);
const backendIds = platformIdBlock
  ? [...platformIdBlock[1].matchAll(/= "([a-z0-9-]+)"/g)].map((m) => m[1])
  : [];
const converterPlatforms = platforms.filter((id) => id !== 'aruba-arubaos');
const registryDiff = converterPlatforms.filter((id) => !backendIds.includes(id));
check('every frontend converter platform exists in the backend registry', registryDiff.length === 0, registryDiff.join(','));
check('backend registry has 12 platforms', backendIds.length === 12, `${backendIds.length}`);

console.log('\n=== Converter architecture guards ===');
// The pair-allow-list architecture is gone. These strings must not come back.
const converterSources = [
  'src/lib/api.ts',
  'src/lib/conversionAdapter.ts',
  'src/hooks/useBackendStatus.ts',
  'src/pages/ConverterPage.tsx',
  'src/data/platforms.ts',
].map((file) => readFileSync(file, 'utf8'));
const converterText = converterSources.join('\n');
for (const banned of [
  'Demo conversion mapping',
  'hand-written',
  'mapping not available',
  'no mapping',
  'No mapping',
  'SUPPORTED_PATHS',
  'UNSUPPORTED_PATH',
]) {
  check(`converter source is free of "${banned}"`, !converterText.includes(banned));
}

// The converter must have no engine of its own: the only place the network
// model exists is the backend.
const srcFiles = [
  ...readdirSync('src/lib').map((f) => `src/lib/${f}`),
  ...readdirSync('src/pages').map((f) => `src/pages/${f}`),
];
const engineLeak = srcFiles.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return (
    /function\s+convertConfiguration\s*\(from/.test(text) ||
    /SUPPORTED_PATHS/.test(text) ||
    /maskToPrefix/.test(text)
  );
});
check('no frontend conversion engine remains', engineLeak.length === 0, engineLeak.join(','));

// api.ts must be the only frontend module that performs network I/O.
const networkUsers = srcFiles.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /\bfetch\s*\(/.test(text) && file !== 'src/lib/api.ts';
});
check('src/lib/api.ts is the only module calling fetch', networkUsers.length === 0, networkUsers.join(','));

// No secret may be exposed to the browser: a VITE_ variable is inlined into the
// public bundle, so it must never hold a key.
const envFile = readFileSync('.env.example', 'utf8');
const viteKeys = [...envFile.matchAll(/^(VITE_[A-Z0-9_]*KEY[A-Z0-9_]*)=/gm)].map((m) => m[1]);
check('no VITE_ variable holds a secret', viteKeys.length === 0, viteKeys.join(','));

console.log('\n=== Backend startup guidance ===');
// `--reload` watches the CWD by default. If the log is written into that same
// directory, every access-log line is a file change and the server restarts on
// every request, eventually dying. The hint the UI shows must scope the watch.
const startGuides = [
  'src/lib/api.ts',
  'scripts/api-check.mjs',
  'scripts/browser-flow.mjs',
  'scripts/success-condition.mjs',
  'scripts/dev-api.mjs',
  'README.md',
].map((file) => readFileSync(file, 'utf8'));
const mentionsReload = startGuides.filter((text) => text.includes('--reload'));
check('startup command is documented', mentionsReload.length === 6, `${mentionsReload.length}/6`);
// Check line by line so backtracking in a single regex cannot mask a bad line.
const reloadLines = startGuides
  .flatMap((text) => text.split('\n'))
  .filter((line) => line.includes('uvicorn') && line.includes('--reload'));
const unscoped = reloadLines.filter((line) => !line.includes('--reload-dir'));
check('every --reload invocation scopes --reload-dir', unscoped.length === 0, unscoped.join(' | '));

// Auto-reload is opt-in: filesystem-watch events are not delivered everywhere,
// and a silently-missed reload leaves the server running stale code.
check(
  'auto-reload is opt-in, not the default',
  !/node scripts\/dev-api\.mjs"\s*$/.test(
    readFileSync('package.json', 'utf8').split('\n').find((line) => line.includes('"dev:api"')) ?? '',
  ),
  'dev:api must not enable --reload by default',
);

console.log('\n=== No fabricated animation data ===');
const hero = readFileSync('src/components/landing/HeroTopology.tsx', 'utf8');// The hero may only reference device names/IPs that already exist in the seed.
const heroStrings = [...hero.matchAll(/'(?:[^']*)'/g)].map((m) => m[1]);
const ALLOWED = new Set([...deviceNames, ...deviceIps, ...platforms, ...EXPECTED_IPS]);
const suspicious = heroStrings.filter(
  (s) => /\d+\.\d+\.\d+\.\d+/.test(s) && !ALLOWED.has(s) && !s.startsWith('cybersure-'),
);
check('hero references no unknown IP addresses', suspicious.length === 0, suspicious.join(','));
// The hero must not carry its own metric readouts (the old design had a
// floating "posture 78/100 + severity counts" card). It should only contain
// geometry, timing and styling values.
// Metric *readouts* are what must not exist. The word "high"/"low" also appears
// as an internal tone key, so only check what actually renders as text.
const renderedText = [...hero.matchAll(/>\s*\{?\s*([A-Za-z][^<>{}\n]*)\s*\}?\s*</g)].map((m) => m[1].trim());
const heroMetrics = /posture|severity|score|threat|alert|\/ ?100|\bCrit\b|\bHigh\b|\bMed\b|\bLow\b/i;
const metricText = renderedText.filter((t) => heroMetrics.test(t));
check('hero renders no metric or threat readouts', metricText.length === 0, metricText.join(' | '));
check('hero has no numeric stat-like JSX expressions', !/\{\s*\d{2,}\s*\}\s*<span/.test(hero));
check('hero only renders existing device labels', [...hero.matchAll(/label: '([^']+)'/g)].map((m) => m[1]).every((l) => l === 'Internet' || deviceNames.includes(l) || l === 'Servers / Endpoints'));

console.log(`\n${failed === 0 ? 'No demo data was added.' : `${failed} check(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);
