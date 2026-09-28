/* Temporary reproduction harness for the reported HTTP 422
 * "No recognised fortinet-fortios configuration statements were found."
 *
 * Drives the REAL ConverterPage (jsdom) against the LIVE FastAPI backend and
 * captures the actual JSON payloads sent to POST /api/v1/conversions.
 */
import { JSDOM } from 'jsdom';
import { createElement, type ReactNode } from 'react';

const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/converter',
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
function check(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
  }
}
function step(title: string) {
  console.log(`\n── ${title}`);
}

const USER_CONFIG = `! Cisco IOS-XE Sample Configuration
hostname Router1
ip domain-name example.com
ip ssh version 2
vlan 10
interface GigabitEthernet0/1
 description Uplink
 ip address 192.168.1.1 255.255.255.0
 no shutdown
`;

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

  /* Capture every JSON payload the page sends, then forward to the LIVE API. */
  const realFetch = globalThis.fetch.bind(globalThis);
  const captured: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    if (init?.body && typeof init.body === 'string' && init.method === 'POST') {
      try {
        captured.push({ url: String(input), body: JSON.parse(init.body) as Record<string, unknown> });
      } catch {
        captured.push({ url: String(input), body: { raw: init.body } });
      }
    }
    return realFetch(input as never, init);
  }) as typeof fetch;

  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  let nav: (path: string) => void = () => undefined;
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
            createElement(
              MemoryRouter,
              { initialEntries: ['/converter'] },
              createElement(Harness),
            ),
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
  const all = (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector));
  const button = (label: string) =>
    all('button').find((element) => (element.textContent ?? '').trim().toLowerCase() === label.toLowerCase());
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

  await settle(900);
  step('Live backend connection');
  check('Backend banner reports connected', text().includes('Conversion service connected'), text().slice(0, 200));

  const fromSelect = all('select').find((s) => s.id === 'converter-from') as HTMLSelectElement | undefined;
  const toSelect = all('select').find((s) => s.id === 'converter-to') as HTMLSelectElement | undefined;
  check('From/To selectors present', Boolean(fromSelect && toSelect));
  const sourceArea = container.querySelector('textarea[aria-label="Source configuration"]') as HTMLTextAreaElement | null;
  check('Source editor present', Boolean(sourceArea));

  /* ------------------------------------------------------------------ */
  step('SCENARIO A · FROM = Cisco IOS XE, TO = Juniper Junos (spec §10)');
  if (fromSelect && toSelect && sourceArea) {
    setSelect(fromSelect, 'cisco-iosxe');
    await settle(250);
    setSelect(toSelect, 'juniper-junos');
    await settle(250);
    setText(sourceArea, USER_CONFIG);
    await settle(300);
    click(button('Convert Configuration'), 'Convert Configuration');
    await settle(3000);

    const last = captured[captured.length - 1];
    console.log('    payload A:', JSON.stringify(last?.body ?? null));
    check('Request URL is the live backend', last?.url === 'http://localhost:8000/api/v1/conversions', last?.url ?? 'none');
    check('source_platform is cisco-iosxe', last?.body?.source_platform === 'cisco-iosxe', String(last?.body?.source_platform));
    check('target_platform is juniper-junos', last?.body?.target_platform === 'juniper-junos', String(last?.body?.target_platform));
    check('FROM selector still shows cisco-iosxe', fromSelect.value === 'cisco-iosxe', fromSelect.value);
    check(
      'Conversion produced output (no 422)',
      /set system host-name Router1|CONVERSION SUCCESSFUL|REQUIRES REVIEW|PARTIAL CONVERSION/.test(text()),
      text().replace(/\s+/g, ' ').slice(0, 300),
    );
  }

  /* ------------------------------------------------------------------ */
  step('SCENARIO B · stale FROM after sample chip → 422 now names the mismatch');
  if (fromSelect && toSelect && sourceArea) {
    const fortigateChip = all('button').find((b) => (b.textContent ?? '').includes('FortiGate edge'));
    check('FortiGate demo chip found', Boolean(fortigateChip));
    click(fortigateChip, 'FortiGate edge chip');
    await settle(400);
    check('Chip switches FROM to fortinet-fortios (now announced in toast)', fromSelect.value === 'fortinet-fortios', fromSelect.value);

    // The user then pastes / uploads their Cisco IOS-XE configuration.
    setText(sourceArea, USER_CONFIG);
    await settle(300);
    click(button('Convert Configuration'), 'Convert Configuration (B)');
    await settle(3000);

    const last = captured[captured.length - 1];
    console.log('    payload B:', JSON.stringify(last?.body ?? null));
    check('Payload B carries the explicit (stale) FROM selection', last?.body?.source_platform === 'fortinet-fortios', String(last?.body?.source_platform));
    check(
      '422 names the likely platform (spec §9)',
      text().includes('Configuration appears to use Cisco IOS') && text().includes('Fortinet FortiOS was selected as the source platform'),
      text().replace(/\s+/g, ' ').slice(0, 500),
    );
    check('The 422 is shown, not hidden', /HTTP 422/.test(text()), text().replace(/\s+/g, ' ').slice(0, 300));
  }

  /* ------------------------------------------------------------------ */
  step('SCENARIO C · operator re-selects FROM = Cisco IOS XE → conversion succeeds');
  if (fromSelect && toSelect && sourceArea) {
    setSelect(fromSelect, 'cisco-iosxe');
    await settle(300);
    click(button('Convert Configuration'), 'Convert Configuration (C)');
    await settle(3000);
    const last = captured[captured.length - 1];
    console.log('    payload C:', JSON.stringify(last?.body ?? null));
    check('Payload C source_platform is cisco-iosxe', last?.body?.source_platform === 'cisco-iosxe', String(last?.body?.source_platform));
    check(
      'Conversion succeeds after re-selecting FROM (spec §10)',
      /set system host-name Router1/.test(text()),
      text().replace(/\s+/g, ' ').slice(0, 300),
    );
  }

  console.log(`\nREPRO RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('HARNESS ERROR', error);
  process.exit(2);
});
