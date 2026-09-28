import { JSDOM } from 'jsdom';
import { createElement, useEffect, useState } from 'react';

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
  matches: false, media: query, onchange: null,
  addEventListener: () => undefined, removeEventListener: () => undefined,
  addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;
g.matchMedia = dom.window.matchMedia;

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

  function Switcher() {
    const navigate = useNavigate();
    useEffect(() => { navigate('/devices/dev-core-router-01?tab=configuration'); }, [navigate]);
    return createElement(AppRoutes);
  }

  act(() => {
    root.render(
      createElement(ThemeProvider, null, createElement(ToastProvider, null, createElement(CyberSureProvider, null,
        createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Switcher))))),
    );
  });
  const settle = async (ms: number) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
  await settle(80);

  const editButton = Array.from(container.querySelectorAll('button')).find((el) =>
    (el.getAttribute('aria-label') ?? '').includes('Edit Telnet'),
  );
  console.log('edit button:', Boolean(editButton));
  act(() => { editButton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle(80);

  const dialog = container.querySelector('[role="dialog"]');
  console.log('dialog found:', Boolean(dialog));
  const dialogText = dialog?.textContent ?? '';
  console.log('--- dialog text ---');
  console.log(dialogText.replace(/(.{100})/g, '$1\n'));
  console.log('--- checks ---');
  console.log('has "Why this matters":', dialogText.includes('Why this matters'));
  console.log('has "encrypted communication":', dialogText.includes('encrypted communication'));
  console.log('has "Recommended fix":', dialogText.includes('Recommended fix'));
}

main().then(() => process.exit(0));
