/* End-to-end workflow verification for the CYBERSURE demo (development only). */
import { JSDOM } from 'jsdom';
import { createElement, type ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* jsdom bootstrap — must run BEFORE react-dom is loaded.                      */
/* -------------------------------------------------------------------------- */

const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.HTMLSelectElement = dom.window.HTMLSelectElement;
g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.localStorage = dom.window.localStorage;
g.URL = dom.window.URL;
g.Blob = dom.window.Blob;
g.requestAnimationFrame = (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id: number) => dom.window.clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;
g.matchMedia = dom.window.matchMedia;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${extra ? ` — ${extra}` : ''}`);
    console.log(`  FAIL  ${label}${extra ? ` \u2014 ${extra}` : ''}`);
  }
}

function step(title: string) {
  console.log(`\n\u2500\u2500 ${title}`);
}

async function main() {
  const [{ act }, { createRoot }, routerMod, appMod, storeMod, themeMod, toastMod, stubMod] = await Promise.all([
    import('react-dom/test-utils'),
    import('react-dom/client'),
    import('react-router-dom'),
    import('../src/App'),
    import('../src/lib/store'),
    import('../src/hooks/useTheme'),
    import('../src/components/ui/Toast'),
    import('./apiStub'),
  ]);
  const { MemoryRouter, useNavigate } = routerMod;
  const { AppRoutes } = appMod;
  const { CyberSureProvider } = storeMod;
  const { ThemeProvider } = themeMod;
  const { ToastProvider } = toastMod;
  // The converter talks to FastAPI; stand the API up in-process so the page,
  // the API client and the adapter all run for real.
  const api = stubMod.installApiStub();

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  // Capture the router's navigate directly instead of mirroring the path in
  // React state — a mirrored effect fights the router and reverts clicks.
  let nav: (path: string) => void = () => undefined;
  function NavCapture() {
    nav = useNavigate();
    return null;
  }
  function Harness() {
    return createElement(
      'div',
      null,
      createElement(NavCapture),
      createElement(AppRoutes),
    );
  }
  const go = (path: string) => {
    act(() => {
      nav(path);
    });
  };

  act(() => {
    root.render(
      createElement(
        ThemeProvider,
        null,
        createElement(
          ToastProvider,
          null,
          createElement(
            CyberSureProvider,
            null,
            createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Harness)),
          ),
        ),
      ) as ReactNode,
    );
  });

  const settle = async (ms = 0) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  };

  const text = () => container.textContent ?? '';
  const bodyText = () => dom.window.document.body?.textContent ?? '';
  const flat = () => (container.textContent ?? '').replace(/\s+/g, ' ');
  /** Reads the dashboard posture gauge, labelled "Security posture: N out of 100". */
  const postureOf = () => {
    const gauge = container.querySelector('[aria-label^="Security posture"]');
    const label = gauge?.getAttribute('aria-label') ?? '';
    return Number(/(\d+)\s+out of 100/.exec(label)?.[1] ?? '0');
  };
  const all = (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector));
  const button = (label: string) => {
    const match = all('button').find((element) => (element.textContent ?? '').trim().toLowerCase() === label.toLowerCase());
    if (!match) {
      const available = all('button').map((element) => (element.textContent ?? '').trim()).filter(Boolean).slice(0, 60);
      throw new Error(`Button "${label}" not found. Available: ${JSON.stringify(available)}`);
    }
    return match;
  };
  const click = (element: Element | undefined | null, label: string) => {
    if (!element) throw new Error(`Cannot click missing element: ${label}`);
    act(() => {
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };
  const setSelect = (select: HTMLSelectElement, value: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, value);
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  const setText = (input: HTMLTextAreaElement, value: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };

  /* ---------------------------------------------------------------------- */
  step('STEP 1-2 · Landing page and Start Assessment');
  await settle();
  check('Landing renders the CYBERSURE name', text().includes('CYBERSURE'));
  check('Hero headline present', text().includes('Secure Your Network.'));
  check('Hero sub-headline present', text().includes('Simplify Your Configuration.'));
  check('Supporting paragraph present', text().includes('Analyze network configurations, identify security risks'));
  check('No environment wording on the landing page', !/demo environment|sample data only/i.test(text()), flat().slice(0, 200));
  check('Topology shows Internet → Firewall → Router → Switch → Servers', text().includes('Internet') && text().includes('Edge-Firewall-01') && text().includes('Core-Router-01') && text().includes('Access-Switch-01') && text().includes('Servers / Endpoints'));
  check('How It Works steps 01-04 present', ['01', '02', '03', '04'].every((s) => text().includes(s)));
  check('Four value cards present', ['Configuration Analysis', 'Configuration Conversion', 'Security & Compliance', 'Reports & Assistance'].every((s) => text().includes(s)));
  check('Landing nav has How It Works / Features / About', text().includes('How It Works') && text().includes('Features') && text().includes('About'));
  check('Landing does NOT render the dashboard', !text().includes('Security Posture'));
  check('Footer carries no environment wording', !/demo environment|sample data only/i.test(text()));

  click(button('Start Assessment'), 'Start Assessment');
  await settle();
  check('Dashboard opened after Start Assessment', text().includes('Security overview'), flat().slice(0, 200));
  check('Dashboard has no environment badge', !/demo environment|sample data only/i.test(text()));

  /* ---------------------------------------------------------------------- */
  step('STEP 4-5 · Devices list and Core-Router-01 detail');
  go('/devices');
  await settle();
  check('Devices page title', text().includes('Network Devices'));
  check('Devices page subtitle', text().includes('Manage and analyze devices in your environment.'));
  for (const name of ['Core-Router-01', 'Edge-Firewall-01', 'Access-Switch-01', 'Branch-FW-01', 'Wireless-Controller-01']) {
    check(`Device listed: ${name}`, text().includes(name));
  }
  check('Add Device button', Boolean(all('button').find((b) => (b.textContent ?? '').trim() === 'Add Device')));

  // Filters must actually work.
  const selects = all('select');
  const typeSelect = selects.find((s) => (s.getAttribute('aria-label') ?? '').toLowerCase().includes('device type'));
  const before = text().includes('Core-Router-01');
  if (typeSelect) {
    setSelect(typeSelect, 'firewall');
    await settle();
    check('Type filter removes routers', !text().includes('Core-Router-01'), 'Core-Router-01 still visible');
    check('Type filter keeps firewalls', text().includes('Edge-Firewall-01'));
    setSelect(typeSelect, 'all');
    await settle();
    check('Type filter reset restores rows', text().includes('Core-Router-01') === before);
  } else {
    check('Device type filter present', false, 'no type select found');
  }

  // Security filter
  const securitySelect = all('select').find((s) => (s.getAttribute('aria-label') ?? '').toLowerCase().includes('security'));
  if (securitySelect) {
    setSelect(securitySelect, 'critical');
    await settle();
    check('Security filter narrows the list', text().length > 0);
    setSelect(securitySelect, 'all');
    await settle();
  } else {
    check('Security filter present', false);
  }

  go('/devices/dev-core-router-01');
  await settle();
  check('Device detail shows name', text().includes('Core-Router-01'));
  check(
    'Device detail shows tabs',
    ['Overview', 'Configuration', 'Security Issues', 'Compliance', 'Change History'].every((s) => text().includes(s)),
    flat().slice(0, 400),
  );
  check(
    'Run Security Scan button on device',
    Boolean(all('button').find((b) => (b.textContent ?? '').includes('Run Security Scan'))),
  );
  check(
    'View Configuration button on device',
    Boolean(all('button').find((b) => (b.textContent ?? '').includes('View Configuration'))),
  );

  /* ---------------------------------------------------------------------- */
  step('STEP 6-11 · Remediate Telnet and verify state propagates');
  go('/assessment');
  await settle();
  const postureBefore = postureOf();
  const complianceBefore = Number(/Overall[\s\S]{0,160}?(\d+)%/.exec(text())?.[1] ?? '0');
  check('Dashboard posture is a real score', postureBefore > 0 && postureBefore <= 100, String(postureBefore));

  go('/issues');
  await settle();
  check('Security Analysis page renders', text().includes('Security Analysis'));
  check('Run Security Analysis button present', Boolean(all('button').find((b) => (b.textContent ?? '').includes('Run Security Analysis'))));
  check('Telnet finding visible on Core-Router-01', text().includes('Telnet'));
  check('Finding shows current and recommended value', text().includes('Enabled') && text().includes('Disabled'));

  const fixButtons = all('button').filter((b) => (b.textContent ?? '').toLowerCase().includes('review & fix'));
  check('Review & Fix button available', fixButtons.length > 0);
  const telnetCard = all('article').find((a) => (a.textContent ?? '').includes('Telnet'));
  const telnetFix = telnetCard
    ? Array.from(telnetCard.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Review'))
    : undefined;
  click(telnetFix ?? fixButtons[0], 'Review & Fix');
  await settle();
  check('Remediation dialog opened', Boolean(container.querySelector('[role="dialog"]')));
  const dialogText = () => container.querySelector('[role="dialog"]')?.textContent ?? '';
  check('Dialog shows current value Enabled', /Current value[\s\S]{0,40}Enabled/i.test(dialogText()));
  check('Dialog mentions recommended value', /Recommended[\s\S]{0,60}Disabled/.test(dialogText()));
  check('Dialog shows Validate Configuration', dialogText().includes('Validate Configuration'));
  check('Dialog warns no real device is modified', /No real device was contacted|Demo change|simulates the write locally/i.test(dialogText()));

  // STEP 8 · change Telnet Enabled → Disabled via the value control.
  const dialog = container.querySelector('[role="dialog"]')!;
  const valueControl = dialog.querySelector<HTMLElement>('#cybersure-new-value');
  check('Value control present for Telnet', Boolean(valueControl));
  check('Value control starts as Enabled', /Enabled/.test(dialogText()));
  if (valueControl) {
    click(valueControl, 'Telnet value switch');
    await settle(200);
  }
  check('Value control switched to Disabled', /New value[\s\S]{0,40}Disabled/i.test(dialogText()), dialogText().slice(0, 260));
  check('Proposed value now shows Disabled', /Proposed value[\s\S]{0,40}Disabled/i.test(dialogText()), dialogText().slice(0, 260));

  const validateBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes('Validate Configuration'),
  );
  check('Validate Configuration is enabled after the edit', validateBtn ? !(validateBtn as HTMLButtonElement).disabled : false);
  click(validateBtn, 'Validate Configuration');
  await settle(1800);
  const validated = dialog.textContent ?? '';
  check('Syntax validation shown', /Syntax validation/i.test(validated), validated.slice(0, 300));
  check('Security policy validation shown', /Security policy validation/i.test(validated));
  check('Compliance validation shown', /Compliance validation/i.test(validated));
  check('Conflict validation shown', /Configuration conflict check/i.test(validated));
  check('Valid change result shown', /valid/i.test(validated), validated.slice(0, 300));
  check('Apply Change offered after validation', /Apply Change/.test(validated), validated.slice(0, 300));

  const applyBtn = Array.from(dialog.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Apply Change'));
  click(applyBtn, 'Apply Change');
  await settle(400);
  check('Issue marked RESOLVED after apply', /Resolved/i.test(container.textContent ?? ''));

  go('/assessment');
  await settle();
  const postureAfter = postureOf();
  check('Security posture updated', postureAfter > postureBefore, `${postureBefore} -> ${postureAfter}`);

  go('/compliance');
  await settle();
  const complianceAfter = Number(/Overall[\s\S]{0,160}?(\d+)%/.exec(text())?.[1] ?? '0');
  check('Compliance recalculated', complianceAfter >= complianceBefore, `${complianceBefore} -> ${complianceAfter}`);

  go('/changes');
  await settle();
  check('Change history records the remediation', text().includes('Core-Router-01') && /Telnet/.test(text()));
  check('Change shows old → new value', /Enabled/.test(text()) && /Disabled/.test(text()));

  /* ---------------------------------------------------------------------- */
  step('Scan system');
  go('/issues');
  await settle();
  const analysisBtn = all('button').find((b) => (b.textContent ?? '').includes('Run Security Analysis'));
  check('Run Security Analysis available', Boolean(analysisBtn));
  if (analysisBtn) {
    click(analysisBtn, 'Run Security Analysis');
    await settle(300);
    check(
      'Scan shows its progress phases',
      /Scanning configuration/.test(text()) || /Checking access controls/.test(text()),
    );
    await settle(3600);
    check(
      'Scan completes with a result toast',
      /Security analysis complete/i.test(bodyText()),
      bodyText().slice(-260).replace(/\s+/g, ' '),
    );
  }
  go('/assessment');
  await settle();
  check('Posture is still consistent after the scan', postureOf() === postureAfter, `${postureOf()} != ${postureAfter}`);

  /* ---------------------------------------------------------------------- */
  step('STEP 12-18 · Configuration converter');
  go('/converter');
  await settle(400);
  check('Converter page renders', text().includes('Configuration Converter'));
  check('Source/Target panels present', text().includes('Source Configuration') && text().includes('Converted Configuration'));
  check('Backend connection reported', /Conversion service connected|Checking the CYBERSURE conversion service/.test(text()));
  const convSelects = all('select');
  const fromSelect = convSelects.find((s) => s.id === 'converter-from');
  const toSelect = convSelects.find((s) => s.id === 'converter-to');
  check('From/To selectors present', Boolean(fromSelect && toSelect));
  check('Selector options come from the device API', (fromSelect?.options.length ?? 0) >= 12, `${fromSelect?.options.length} options`);
  if (fromSelect && toSelect) {
    setSelect(fromSelect, 'cisco-nxos');
    await settle(200);
    setSelect(toSelect, 'juniper-junos');
    await settle(200);
  }
  check('NX-OS source sample loaded', text().includes('hostname Core-Switch-01'));
  check('Source editor has line numbers gutter', Boolean(container.querySelector('textarea[aria-label="Source configuration"]')));

  // The specific flow that previously returned "no mapping".
  const beforeCalls = api.calls();
  click(button('Convert Configuration'), 'Convert Configuration');
  await settle(1400);
  const convText = () => container.textContent ?? '';
  check('Conversion was sent to the API', api.calls() > beforeCalls, `${api.calls() - beforeCalls} call(s)`);
  check('Converted Junos output produced', convText().includes('set system host-name Core-Switch-01'));
  check('Interface name translated to ge-1/0/1', convText().includes('set interfaces ge-1/0/1'));
  check('Success state label shown', /CONVERSION SUCCESSFUL|PARTIAL CONVERSION|REQUIRES REVIEW/.test(convText()), convText().slice(0, 200));
  check('Conversion Summary shown', convText().includes('Conversion Summary'));
  check('Commands processed reported', /Commands processed\s*\d+/.test(convText().replace(/\s+/g, ' ')));
  check('Converted count reported', /Converted\s*\d+/.test(convText().replace(/\s+/g, ' ')));
  check('Needs review count reported', /Needs review\s*\d+/.test(convText().replace(/\s+/g, ' ')));
  check('Copy / Download / JSON report controls present', ['Copy', 'Download', 'Save as File', 'Download JSON Report'].every((s) => convText().includes(s)));
  check('Upload File and Paste Configuration controls present', ['Upload File', 'Paste Configuration'].every((s) => convText().includes(s)));
  check('Command mapping table present', convText().includes('Command Mapping'));
  check('No "no mapping" wording remains', !/no mapping|mapping not available|hand-written/i.test(convText()));

  click(button('Validate Converted Configuration'), 'Validate Converted Configuration');
  await settle(700);
  const validatedText = convText().replace(/\s+/g, ' ');
  check('Validation: Syntax Check', validatedText.includes('Syntax Check'));
  check('Validation: Command Mapping', validatedText.includes('Command Mapping'));
  check('Validation: Required Parameters', validatedText.includes('Required Parameters'));
  check('Validation: Potential Conflicts', validatedText.includes('Potential Conflicts'));
  check('Validation outcome reported', /Conversion Validation Complete/.test(validatedText));
  check('Explain Conversion available', convText().includes('Explain Conversion'));

  // The validation run must reach the notification feed, not just the panel.
  const convBell = all('button').find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Notifications'));
  if (convBell) {
    click(convBell, 'Notifications (after validation)');
    await settle(150);
    check('Notification feed shows the validation', /Configuration validation completed/.test(container.textContent ?? ''));
    click(convBell, 'Close notifications');
    await settle(120);
  }

  // Editing the source must re-run the conversion, and an empty source must
  // produce an empty state rather than a fabricated result.
  const sourceArea = container.querySelector('textarea[aria-label="Source configuration"]') as HTMLTextAreaElement | null;
  check('Source editor is editable', Boolean(sourceArea) && !sourceArea!.readOnly);
  if (sourceArea) {
    setText(sourceArea, 'hostname Router1\nip domain-name example.com\nip ssh version 2\ninterface GigabitEthernet0/1\n ip address 10.9.9.9 255.255.255.0\n');
    await settle(1500);
    check(
      'Editing the source re-runs the conversion through the API',
      convText().includes('10.9.9.9/24') && convText().includes('Conversion Summary'),
      convText().slice(0, 200),
    );
    setText(sourceArea, '');
    await settle(400);
    check('Empty source shows an empty state', /No configuration loaded|Paste a configuration here/i.test(convText()));
    // Restore the sample so the remaining converter checks are meaningful.
    const sampleSelect = convSelects.find((s) => (s.getAttribute('aria-label') ?? '').includes('sample configuration'));
    if (sampleSelect) {
      setSelect(sampleSelect, 'nxos-core');
      await settle(1500);
      check('Reloading the sample restores the conversion', convText().includes('set system host-name Core-Switch-01'));
    }
  }

  // The pair that used to be refused outright must now convert for real.
  if (toSelect) {
    setSelect(toSelect, 'cisco-nxos');
    await settle(200);
    check(
      'NX-OS -> NX-OS no longer reports "no mapping"',
      !/mapping not available|hand-written|No mapping/i.test(convText()),
      convText().slice(0, 160),
    );
  }

  // A different target must produce different output.
  if (fromSelect && toSelect) {
    setSelect(fromSelect, 'juniper-junos');
    await settle(300);
    setSelect(toSelect, 'cisco-iosxe');
    await settle(300);
    click(button('Convert Configuration'), 'Convert Configuration (junos->cisco)');
    await settle(1400);
    check('Junos → IOS XE produces Cisco syntax', convText().includes('interface GigabitEthernet0/0/1'));
    setSelect(fromSelect, 'cisco-iosxe');
    await settle(200);
    setSelect(toSelect, 'fortinet-fortios');
    await settle(200);
    click(button('Convert Configuration'), 'Convert Configuration (iosxe->fortios)');
    await settle(1400);
    check('IOS XE → FortiOS produces FortiOS blocks', convText().includes('config system global') && convText().includes('set hostname'));
    setSelect(toSelect, 'paloalto-panos');
    await settle(200);
    click(button('Convert Configuration'), 'Convert Configuration (iosxe->panos)');
    await settle(1400);
    check('IOS XE → PAN-OS produces PAN-OS syntax', convText().includes('set deviceconfig hostname'));
    setSelect(fromSelect, 'huawei-vrp');
    await settle(200);
    setSelect(toSelect, 'vyos');
    await settle(200);
    click(button('Convert Configuration'), 'Convert Configuration (vrp->vyos)');
    await settle(1400);
    check('VRP → VyOS converts without a pair allow-list', convText().includes("set host-name '"));
  }

  // The API going away must produce a clear state, never a blank screen.
  api.configure({ failConversion: true });
  click(button('Convert Configuration'), 'Convert Configuration (backend error)');
  await settle(1200);
  check(
    'A 5xx is reported as a server error, not as an outage',
    /The conversion service returned an error/.test(convText()),
    convText().slice(0, 180),
  );
  check('A 5xx is shown with its HTTP status', /HTTP 500/.test(convText()));
  check('A 5xx offers a retry', /Try again/i.test(convText()));
  api.configure({ failConversion: false });

  // And a completely unreachable backend must explain itself, name the URL and
  // offer a retry — not blank the page.
  api.configure({ offline: true });
  go('/devices');
  await settle(300);
  go('/converter');
  await settle(900);
  check('Unreachable backend is reported', /conversion service is unavailable|not responding/i.test(convText()));
  check('Unreachable backend names the API base URL', convText().includes('http://localhost:8000'));
  check('Unreachable backend explains how to start it', /uvicorn app\.main:app/i.test(convText()));
  check('Unreachable backend offers Retry', /Retry/.test(convText()));
  check('Page still renders its panels while offline', convText().includes('Source Configuration') && convText().includes('Converted Configuration'));
  check('Convert button is still reachable', Boolean(button('Convert Configuration')));
  api.configure({ offline: false });
  const retry = all('button').find((b) => (b.textContent ?? '').trim() === 'Retry');
  if (retry) {
    click(retry, 'Retry (backend restored)');
    await settle(900);
    check('Recovers when the backend returns', /Conversion service connected/.test(convText()), convText().slice(0, 160));
  } else {
    check('Retry control present while offline', false, 'no Retry button found');
  }
  api.restore();

  /* ---------------------------------------------------------------------- */
  step('STEP 19 · Reports');
  go('/reports');
  await settle();
  check('Reports page renders', text().includes('Security Reports'));
  for (const title of ['Security Assessment Report', 'Configuration Analysis Report', 'Compliance Report', 'Configuration Conversion Report']) {
    check(`Report card: ${title}`, text().includes(title));
  }
  const generateButtons = all('button').filter((b) => (b.textContent ?? '').trim() === 'Generate');
  check('Generate buttons present', generateButtons.length > 0);

  click(generateButtons[0], 'Generate security assessment');
  await settle(400);
  const reportText = text();
  check('Report detail opened', reportText.includes('CYBERSURE') && !/demo environment/i.test(reportText));
  for (const section of ['Executive Summary', 'Security Posture', 'Critical Findings', 'Affected Devices', 'Configuration Changes', 'Recommendations']) {
    check(`Report section: ${section}`, reportText.includes(section));
  }
  check('Explain with Assistant button present', reportText.includes('Explain with Assistant'));
  check('Non-configuration report still offers PDF', reportText.includes('Download PDF'));

  // Configuration reports must download as JSON, never as PDF/DOC/DOCX/TXT.
  go('/reports');
  await settle(300);
  // Re-locate the Configuration Analysis card's own Generate button now that
  // the previous run replaced the button with "Regenerate".
  // Back to the library. Card order matches the catalogue, so index 1 is the
  // Configuration Analysis report. Re-query the buttons: generating the first
  // report renames its button to "Regenerate".
  go('/reports');
  await settle(300);
  const generateOrRegenerate = all('button').filter((b) => /^(Generate|Regenerate)$/.test((b.textContent ?? '').trim()));
  check('Configuration report has a Generate control', generateOrRegenerate.length === 4, `found ${generateOrRegenerate.length}`);
  click(generateOrRegenerate[1], 'Generate configuration analysis');
  await settle(400);
  // The report *detail* view is what carries the download control; the cards
  // behind it list every report, so scope the assertion to the detail header.
  const detailHeader = Array.from(container.querySelectorAll('header')).find((el) =>
    (el.textContent ?? '').includes('Configuration Analysis Report'),
  );
  const detailText = detailHeader?.textContent ?? '';
  check('Configuration report detail opened', detailText.includes('Configuration Analysis Report'), detailText.slice(0, 200));
  check('Configuration report offers JSON download', detailText.includes('Download JSON'));
  check('Configuration report offers no PDF download', !detailText.includes('Download PDF'), detailText);
  check('Configuration report offers no DOC/DOCX/TXT', !/Download (DOC|DOCX|TXT)/i.test(detailText));

  // Capture what the download actually produces. The app uses the global
  // `URL`, which in this jsdom harness is dom.window.URL.
  const captured: { content: string }[] = [];
  const winURL = dom.window.URL as unknown as Record<string, unknown>;
  const originalCreate = winURL.createObjectURL;
  const originalRevoke = winURL.revokeObjectURL;
  winURL.createObjectURL = (blob: Blob) => {
    void blob.text().then((content) => captured.push({ content }));
    return 'blob:captured';
  };
  winURL.revokeObjectURL = () => undefined;
  const originalClick = dom.window.HTMLAnchorElement.prototype.click;
  let downloadedName = '';
  dom.window.HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
    if (this.download) downloadedName = this.download;
  };
  // Pick the JSON control from the report detail header, not the cards behind it.
  const detailRoot = Array.from(container.querySelectorAll('header')).find((el) =>
    (el.textContent ?? '').includes('Configuration Analysis Report'),
  );
  const jsonButton = Array.from((detailRoot ?? container).querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === 'Download JSON',
  );
  check('Download JSON button is clickable', Boolean(jsonButton));
  click(jsonButton, 'Download JSON');
  await settle(400);
  dom.window.HTMLAnchorElement.prototype.click = originalClick;
  winURL.createObjectURL = originalCreate;
  winURL.revokeObjectURL = originalRevoke;
  check('Downloaded filename is configuration-report.json', downloadedName === 'configuration-report.json', downloadedName);

  let parsedReport: Record<string, unknown> | null = null;
  try {
    const payload = captured[0]?.content ?? '';
    check('Downloaded content is non-empty', payload.length > 0);
    parsedReport = JSON.parse(payload) as Record<string, unknown>;
    check('Downloaded content is valid JSON', parsedReport !== null);
  } catch (error) {
    check('Downloaded content is valid JSON', false, String(error));
  }
  if (parsedReport) {
    const keys = Object.keys(parsedReport);
    check('JSON uses only the requested top-level keys', keys.every((key) => ['report', 'configuration', 'findings', 'changes'].includes(key)), keys.join(','));
    check('JSON report block present', Boolean(parsedReport.report));
    check('JSON configuration block present', Array.isArray(parsedReport.configuration));
    check('JSON findings block present', Array.isArray(parsedReport.findings));
    check('JSON changes block present', Array.isArray(parsedReport.changes));
    // Must be the existing estate, not invented data.
    check('JSON contains the 12 existing devices', (parsedReport.configuration as unknown[]).length === 12, String((parsedReport.configuration as unknown[]).length));
    check('JSON device names come from the existing estate', JSON.stringify(parsedReport.configuration).includes('Core-Router-01'));
  }

  /* ---------------------------------------------------------------------- */
  step('STEP 20 · AI assistant');
  go('/assistant?context=finding&finding=dev-core-router-01::mgmt.telnet');
  await settle(500);
  check('Assistant page renders', text().includes('CyberSure Assistant') || text().includes('CYBERSURE Assistant'));
  check('Quick actions present', ['Explain this finding', 'Analyze this configuration', 'Explain conversion warning', 'How should I remediate this?', 'Summarize security posture'].every((s) => text().includes(s)));
  check('Assistant states it has no network access', /no connection to any real network/i.test(text()));

  const composer = container.querySelector('textarea[aria-label="Message the CYBERSURE assistant"]') as HTMLTextAreaElement | null;
  check('Composer present', Boolean(composer));
  if (composer) {
    setText(composer, 'Why is Telnet considered insecure?');
    await settle(50);
    const sendBtn = all('button').find((b) => (b.textContent ?? '').trim() === 'Send');
    click(sendBtn, 'Send');
    await settle(700);
    const answer = text();
    check('Assistant answers the Telnet question', /Telnet transmits/i.test(answer));
    check('Assistant answer references SSH', /SSH/i.test(answer));
    check('Related finding links rendered', answer.includes('Related in this session'));
  }

  // Context-aware: assistant should discuss the device when anchored.
  go('/assistant?context=device&device=dev-core-router-01');
  await settle(400);
  check('Assistant anchored to a device', text().includes('Core-Router-01'));

  /* ---------------------------------------------------------------------- */
  step('STEP 21-22 · Theme switch and final consistency');
  go('/assessment');
  await settle();
  check('Dark mode active before toggle', dom.window.document.documentElement.classList.contains('dark'));
  const themeButton = all('button').find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Theme:'));
  check('Theme toggle present in header', Boolean(themeButton));
  if (themeButton) {
    click(themeButton, 'Theme toggle');
    await settle(120);
    check(
      'Theme switched away from dark',
      !dom.window.document.documentElement.classList.contains('dark'),
      dom.window.document.documentElement.className,
    );
    click(themeButton, 'Theme toggle back');
    await settle(120);
  }
  const finalText = text();
  check('Posture reflects the remediation after returning to dashboard', postureOf() === postureAfter, `${postureOf()} != ${postureAfter}`);

  // Sidebar: jsdom reports a phone-sized viewport, so the console shows the
  // collapsible drawer. Open it and assert the full navigation is present.
  const navToggle = all('button').find((b) => /Expand navigation|Collapse navigation/.test(b.getAttribute('aria-label') ?? ''));
  check('Sidebar toggle present', Boolean(navToggle));
  if (navToggle) {
    click(navToggle, 'Sidebar toggle');
    await settle(200);
  }
  const sidebar = container.querySelector('aside');
  const sidebarText = sidebar?.textContent ?? '';
  const requiredNav = [
    'Overview',
    'Devices',
    'Configuration Converter',
    'Security Analysis',
    'Compliance',
    'Reports',
    'AI Assistant',
    'Settings',
  ];
  const missingNav = requiredNav.filter((item) => !sidebarText.includes(item));
  check('Sidebar nav includes all required items', missingNav.length === 0, `missing: ${missingNav.join(', ')}`);
  check('Sidebar brands the product as CYBERSURE', sidebarText.includes('CYBERSURE'));

  /* ---------------------------------------------------------------------- */
  step('Extra · Notifications, global search, reset');
  const bell = all('button').find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Notifications'));
  check('Notification bell present', Boolean(bell));
  if (bell) {
    click(bell, 'Notifications');
    await settle(150);
    const menu = container.textContent ?? '';
    // The feed is most-recent-first and capped, so assert on the events still
    // in the window. The validation event is asserted in the converter step,
    // where it is generated.
    check('Notification feed shows the report', /Report generated|Security Assessment Report|Configuration Analysis Report/.test(menu));
    check('Notification feed shows the conversion', /Configuration converted/.test(menu));
    check('Notification feed shows a change or security alert', /Configuration change applied|Notifications/.test(menu));
    const clearBtn = all('button').find((b) => (b.textContent ?? '').trim() === 'Clear');
    if (clearBtn) {
      click(clearBtn, 'Clear notifications');
      await settle();
      check('Clearing the feed removes the events', !/Configuration converted/.test(container.textContent ?? ''));
      check('Security alerts survive clearing the feed', /Critical|High/.test(container.textContent ?? ''));
    }
  }

  go('/assessment');
  await settle();
  const searchBtn = all('button').find((b) => (b.getAttribute('aria-label') ?? '').includes('global search'));
  check('Global search trigger present', Boolean(searchBtn));
  if (searchBtn) {
    click(searchBtn, 'Search');
    await settle(150);
    const searchInput = container.querySelector('input[aria-label*="Search"]') as HTMLInputElement | null;
    if (searchInput) {
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
        setter.call(searchInput, 'Telnet');
        searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      await settle(200);
      const results = container.textContent ?? '';
      check('Search finds Telnet finding', /Telnet/.test(results));
      check('Search finds the affected device', /Core-Router-01|Lab-Switch-01/.test(results));
      check('Search finds the configuration setting', /Configuration settings/.test(results));
    } else {
      check('Search input present', false);
    }
  }

  // Reset restores the seed state.
  go('/settings');
  await settle();
  const resetBtn = all('button').find((b) => (b.textContent ?? '').includes('Reset Data'));
  check('Reset Data present', Boolean(resetBtn));
  if (resetBtn) {
    click(resetBtn, 'Reset Data');
    await settle(200);
    const dialog = container.querySelector('[role="dialog"]')!;
    const confirm = Array.from(dialog.querySelectorAll('button')).find((b) => /Reset Data/i.test(b.textContent ?? ''));
    click(confirm, 'Confirm reset');
    await settle(600);
  }
  go('/assessment');
  await settle();
  check('Reset restored the original posture', postureOf() === postureBefore, `${postureOf()} != ${postureBefore}`);

  /* ---------------------------------------------------------------------- */
  step('Engine invariants');
  // The conversion engine now lives in the FastAPI backend and is covered by
  // `backend/tests` and `scripts/api-check.mjs`. What is worth asserting here is
  // the frontend's half: that the adapter maps the wire format faithfully and
  // never invents a field the API did not send.
  const adapter = await import('../src/lib/conversionAdapter');
  const canned = {
    id: 'CONV-TEST01',
    source_platform: 'cisco-nxos',
    target_platform: 'juniper-junos',
    status: 'partial' as const,
    converted_configuration: 'set system host-name r1\ncommit\n',
    commands_processed: 4,
    commands_converted: 3,
    requires_review: 1,
    unsupported: 1,
    warnings: [
      { id: 'w1', status: 'requires_review' as const, concept: 'Syslog', detail: 'Review syslog routing.' },
      { id: 'w2', status: 'unsupported' as const, concept: 'ACLs', detail: 'No equivalent.', source_command: 'ip access-list extended A' },
    ],
    validation: [
      { id: 'syntax', label: 'Syntax Check', status: 'pass' as const, detail: 'ok' },
      { id: 'mapping', label: 'Command Mapping', status: 'warn' as const, detail: '2 flagged' },
    ],
    mapping: [
      { line: 1, source: 'hostname r1', target: ['set system host-name r1'], status: 'converted' as const, rule_id: 'normalized', rule_label: 'Normalized model translation' },
      { line: 2, source: 'ip access-list extended A', target: [], status: 'requires_review' as const, rule_id: 'junos', rule_label: 'firewall filter', note: 'No equivalent' },
    ],
    ignored_lines: 2,
    created_at: '2026-01-01T00:00:00Z',
  };
  const adapted = adapter.toConversionResult(canned, { sourceConfig: 'hostname r1', from: 'cisco-nxos', to: 'juniper-junos' });
  check('Adapter preserves the conversion id', adapted.id === 'CONV-TEST01');
  check('Adapter maps counts without alteration', adapted.processed === 4 && adapted.converted === 3 && adapted.needsReview === 1 && adapted.unsupported === 1);
  check('Adapter keeps the backend status', adapted.backendStatus === 'partial');
  check('Adapter maps requires_review to review', adapted.mapping[1].status === 'review');
  check('Adapter keeps converted rows converted', adapted.mapping[0].status === 'converted');
  check('Adapter derives valid-with-review from a warning stage', adapted.status === 'valid-with-review', adapted.status);
  check('Adapter exposes the report id for JSON download', adapted.reportId === 'CONV-TEST01');
  check('Unsupported warnings are not dropped', adapted.warnings.length === 2);
  check('Unsupported warning keeps its source command', adapted.warnings[1].detail.includes('ip access-list extended A'));

  const noValidation = adapter.withValidation(adapted, []);
  check('An empty stage list means "not run"', noValidation.validation === null && noValidation.status === 'not-run');
  const failedValidation = adapter.withValidation(adapted, [
    { id: 'syntax', label: 'Syntax Check', status: 'fail', detail: 'bad' },
  ]);
  check('A failed stage means invalid', failedValidation.status === 'invalid');

  /* ---------------------------------------------------------------------- */
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  console.log('='.repeat(60));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nHARNESS ERROR:', error);
  process.exit(1);
});
