/* Local verification of the CyberSure demo engine (not part of the app bundle). */
import { seedDevices } from '../src/data/seedDevices';
import { seedChanges } from '../src/data/seedChanges';
import { analyse, isValueCompliant, deviceComplianceStatus } from '../src/lib/analysis';
import { validateChange, validateDevice } from '../src/lib/validation';
import { CONFIG_BY_ID } from '../src/data/configSchema';

const analysis = analyse(seedDevices, seedChanges);

console.log('=== CyberSure demo engine verification ===\n');
console.log('Devices:', seedDevices.length);
console.log('Security posture:', analysis.posture, '/ 100');
console.log('Open findings:', analysis.breakdown.open);
console.log('  critical:', analysis.breakdown.critical);
console.log('  high    :', analysis.breakdown.high);
console.log('  medium  :', analysis.breakdown.medium);
console.log('  low     :', analysis.breakdown.low);
console.log('Resolved (audit trail):', analysis.breakdown.resolved);
console.log('Overall compliance:', analysis.compliance.overall + '%');
for (const framework of analysis.compliance.frameworks) {
  console.log(`  ${framework.id.padEnd(10)} ${framework.score}%  (pass ${framework.passed} / fail ${framework.failed} / na ${framework.na})`);
}

const compliant = seedDevices.filter(
  (device) => (analysis.securityStatusByDevice[device.id] ?? 'compliant') === 'compliant',
);
console.log('\nFully compliant devices:', compliant.map((device) => device.name).join(', ') || 'none');

console.log('\n--- Device status ---');
for (const device of seedDevices) {
  const findings = analysis.findingsByDevice[device.id] ?? [];
  const open = findings.filter((finding) => finding.status === 'open');
  console.log(
    `${device.name.padEnd(24)} ${String(analysis.postureByDevice[device.id]).padStart(3)}/100  ` +
      `${(analysis.securityStatusByDevice[device.id] ?? '').padEnd(9)} ` +
      `compliance=${deviceComplianceStatus(device, findings).padEnd(13)} open=${open.length}`,
  );
  for (const finding of open) {
    console.log(`    [${finding.severity.toUpperCase().padEnd(8)}] ${finding.configItemId} = ${finding.currentValue} -> ${finding.recommendedValue}`);
  }
}

console.log('\n=== CORE WORKFLOW: Telnet remediation on Core-Router-01 ===\n');
const device = seedDevices[0];
const item = { ...CONFIG_BY_ID['mgmt.telnet'], value: device.config.values['mgmt.telnet'] };
console.log('Setting:', item.setting, '| current:', item.value, '| recommended:', item.recommended);

// 1. A bad proposal must be blocked.
const bad = validateChange({ device, item, rawValue: 'Enabled' });
console.log('\nProposal "Enabled" (already current / insecure):');
console.log('  valid:', bad.valid);
console.log('  stages:', bad.stages.map((stage) => `${stage.id}=${stage.status}`).join(' '));
console.log('  blocking:', bad.blocking);

// 2. Syntax rejection.
const badSyntax = validateChange({ device: seedDevices[1], item: { ...CONFIG_BY_ID['mgmt.mgmtAcl'], value: '0.0.0.0/0' }, rawValue: 'not an ip,9999' });
console.log('\nProposal "not an ip,9999" for Mgmt ACL:');
console.log('  valid:', badSyntax.valid, '| stage syntax =', badSyntax.stages[0].status);
console.log('  message:', badSyntax.stages[0].messages[0]);

// 3. The good proposal.
const good = validateChange({ device, item, rawValue: 'Disabled' });
console.log('\nProposal "Disabled" (the remediation):');
console.log('  valid:', good.valid);
for (const stage of good.stages) {
  console.log(`  - ${stage.label}: ${stage.status} — ${stage.detail}`);
  for (const message of stage.messages) console.log(`      ${message}`);
}
console.log('  advisories:', good.advisories);

// 4. Conflict detection: disable SSH on a device where Telnet and HTTP management
// are both already disabled, which would leave no remote administration path.
const hardened = seedDevices.find((candidate) => candidate.id === 'dev-access-switch-01')!;
const sshItem = { ...CONFIG_BY_ID['mgmt.ssh'], value: hardened.config.values['mgmt.ssh'] };
console.log(
  `\nConflict demo on ${hardened.name}: telnet=${hardened.config.values['mgmt.telnet']} http=${hardened.config.values['mgmt.http']} -> disable SSH`,
);
const conflict = validateChange({ device: hardened, item: sshItem, rawValue: 'Disabled' });
console.log('  valid:', conflict.valid, '| conflict stage =', conflict.stages[3].status);
console.log('  blocking:', conflict.blocking);

// 4b. Advisory (non-blocking) example: unused services inside the schema range.
const dmz = seedDevices.find((candidate) => candidate.id === 'dev-dmz-web-fw-01')!;
const backupItem = { ...CONFIG_BY_ID['sys.backupSchedule'], value: dmz.config.values['sys.backupSchedule'] };
const advisory = validateChange({ device: dmz, item: backupItem, rawValue: 'Weekly' });
console.log(`\nAdvisory demo on ${dmz.name}: config backup Weekly`);
console.log('  valid:', advisory.valid, '| policy stage =', advisory.stages[1].status);
console.log('  advisories:', advisory.advisories);

// 5. Device-wide validation.
console.log('\n=== Whole-device validation ===');
for (const target of [seedDevices[0], seedDevices[2]]) {
  const report = validateDevice(target);
  console.log(
    `${target.name}: valid=${report.valid} violations=${report.violations}`,
  );
  for (const check of report.checks) console.log(`   - [${check.status}] ${check.label}: ${check.detail}`);
}

// 6. Simulate the apply + re-analysis (posture delta).
const simulated = seedDevices.map((candidate) =>
  candidate.id === device.id
    ? { ...candidate, config: { ...candidate.config, values: { ...candidate.config.values, 'mgmt.telnet': 'Disabled' } } }
    : candidate,
);
const nextChanges = [
  {
    id: 'CHG-008',
    deviceId: device.id,
    deviceName: device.name,
    configItemId: 'mgmt.telnet',
    setting: 'Telnet',
    category: item.category,
    oldValue: 'Enabled',
    newValue: 'Disabled',
    recommended: 'Disabled',
    validationStatus: 'validated' as const,
    changeStatus: 'applied' as const,
    timestamp: new Date().toISOString(),
    actor: 'demo.operator',
    source: 'remediation' as const,
  },
  ...seedChanges,
];
const after = analyse(simulated, nextChanges);
const resolvedTelnet = after.findings.find(
  (finding) => finding.configItemId === 'mgmt.telnet' && finding.deviceId === device.id,
);
console.log('\n=== After applying the demo change ===');
console.log('Posture:', analysis.posture, '->', after.posture);
console.log('Open findings:', analysis.breakdown.open, '->', after.breakdown.open);
console.log('Telnet finding status:', resolvedTelnet?.status, '| resolved by', resolvedTelnet?.resolvedByChangeId);
console.log('Change recorded as:', nextChanges[0].id);

// 7. Compliance effect.
console.log('\n=== Compliance delta ===');
console.log('Overall:', analysis.compliance.overall, '->', after.compliance.overall);
const control = after.compliance.results.filter(
  (result) => result.deviceId === device.id && result.checkId === 'no-telnet',
);
console.log('no-telnet control for Core-Router-01:', control.map((result) => result.status).join(','));

// 8. Consistency guard: every device value must be materialised from the schema.
let schemaErrors = 0;
for (const candidate of seedDevices) {
  for (const [key, value] of Object.entries(candidate.config.values)) {
    const def = CONFIG_BY_ID[key];
    if (!def) {
      console.log('UNKNOWN SETTING', key, 'on', candidate.name);
      schemaErrors += 1;
      continue;
    }
    if (!def.deviceTypes.includes(candidate.type)) {
      console.log('TYPE MISMATCH', key, 'on', candidate.name);
      schemaErrors += 1;
    }
    if (def.type === 'select' && def.options && !def.options.some((option) => option.value === value)) {
      console.log('INVALID VALUE', key, '=', value, 'on', candidate.name);
      schemaErrors += 1;
    }
  }
}
console.log('\nSchema consistency errors:', schemaErrors);
console.log('isValueCompliant sanity:', isValueCompliant(CONFIG_BY_ID['mgmt.telnet'], 'Enabled'), isValueCompliant(CONFIG_BY_ID['mgmt.telnet'], 'Disabled'));
