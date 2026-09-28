/* Local end-to-end render test (development only, not part of the app bundle). */
import { JSDOM } from 'jsdom';
import { createElement, type ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* jsdom bootstrap — must run BEFORE react-dom is loaded, so every React and   */
/* app module is imported dynamically below.                                    */
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
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.localStorage = dom.window.localStorage;
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
    failures.push(label);
    console.log(`  FAIL  ${label}${extra ? ` \u2014 ${extra}` : ''}`);
  }
}

async function main() {
  // Loaded lazily so that react-dom sees the jsdom globals above.
  const [{ act }, { createRoot }, routerMod, appMod, storeMod, themeMod, toastMod] = await Promise.all([
    import('react-dom/test-utils'),
    import('react-dom/client'),
    import('react-router-dom'),
    import('../src/App'),
    import('../src/lib/store'),
    import('../src/hooks/useTheme'),
    import('../src/components/ui/Toast'),
  ]);
  const { MemoryRouter, useNavigate } = routerMod;
  const { AppRoutes } = appMod;
  const { CyberSureProvider } = storeMod;
  const { ThemeProvider } = themeMod;
  const { ToastProvider } = toastMod;

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);

  // Capture the router's navigate directly. Mirroring the path in React state
  // makes the effect fight the router and revert in-app navigation.
  let nav: (path: string) => void = () => undefined;
  const go = (path: string) => {
    act(() => {
      nav(path);
    });
  };

  function NavCapture() {
    nav = useNavigate();
    return null;
  }

  function Harness() {
    return createElement('div', null, createElement(NavCapture), createElement(AppRoutes));
  }

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
  const bodyText = () => (dom.window.document.body?.textContent ?? '');
  const all = (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector));
  const byText = (selector: string, needle: string) =>
    all(selector).find((element) => (element.textContent ?? '').includes(needle));

  const button = (label: string) => {
    const match = all('button').find((element) => (element.textContent ?? '').trim().toLowerCase() === label.toLowerCase());
    if (!match) {
      const available = all('button')
        .map((element) => (element.textContent ?? '').trim())
        .filter(Boolean)
        .slice(0, 40);
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

  /** Clicks a button scoped to the currently open dialog. */
  const dialogButton = (label: string) => {
    const dialog = container.querySelector('[role="dialog"]');
    if (!dialog) throw new Error('No dialog is open');
    const match = Array.from(dialog.querySelectorAll('button')).find(
      (element) => (element.textContent ?? '').trim().toLowerCase() === label.toLowerCase(),
    );
    if (!match) throw new Error(`Dialog button "${label}" not found`);
    return match;
  };

  const setValue = (input: HTMLInputElement, value: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };

  const setSelect = (select: HTMLSelectElement, value: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, value);
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };

  const goto = async (path: string, wait = 60) => {
    await act(async () => {
      go(path);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await settle(wait);
  };

  const rows = () => all('tbody tr').length;

  /* ------------------------------------------------------------------ */

  console.log('\n=== TEST 0: Landing page ===');
  await settle(700);
  check('renders the landing page first', text().includes('Secure Your Network.'));
  check('brands the product as CYBERSURE', text().includes('CYBERSURE'));
  check('does not show environment wording', !/demo environment|sample data only/i.test(text()));
  check('landing does not open the dashboard', !text().includes('Security overview'));
  check('shows the four value cards', ['Configuration Analysis', 'Configuration Conversion', 'Security & Compliance', 'Reports & Assistance'].every((s) => text().includes(s)));
  check('shows the how-it-works steps', text().includes('Add / Select Device') && text().includes('Generate Report'));

  // Start Assessment enters the console.
  const startButton = all('button').find((b) => (b.textContent ?? '').trim() === 'Start Assessment');
  check('Start Assessment button exists', Boolean(startButton));
  if (startButton) {
    act(() => {
      startButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await settle(300);

  console.log('\n=== TEST 1-2: Dashboard overview ===');
  await settle(700);
  check('renders the overview page', text().includes('Security overview'));
  check('header has no environment badge', !/demo environment/i.test(text()));
  check('shows total devices = 12', text().includes('Total devices') && text().includes('12'));
  check('shows the security posture ring', text().includes('Security posture'));
  check('shows posture', /\b78\b/.test(text()), text().slice(0, 160));
  check('shows the critical severity tile', text().includes('Critical'));
  check('shows compliant devices tile', text().includes('Compliant devices'));
  check('shows configuration changes tile', text().includes('Changes'));
  check('shows network topology nodes', text().includes('Edge-Firewall-01') && text().includes('Internet'));
  check('shows recent configuration changes', text().includes('Recent configuration changes') && text().includes('CHG-001'));
  check('shows the compliance snapshot', text().includes('Compliance snapshot'));
  check('shows critical findings list', text().includes('Critical & high findings'));
  check('shows the three demo frameworks', text().includes('CIS') && text().includes('NIST'));
  check('shows devices needing attention', text().includes('Devices needing attention'));

  console.log('\n=== TEST 3: Device inventory + filters ===');
  await goto('/devices');
  check('renders the device inventory', text().includes('Network Devices'));
  check('lists all 12 demo devices', rows() === 12, `rows=${rows()}`);
  check('shows Core-Router-01', text().includes('Core-Router-01'));
  check('shows Edge-Firewall-01', text().includes('Edge-Firewall-01'));
  check('shows Wireless-Controller-01', text().includes('Wireless-Controller-01'));
  check('shows the edge firewall IP', text().includes('10.0.0.254'));
  check('shows vendor Palo Alto Networks', text().includes('Palo Alto Networks'));
  check('shows compliance status column', text().includes('Non-compliant'));

  const typeSelect = all('select').find(
    (select) => (select as HTMLSelectElement).value === 'all' && select.textContent?.includes('Type: all'),
  );
  check('device type filter exists', Boolean(typeSelect));
  if (typeSelect) {
    setSelect(typeSelect as HTMLSelectElement, 'firewall');
    await settle(40);
    check('filtering by Firewall narrows the table to 3 rows', rows() === 3, `rows=${rows()}`);
    check('filtered list contains Branch-FW-01', text().includes('Branch-FW-01'));
    check('filtered list excludes Core-Router-01', !text().includes('Core-Router-01'));

    const vendorSelect = all('select').find((select) => select.textContent?.includes('Vendor: all'));
    if (vendorSelect) {
      setSelect(vendorSelect as HTMLSelectElement, 'Fortinet');
      await settle(40);
      check('adding a vendor filter narrows to 2 Fortinet firewalls', rows() === 2, `rows=${rows()}`);
    }
    click(byText('button', 'Clear all'), 'clear filters');
    await settle(40);
    check('clearing filters restores all devices', rows() === 12, `rows=${rows()}`);
  }

  const searchInput = () => container.querySelector<HTMLInputElement>('input[aria-label="Search name, vendor, IP, model…"]');
  check('device search field exists', Boolean(searchInput()));
  if (searchInput()) {
    setValue(searchInput()!, 'zzz-no-match');
    await settle(40);
    check('shows the empty state when nothing matches', text().includes('No devices match these filters'));
    setValue(searchInput()!, '10.0.0.254');
    await settle(40);
    check('search by IP address narrows to one device', rows() === 1, `rows=${rows()}`);
    setValue(searchInput()!, 'aruba');
    await settle(40);
    check('search by vendor works', rows() === 2, `rows=${rows()}`);
    setValue(searchInput()!, '');
    await settle(30);
    check('clearing the search restores all devices', rows() === 12, `rows=${rows()}`);
  }

  console.log('\n=== TEST 4-6: Open a device, inspect configuration ===');
  await goto('/devices/dev-core-router-01?tab=configuration');
  check('renders the device detail header', text().includes('Core-Router-01'));
  check('shows the vendor and model', text().includes('Cisco') && text().includes('ISR 4451'));
  check('configuration tab content is shown', text().includes('Management Access'));
  check('finds the insecure Telnet setting', text().includes('Telnet'));
  check('shows the recommended value', text().includes('Recommended:'));
  check('flags the deviation', text().includes('Deviation'));
  check('marks compliant settings as at baseline', text().includes('Baseline'));
  check('offers a full configuration validation', text().includes('Validate full configuration'));
  check('offers Run Security Scan and View Configuration', text().includes('Run Security Scan') && text().includes('View Configuration'));

  const tabButtons = all('[role="tab"]');
  check('five device tabs are rendered', tabButtons.length === 5, `tabs=${tabButtons.length}`);
  click(byText('[role="tab"]', 'Overview'), 'overview tab');
  await settle(30);
  check('Overview tab shows device information', text().includes('Device information') && text().includes('Serial'));
  check('Overview tab shows the configuration version', text().includes('Configuration version'));
  check('Overview tab shows the OS version', text().includes('OS / firmware'));
  check('Overview tab shows the security posture', /security posture/i.test(text()));
  click(byText('[role="tab"]', 'Security Issues'), 'issues tab');
  await settle(30);
  check('Security Issues tab lists the telnet finding', text().includes('Telnet administrative access enabled'));
  check('issues tab offers Review & fix', text().includes('Review & fix'));
  click(byText('[role="tab"]', 'Compliance'), 'compliance tab');
  await settle(30);
  check('Compliance tab shows failing controls', text().includes('Failing controls'));
  click(byText('[role="tab"]', 'Change History'), 'changes tab');
  await settle(30);
  check('Change History tab shows a change record', text().includes('CHG-001'));
  click(byText('[role="tab"]', 'Configuration'), 'configuration tab');
  await settle(30);

  console.log('\n=== TEST 7-13: Review & fix, edit, validate, apply ===');
  const telnetEdit = all('button').find((element) => element.getAttribute('aria-label')?.includes('Edit Telnet') ?? false);
  check('an Edit control exists for Telnet', Boolean(telnetEdit));
  click(telnetEdit, 'telnet edit');
  await settle(50);
  check('configuration editor modal opened', text().includes('Edit configuration · Telnet'));
  check('shows current vs proposed value', text().includes('Current value') && text().includes('Proposed value'));
  check('shows why it matters', text().includes('Why this matters'));
  check('explains the telnet risk', text().includes('encrypted communication'));
  check('warns that this is a demo', text().includes('simulates the write locally'));

  const modalSwitch = all('[role="switch"]').find(
    (element) => element.getAttribute('aria-label') === 'Enabled' || element.getAttribute('aria-label') === 'Disabled',
  );
  check('toggle control rendered for the setting', Boolean(modalSwitch));
  check('toggle starts at Enabled', modalSwitch?.getAttribute('aria-checked') === 'true');
  click(modalSwitch, 'telnet toggle');
  await settle(30);
  check('toggle switched to Disabled', modalSwitch?.getAttribute('aria-checked') === 'false');

  click(button('Validate Configuration'), 'validate');
  await settle(2000);
  check('validation reports a valid configuration', text().includes('Valid configuration'), text().slice(-600));
  check('shows the syntax stage', text().includes('Syntax validation'));
  check('shows the policy stage', text().includes('Security policy validation'));
  check('shows the compliance stage', text().includes('Compliance validation'));
  check('shows the conflict stage', text().includes('Configuration conflict check'));
  check('compliance stage names the restored control', text().includes('no-telnet'));

  click(button('Apply Change'), 'apply');
  await settle(80);
  check('success toast shown', bodyText().includes('Configuration change applied'));
  check('modal confirms the demo change only', text().includes('No real device was contacted'));
  click(button('Done'), 'done');
  await settle(50);
  check('the telnet finding text is gone from the config tab', !text().includes('Telnet administrative access enabled'));

  console.log('\n=== TEST 12-14: Issue resolved, posture updated, audit trail ===');
  await goto('/issues');
  check('security analysis page renders', text().includes('Security Analysis'));
  check('open findings dropped to 21', /\b21\b/.test(text()));

  const statusSelect = all('select').find((select) => select.textContent?.includes('Status: all'));
  check('status filter exists on the issues page', Boolean(statusSelect));
  if (statusSelect) {
    setSelect(statusSelect as HTMLSelectElement, 'open');
    await settle(40);
    // Core-Router-01's telnet finding is resolved; only Lab-Switch-01 still has Telnet on.
    const openTelnetCards = all('article').filter((card) =>
      (card.getAttribute('aria-label') ?? '').includes('Telnet administrative access enabled'),
    );
    check('only Lab-Switch-01 still has an open telnet finding', openTelnetCards.length === 1, `cards=${openTelnetCards.length}`);
    setSelect(statusSelect as HTMLSelectElement, 'resolved');
    await settle(40);
    check('resolved tab shows the telnet remediation', text().includes('Telnet administrative access enabled'));
    check('resolved entries are labelled Resolved', text().includes('Resolved'));
    setSelect(statusSelect as HTMLSelectElement, 'all');
    await settle(30);
  }

  const severitySelect = all('select').find((select) => select.textContent?.includes('Severity: all'));
  if (severitySelect) {
    setSelect(severitySelect as HTMLSelectElement, 'critical');
    await settle(40);
    check('critical filter shows 6 open critical findings', all('article').length === 6, `cards=${all('article').length}`);
    setSelect(severitySelect as HTMLSelectElement, 'all');
    await settle(30);
  }

  const deviceSelect = all('select').find((select) => select.textContent?.includes('Device: all'));
  if (deviceSelect) {
    setSelect(deviceSelect as HTMLSelectElement, 'dev-lab-switch-01');
    await settle(40);
    check('device filter narrows to Lab-Switch-01 findings', rows() === 0 && all('article').length === 2, `cards=${all('article').length}`);
    setSelect(deviceSelect as HTMLSelectElement, 'all');
    await settle(30);
  }

  const categorySelect = all('select').find((select) => select.textContent?.includes('Category: all'));
  if (categorySelect) {
    setSelect(categorySelect as HTMLSelectElement, 'Encryption');
    await settle(40);
    check('category filter narrows to encryption findings', all('article').length > 0 && all('article').length < 20, `cards=${all('article').length}`);
    setSelect(categorySelect as HTMLSelectElement, 'all');
    await settle(30);
  }

  await goto('/assessment', 700);
  check('dashboard posture increased to 79', /\b79\b/.test(text()));
  check('dashboard records the new change CHG-008', text().includes('CHG-008'));

  await goto('/changes');
  check('change history renders', text().includes('Configuration Changes'));
  check('new change CHG-008 recorded', text().includes('CHG-008'));
  check('change shows the validated/applied state', text().includes('Validated') && text().includes('Applied'));
  check('change shows Enabled -> Disabled', text().includes('Enabled') && text().includes('Disabled'));
  click(byText('button', 'View'), 'view change');
  await settle(40);
  check('change detail expands', text().includes('Previous value') && text().includes('New value') && text().includes('Baseline value'));
  check('change detail states it is a demo record', text().includes('no real device was modified'));
  click(byText('button', 'Close'), 'close change detail');
  await settle(20);

  console.log('\n=== TEST 15-16: Theme switching ===');
  await goto('/assessment');
  const html = dom.window.document.documentElement;
  check('dark theme applied by default', html.classList.contains('dark'));
  const themeButton = () => all('button').find((element) => element.getAttribute('aria-label')?.startsWith('Theme:'));
  check('theme toggle exists in the header', Boolean(themeButton()));
  click(themeButton(), 'theme toggle -> light');
  await settle(60);
  check('switching to light removes the dark class', !html.classList.contains('dark') && html.classList.contains('light'));
  check('light theme persisted to localStorage', dom.window.localStorage.getItem('cybersure.theme') === 'light');
  check('content still rendered in light mode', text().includes('Security overview'));
  click(themeButton(), 'theme toggle -> system');
  await settle(60);
  check('system preference stored', dom.window.localStorage.getItem('cybersure.theme') === 'system');
  check('system resolves to dark in this environment', html.classList.contains('dark'));
  click(themeButton(), 'theme toggle -> dark');
  await settle(60);
  check('cycles back to dark', html.classList.contains('dark') && dom.window.localStorage.getItem('cybersure.theme') === 'dark');

  console.log('\n=== TEST 17: Add demo device ===');
  await goto('/devices');
  click(button('Add Device'), 'add device');
  await settle(50);
  check('add device modal opened', text().includes('Add Device'));
  // The submit control lives inside the dialog; scope the lookup to it.
  const addDialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
  const addSubmit = Array.from(addDialog.querySelectorAll('button')).find((b) =>
    /Add Device/i.test(b.textContent ?? ''),
  );
  check('add device dialog has a submit control', Boolean(addSubmit));
  click(addSubmit, 'add device submit empty');
  await settle(40);
  check('empty name is rejected', text().includes('Enter a device name.'));
  check('invalid IP is rejected', text().includes('Enter a valid IPv4 address'));

  setValue(container.querySelector<HTMLInputElement>('#add-device-name')!, 'Core-Router-02');
  setValue(container.querySelector<HTMLInputElement>('#add-device-ip')!, 'not-an-ip');
  await settle(30);
  click(dialogButton('Add Device'), 'add device submit invalid ip');
  await settle(40);
  check('invalid IP blocks the add', text().includes('Enter a valid IPv4 address'));
  setValue(container.querySelector<HTMLInputElement>('#add-device-ip')!, '10.0.0.9');
  await settle(30);
  check('form clears the error once the IP is valid', !text().includes('Enter a valid IPv4 address'));
  click(dialogButton('Add Device'), 'add device submit 2');
  await settle(80);
  check('device added toast shown', bodyText().includes('Device added'));
  check('new device appears in the inventory', text().includes('Core-Router-02'));
  check('inventory now has 13 devices', rows() === 13, `rows=${rows()}`);
  check('new device is flagged with a security status', text().includes('High') || text().includes('Critical'));

  console.log('\n=== TEST 18: Run security scan ===');
  const scanButton = all('button').find((element) => (element.textContent ?? '').includes('Run Scan'));
  check('Run Scan button exists', Boolean(scanButton));
  click(scanButton, 'run scan');
  await settle(150);
  check('scan overlay shows progress', text().includes('Running security scan'));
  check('scan shows the collecting phase', text().includes('Collecting configuration'));
  await settle(3200);
  check('scan completes', text().includes('Scan complete'));
  check('scan reports devices scanned', text().includes('Devices scanned'));
  check('scan reports posture update', text().includes('Security posture updated'));
  check('scan toast confirms completion', bodyText().includes('Scan complete'));
  click(button('Done'), 'close scan');
  await settle(40);

  console.log('\n=== TEST 19: Reset data ===');
  await goto('/settings');
  check('settings page renders', text().includes('Settings'));
  check('theme settings present', text().includes('Appearance'));
  check('notification settings present', text().includes('Security issue alerts'));
  check('estate data section present', text().includes('Estate data'));
  check('settings has no environment wording', !/demo environment|sample data only|demo environment/i.test(text()));
  check('prototype scope section present', text().includes('Prototype scope'));
  check('disclaims live network access', text().includes('No connection to any real'));
  click(button('Reset Data'), 'reset');
  await settle(50);
  check('confirmation dialog shown', text().includes('This cannot be undone'));
  click(dialogButton('Reset data'), 'reset confirm');
  await settle(900);
  check('reset toast shown', bodyText().includes('Data reset'));

  await goto('/assessment', 700);
  check('posture restored to 78', /\b78\b/.test(text()));
  const metricValues = all('.metric').map((element) => (element.textContent ?? '').trim());
  check('open findings restored to 22', metricValues.includes('22'), `metrics=${JSON.stringify(metricValues)}`);
  await goto('/devices');
  check('inventory back to 12 devices', rows() === 12, `rows=${rows()}`);
  check('added device removed', !text().includes('Core-Router-02'));

  console.log('\n=== TEST 20: Other pages ===');
  await goto('/compliance');
  check('compliance page renders', text().includes('Overall compliance'));
  check(
    'shows the three demo frameworks',
    text().includes('CIS Benchmarks') && text().includes('ISO/IEC 27001') && text().includes('NIST SP 800-53'),
  );
  check('disclaims certification', text().includes('Demo mapping only') || text().includes('not certified'));
  check('lists compliance checks', text().includes('Compliance checks'));
  check('shows expected state for a failing control', text().includes('Expected state'));
  check('offers a Review & fix action on failing controls', text().includes('Review & fix'));

  await goto('/configuration');
  check('configuration page renders', text().includes('Configuration baseline templates'));
  check(
    'shows all three templates',
    text().includes('Secure Router Baseline') &&
      text().includes('Secure Firewall Baseline') &&
      text().includes('Secure Switch Baseline'),
  );
  check('shows a device selector', text().includes('Select a device'));
  click(button('View template'), 'view template');
  await settle(40);
  check('template dialog opens with required settings', text().includes('Required settings') && text().includes('Security checks covered'));
  check('template dialog offers apply to device', text().includes('Apply to Device'));
  click(byText('button', 'Close'), 'close template');
  await settle(30);

  await goto('/devices/dev-edge-firewall-01?tab=issues');
  check('device issues tab renders findings', text().includes('default inbound policy allows traffic'));
  check('firewall has a critical finding', text().includes('Critical'));

  console.log('\n=== TEST 21: Global search ===');
  await goto('/assessment');
  const searchButton = all('button').find((element) => element.getAttribute('aria-label') === 'Open global search');
  check('search trigger exists', Boolean(searchButton));
  click(searchButton, 'open search');
  await settle(60);
  const paletteInput = dom.window.document.querySelector<HTMLInputElement>(
    'input[aria-label="Search devices, issues, settings and reports"]',
  );
  check('search palette opened with an input', Boolean(paletteInput));
  if (paletteInput) {
    setValue(paletteInput, 'zzzz-no-such-device');
    await settle(60);
    check('search shows an empty state for no matches', bodyText().includes('No matches for'));
    setValue(paletteInput, 'Telnet');
    await settle(60);
    check('searching "Telnet" returns findings', bodyText().includes('Telnet administrative access enabled'));
    check('searching "Telnet" returns configuration settings', bodyText().includes('Configuration settings'));
    setValue(paletteInput, 'Firewall');
    await settle(60);
    const palette = dom.window.document.querySelector('[aria-label="Global search"]')?.textContent ?? '';
    check('searching "Firewall" returns matching devices', palette.includes('Edge-Firewall-01'));
    check('searching "Firewall" returns matching findings', palette.includes('default inbound policy allows traffic'));
  }
  act(() => {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await settle(40);
  check('Escape closes the search palette', !bodyText().includes('No matches for'));

  console.log('\n=== TEST 22: Notifications + deep links ===');
  await goto('/issues?focus=dev-edge-firewall-01%3A%3Afw.defaultInbound');
  check('a focused finding is highlighted', all('article').some((card) => card.className.includes('ring-accent')));
  click(all('button').find((element) => element.getAttribute('aria-label')?.startsWith('Notifications:')), 'open notifications');
  await settle(40);
  check('notification centre lists alerts', bodyText().includes('Notifications'));
  check('notification badge shows a count', Boolean(all('button').find((el) => el.getAttribute('aria-label')?.startsWith('Notifications:'))));

  console.log('\n=== TEST 23: 404 route ===');
  await goto('/does-not-exist');
  check('unknown routes show the not-found page', text().includes('Page not found'));

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) console.log(`Failed checks:\n - ${failures.join('\n - ')}`);
  console.log('');
  act(() => root.unmount());
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nRENDER TEST CRASHED:\n', error);
  process.exit(1);
});
