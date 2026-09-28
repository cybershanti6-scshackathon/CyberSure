import { JSDOM } from 'jsdom';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.getComputedStyle = dom.window.getComputedStyle;
g.IS_REACT_ACT_ENVIRONMENT = true;

function Demo() {
  const [value, setValue] = useState('');
  return (
    <div>
      <input aria-label="plain" value={value} onChange={(event) => setValue(event.target.value)} />
      <p data-testid="out">{value || 'EMPTY'}</p>
    </div>
  );
}

const container = dom.window.document.getElementById('root')!;
const root = createRoot(container);
act(() => {
  root.render(<Demo />);
});

const settle = async (ms: number) => {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};

async function main() {
  await settle(20);
  const input = container.querySelector<HTMLInputElement>('input[aria-label="plain"]')!;
  const out = () => container.querySelector('[data-testid="out"]')!.textContent;
  const protoSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;

  console.log('"oninput" in document:', 'oninput' in dom.window.document);

  act(() => {
    protoSetter.call(input, 'hello');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await settle(30);
  console.log('after proto setter + input:', out());

  act(() => {
    input.value = 'direct';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await settle(30);
  console.log('after direct + input:', out());

  act(() => {
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle(30);
  console.log('after change only:', out());
}

main().then(() => process.exit(0));
