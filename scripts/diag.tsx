import { JSDOM } from 'jsdom';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppRoutes } from '../src/App';
import { CyberSureProvider } from '../src/lib/store';
import { ThemeProvider } from '../src/hooks/useTheme';
import { ToastProvider } from '../src/components/ui/Toast';

const dom = new JSDOM('<!doctype html><html class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id: number) => dom.window.clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = ((q: string) => ({
  matches: false, media: q, onchange: null,
  addEventListener: () => undefined, removeEventListener: () => undefined,
  addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;
g.matchMedia = dom.window.matchMedia;
g.localStorage = dom.window.localStorage;

function Switcher({ path }: { path: string }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(path); }, [navigate, path]);
  return <AppRoutes />;
}

function Harness() {
  const [path, setPath] = useState('/devices');
  return <Switcher path={path} />;
}

const container = dom.window.document.getElementById('root')!;
const root = createRoot(container);
act(() => {
  root.render(
    <ThemeProvider>
      <ToastProvider>
        <CyberSureProvider>
          <MemoryRouter initialEntries={['/devices']}>
            <Harness />
          </MemoryRouter>
        </CyberSureProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
});

const settle = async (ms: number) => {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};

async function main() {
  await settle(100);
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Search name, vendor, IP, model…"]');
  console.log('search input found:', Boolean(input));
  console.log('own value descriptor present:', Boolean(input && Object.getOwnPropertyDescriptor(input, 'value')));
  console.log('value before:', input?.value);

  if (input) {
    const protoSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
    const rowCount = () => container.querySelectorAll('tbody tr').length;
    const find = () => container.querySelector<HTMLInputElement>('input[aria-label="Search name, vendor, IP, model…"]');

    console.log('  isConnected:', input.isConnected);
    console.log('  same node after re-render:', find() === input);
    console.log('  has internal instance key:', Object.getOwnPropertyNames(input).filter((k) => k.startsWith('__react')).join(','));
    console.log('  _valueTracker present:', Boolean((input as unknown as Record<string, unknown>)._valueTracker));

    protoSetter.call(input, 'Fortinet');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await settle(60);
    console.log('  rows after filter:', rowCount());
    console.log('  search input value now:', find()?.value);
    console.log('  same node after filter:', find() === input);
    console.log('  first row text:', container.querySelector('tbody tr')?.textContent?.slice(0, 60));
  }

  // Theme
  const themeButton = Array.from(container.querySelectorAll('button')).find((el) =>
    (el.getAttribute('aria-label') ?? '').startsWith('Theme:'),
  );
  console.log('\ntheme button found:', Boolean(themeButton), themeButton?.getAttribute('aria-label'));
  console.log('html class before:', dom.window.document.documentElement.className);
  if (themeButton) {
    act(() => {
      themeButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await settle(60);
    console.log('html class after:', dom.window.document.documentElement.className);
    console.log('localStorage:', dom.window.localStorage.getItem('cybersure.theme'));
  }
}

main().then(() => process.exit(0));
