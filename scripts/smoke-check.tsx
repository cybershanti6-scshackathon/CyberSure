/* Runtime smoke test: drive the real DOM in jsdom and assert the two new
 * behaviours plus the removal of the environment wording. */
import { JSDOM } from 'jsdom';
import { createElement, type ReactNode } from 'react';

const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
for (const key of [
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'HTMLAnchorElement',
  'Element',
  'Node',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'Blob',
  'URL',
]) {
  g[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
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
function check(label: string, ok: boolean, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
  }
}

async function main() {
  const [{ act }, { createRoot }, router, app, store, theme, toast] = await Promise.all([
    import('react-dom/test-utils'),
    import('react-dom/client'),
    import('react-router-dom'),
    import('../src/App'),
    import('../src/lib/store'),
    import('../src/hooks/useTheme'),
    import('../src/components/ui/Toast'),
  ]);

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  let nav: (p: string) => void = () => undefined;
  function NavCapture() {
    nav = router.useNavigate();
    return null;
  }
  function Harness() {
    return createElement('div', null, createElement(NavCapture), createElement(app.AppRoutes));
  }
  act(() => {
    root.render(
      createElement(
        theme.ThemeProvider,
        null,
        createElement(
          toast.ToastProvider,
          null,
          createElement(
            store.CyberSureProvider,
            null,
            createElement(router.MemoryRouter, { initialEntries: ['/'] }, createElement(Harness)),
          ),
        ),
      ) as ReactNode,
    );
  });

  const settle = async (ms = 0) => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  };
  const go = (p: string) => act(() => nav(p));
  const text = () => container.textContent ?? '';
  const all = (sel: string) => Array.from(container.querySelectorAll<HTMLElement>(sel));
  const click = (el?: Element | null) => {
    if (!el) throw new Error('missing click target');
    act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })));
  };

  await settle(200);

  console.log('\n=== A · Landing page: no environment wording + animation present ===');
  check('landing renders', text().includes('Secure Your Network.'));
  check('no "Demo environment" on landing', !/demo environment/i.test(text()));
  check('no "sample data only" on landing', !/sample data only/i.test(text()));
  const heroSvg = container.querySelector('svg[aria-label*="Animated network path"]');
  check('hero network animation SVG rendered', Boolean(heroSvg));
  check('animation markup uses animateMotion', Boolean(container.innerHTML.includes('animateMotion')));
  check('animation has link-flow elements', container.querySelectorAll('[data-cybersure-flow]').length > 0);
  check('animation has node pulse rings', container.querySelectorAll('[data-cybersure-pulse]').length >= 7);
  check('animation markup uses a scan sweep', container.innerHTML.includes('cybersure-sweep-x'));
  check('reduced-motion fallback present', container.innerHTML.includes('cybersure-anim'));
  // Existing hero content untouched.
  check('hero left column unchanged', text().includes('Simplify Your Configuration.'));
  check('Start Assessment still present', all('button').some((b) => (b.textContent ?? '').trim() === 'Start Assessment'));
  check('Explore Features still present', all('button').some((b) => (b.textContent ?? '').includes('Explore Features')));
  check('nav links unchanged', text().includes('How It Works') && text().includes('Features') && text().includes('About'));

  console.log('\n=== B · Animation works in both themes ===');
  const svgIn = () => Boolean(container.querySelector('svg[aria-label*="Animated network path"]'));
  check('dark mode renders the animation', svgIn());
  dom.window.document.documentElement.classList.remove('dark');
  dom.window.document.documentElement.classList.add('light');
  act(() => {
    root.render(
      createElement(
        theme.ThemeProvider,
        null,
        createElement(
          toast.ToastProvider,
          null,
          createElement(
            store.CyberSureProvider,
            null,
            createElement(router.MemoryRouter, { initialEntries: ['/'] }, createElement(Harness)),
          ),
        ),
      ) as ReactNode,
    );
  });
  await settle(200);
  check('light mode renders the animation', svgIn());

  console.log('\n=== C · No environment wording anywhere in the app ===');
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
  ];
  for (const path of routes) {
    await go(path);
    await settle(120);
    check(`${path}: no "Demo Environment"`, !/demo environment/i.test(text()));
    check(`${path}: no "sample data only"`, !/sample data only/i.test(text()));
  }

  console.log('\n=== D · Settings: Demo Environment wording gone, options kept ===');
  await go('/settings');
  await settle(150);
  const settingsText = text();
  check('settings has no "Demo environment" heading', !settingsText.includes('Demo environment'));
  check('settings has no "Reset Demo Data" label', !settingsText.includes('Reset Demo Data'));
  check('settings renamed the section', settingsText.includes('Estate data'));
  check('Appearance kept', settingsText.includes('Appearance'));
  check('Notification toggles kept', settingsText.includes('Security issue alerts') && settingsText.includes('Report generation alerts'));
  check('Reset control still present', all('button').some((b) => /Reset Data/i.test(b.textContent ?? '')));
  check('Prototype scope kept', settingsText.includes('Prototype scope'));
  check('Theme options kept', settingsText.includes('Dark') && settingsText.includes('Light') && settingsText.includes('System'));

  console.log('\n=== E · Configuration report downloads as JSON ===');
  // Generate the report first, exactly as a user would from the library.
  await go('/reports');
  await settle(200);
  const genButtons = all('button').filter((b) => /^(Generate|Regenerate)$/.test((b.textContent ?? '').trim()));
  check('library shows four report cards', genButtons.length === 4, `found ${genButtons.length}`);
  click(genButtons[1]);
  await settle(300);

  const detailHeader = Array.from(container.querySelectorAll('header')).find((el) =>
    (el.textContent ?? '').includes('Configuration Analysis Report'),
  );
  check('configuration report detail open', Boolean(detailHeader));
  const headerText = detailHeader?.textContent ?? '';
  check('Download JSON offered', headerText.includes('Download JSON'), headerText.slice(0, 200));
  check('no PDF download in the configuration report', !headerText.includes('Download PDF'), headerText.slice(0, 200));
  check('no DOC/DOCX/TXT download offered', !/Download (DOC|DOCX|TXT)/i.test(text()));

  // Capture the download.
  const captured: string[] = [];
  let filename = '';
  const winURL = dom.window.URL as unknown as Record<string, unknown>;
  winURL.createObjectURL = (blob: Blob) => {
    void blob.text().then((t) => captured.push(t));
    return 'blob:x';
  };
  winURL.revokeObjectURL = () => undefined;
  const origClick = dom.window.HTMLAnchorElement.prototype.click;
  dom.window.HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
    if (this.download) filename = this.download;
  };
  const jsonBtn = Array.from((detailHeader ?? container).querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === 'Download JSON',
  );
  check('Download JSON button found in the report header', Boolean(jsonBtn));
  click(jsonBtn);
  await settle(400);
  dom.window.HTMLAnchorElement.prototype.click = origClick;

  check('filename is configuration-report.json', filename === 'configuration-report.json', filename);
  const payloadText = captured[0] ?? '';
  check('file has content', payloadText.length > 0, `len=${payloadText.length}`);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(payloadText);
    check('file is valid JSON', true);
  } catch (error) {
    check('file is valid JSON', false, String(error));
  }
  if (parsed) {
    const keys = Object.keys(parsed);
    console.log(`    top-level keys: ${keys.join(', ')}`);
    check('valid JSON structure', Array.isArray(parsed.configuration) && Array.isArray(parsed.findings) && Array.isArray(parsed.changes) && Boolean(parsed.report));
    const devices = parsed.configuration as Array<{ name: string; settings: unknown[] }>;
    check('uses the existing 12 devices', devices.length === 12, String(devices.length));
    check('device names unchanged', devices[0]?.name === 'Core-Router-01' && devices[1]?.name === 'Edge-Firewall-01');
    check('no invented fields in configuration block', devices.every((d) => 'name' in d && 'settings' in d));
  }

  console.log('\n=== F · Other report types still export as PDF ===');
  await go('/reports?report=security-assessment');
  await settle(200);
  check('security assessment offers PDF', all('button').some((b) => (b.textContent ?? '').trim() === 'Download PDF'));

  console.log(`\n${'='.repeat(56)}\n  ${passed} passed, ${failed} failed\n${'='.repeat(56)}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE CRASHED:', e);
  process.exit(1);
});
