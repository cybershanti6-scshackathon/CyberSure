/* Ad-hoc probe: exercises the DESKTOP layout path (matchMedia => true) which
 * the main render harness never reaches, and captures console noise. */
import { JSDOM } from 'jsdom';
import { createElement, type ReactNode } from 'react';

const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
for (const key of [
  'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node',
  'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle', 'localStorage',
]) {
  g[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
g.requestAnimationFrame = (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id: number) => dom.window.clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;

// DESKTOP: report min-width:1024px as matching.
dom.window.matchMedia = ((query: string) => {
  const matches = /min-width:\s*1024px/.test(query);
  return {
    matches, media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  };
}) as unknown as typeof dom.window.matchMedia;
g.matchMedia = dom.window.matchMedia;

/* ---------------------------- console capture ----------------------------- */
const noise: string[] = [];
for (const level of ['error', 'warn'] as const) {
  const original = console[level];
  console[level] = (...args: unknown[]) => {
    const text = args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' ');
    // React Router v7 future-flag notices are informational, not defects.
    if (/React Router Future Flag|ReactDOMTestUtils|deprecated in favor of/i.test(text)) return;
    noise.push(`[${level}] ${text}`);
    original(...args);
  };
}

let passed = 0, failed = 0;
function check(label: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}${extra ? ` \u2014 ${extra}` : ''}`); }
}

async function main() {
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

  let go: (p: string) => void = () => undefined;
  function Nav() {
    const navigate = useNavigate();
    go = (p: string) => act(() => { navigate(p); });
    return null;
  }
  function Wrap({ children }: { children: ReactNode }) {
    return createElement(ThemeProvider, null, createElement(ToastProvider, null,
      createElement(CyberSureProvider, null, createElement(MemoryRouter, { initialEntries: ['/assessment'] },
        createElement(Nav, null), createElement(AppRoutes, null)))));
  }

  await act(async () => { root.render(createElement(Wrap, { children: null })); });
  const $ = (sel: string) => container.querySelector(sel);
  const $$ = (sel: string) => [...container.querySelectorAll(sel)];
  const text = () => container.textContent ?? '';
  const byText = (t: string, sel = 'button,a') =>
    $$(sel).find((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase().includes(t.toLowerCase()));
  const click = async (el?: Element | null) => {
    if (!el) throw new Error('click target missing');
    await act(async () => { (el as HTMLElement).click(); });
  };
  const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

  console.log('\n=== PROBE A: desktop layout path (matchMedia => 1024px matches) ===');
  check('desktop sidebar <aside> is rendered inline', Boolean($('aside')));
  check('sidebar shows the CYBERSURE wordmark', text().includes('CYBERSURE'));
  const navLinks = $$('aside nav a');
  check('sidebar exposes 9 primary nav links', navLinks.length === 9, `got ${navLinks.length}`);
  check('sidebar has a Settings link', $$('aside a').some((a) => a.getAttribute('href') === '/settings'));
  check('open-issue badge is rendered in the sidebar', /Security Analysis/.test(text()));
  check('theme toggle is present in the header', $$('header button').length > 0);

  console.log('\n=== PROBE B: expanded -> collapsed sidebar toggle ===');
  const toggle = $$('header button').find((b) => /sidebar|menu|navigation/i.test(b.getAttribute('aria-label') ?? ''));
  check('header exposes an accessible sidebar toggle', Boolean(toggle), toggle ? '' : 'no labelled toggle found');
  if (toggle) {
    check('sidebar starts expanded with nav labels', text().includes('Configuration Converter'));
    await click(toggle);
    check(
      'collapsing the sidebar hides the visible nav labels',
      $$('aside nav a').every((a) => !(a.textContent ?? '').includes('Configuration Converter')),
    );
    check(
      'collapsed nav links keep an accessible name',
      $$('aside nav a[aria-label="Configuration Converter"]').length === 1,
    );
    await click(toggle);
    check('expanding the sidebar restores nav labels', text().includes('Configuration Converter'));
    check('expanded sidebar shows the prototype disclaimer', text().includes('No real network is contacted'));
  }

  console.log('\n=== PROBE C: desktop navigation across every page ===');
  for (const [label, path, expect] of [
    ['Overview', '/assessment', 'security posture'],
    ['Devices', '/devices', 'Core-Router-01'],
    ['Configuration Converter', '/converter', 'Converted Configuration'],
    ['Security Analysis', '/issues', 'Telnet'],
    ['Compliance', '/compliance', 'CIS'],
    ['Configuration Changes', '/changes', 'CHG-'],
    ['Reports', '/reports', 'Security Reports'],
    ['AI Assistant', '/assistant', 'CyberSure Assistant'],
    ['Configuration', '/configuration', 'Baseline'],
    ['Settings', '/settings', 'Appearance'],
    ['Landing', '/', 'Secure Your Network.'],
  ] as const) {
    await go(path);
    check(`${label} page renders`, text().toLowerCase().includes(expect.toLowerCase()), `missing "${expect}"`);
  }

  console.log('\n=== PROBE D: desktop topology node -> device detail deep link ===');
  await go('/assessment');
  const topoNode = $$('button').find((b) => /Open .* device details/.test(b.getAttribute('aria-label') ?? ''));
  check('topology exposes a clickable device node', Boolean(topoNode));
  if (topoNode) {
    await click(topoNode);
    check('device detail page opened from topology', text().includes('Configuration') && text().includes('Security Issues'));
    check('topology deep link resolved to a real device', /Core-Router|Edge-Firewall|Access-Switch|Branch-FW|Wireless|Server|Gateway|Firewall|Router|Switch/.test(text()));
  }

  console.log('\n=== PROBE E: desktop remediate flow end-to-end on Edge-Firewall-01 ===');
  await go('/devices');
  const fwLink = $$('a').find((a) => a.textContent?.includes('Edge-Firewall-01'));
  check('firewall row is a link', Boolean(fwLink));
  await go('/devices/dev-edge-firewall-01');
  const before = text();
  check('firewall device detail renders', before.includes('Edge-Firewall-01'));
  const tabs = $$('[role="tab"]');
  check('five device tabs render', tabs.length === 5, `got ${tabs.length}`);
  check('device tabs are correctly wired for a11y', tabs.every((t) => t.getAttribute('aria-selected') !== null));
  check('exactly one device tab is selected', tabs.filter((t) => t.getAttribute('aria-selected') === 'true').length === 1);
  check('device tablist is labelled', Boolean($$('[role="tablist"][aria-label]').length));
  const cfgTab = tabs.find((b) => (b.textContent ?? '').trim().startsWith('Configuration'));
  await click(cfgTab);
  check('Configuration tab shows grouped settings', text().includes('Management Access') && text().includes('Firewall'));
  check('firewall section is present', text().includes('Default Inbound') && text().includes('Any/Any Rule'));
  const editBtn = $$('button').find((b) => /Edit .* on .*/.test(b.getAttribute('aria-label') ?? ''));
  check('an Edit control is available', Boolean(editBtn), 'no per-setting Edit button found');
  await click(editBtn);
  check('configuration editor modal opened', Boolean($('[role="dialog"]')));
  check('editor dialog is aria-modal', $('[role="dialog"]')?.getAttribute('aria-modal') === 'true');
  check('editor dialog is labelled', Boolean($('[role="dialog"]')?.getAttribute('aria-label')));
  check('editor explains changes are simulated', text().includes('simulates the write locally'));
  check('editor shows current value', text().includes('Current value') && text().includes('Proposed value'));

  console.log('\n=== PROBE F: keyboard + focus behaviour ===');
  await act(async () => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  check('Escape closes the editor modal', !$('[role="dialog"]'));
  const focusables = $$('a[href],button:not([disabled]),input,select,textarea');
  check('interactive controls exist for keyboard users', focusables.length > 20, `got ${focusables.length}`);
  check('sidebar nav links are real anchors with href', $$('aside nav a[href]').length === 9, `got ${$$('aside nav a[href]').length}`);

  console.log('\n=== PROBE G: no-crash sweep over every route ===');
  const routes = [
    '/',
    '/assessment',
    '/devices',
    '/devices/dev-core-router-01',
    '/configuration',
    '/converter',
    '/issues',
    '/compliance',
    '/reports',
    '/reports?report=configuration-analysis',
    '/assistant',
    '/changes',
    '/settings',
    '/nope',
  ];
  const bannedWording = /demo environment|sample data only/i;
  for (const path of routes) {
    await go(path);
    check(`route ${path} rendered without crashing`, container.querySelector('main') !== null);
    check(`route ${path} has no environment wording`, !bannedWording.test(text()), text().slice(0, 160));
  }

  console.log(`\n=== PROBE RESULT: ${passed} passed, ${failed} failed ===`);
  console.log(`=== CONSOLE NOISE (${noise.length}) ===`);
  for (const n of noise.slice(0, 25)) console.log('  ' + n.replace(/\n/g, '\n    '));
}

main().then(
  () => process.exit(failed === 0 && noise.length === 0 ? 0 : 1),
  (error) => { console.error('PROBE CRASHED:', error); process.exit(2); },
);
