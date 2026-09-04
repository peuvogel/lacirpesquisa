import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom has no real canvas renderer — Chart.js (and the PNG export hook) need
// a getContext()/toDataURL() stub to run under vitest at all. The
// substitution below is deliberately unconditional: every test that uses
// Chart.js already mocks `chart.js` wholesale via vi.hoisted, so this stub
// never needs to draw anything real. Probing the real jsdom method first (as
// a prior version of this file did) is itself the bug — jsdom's
// "not implemented" methods for getContext/toDataURL log to the console and
// return instead of throwing, so the probe call prints the warning before
// any `if` gets to decide whether to stub. Substituting unconditionally, in
// module scope, is the fix.
const proto = HTMLCanvasElement.prototype;
const noop = () => {};
const contextStub = new Proxy({}, { get: () => noop });

// A substituicao continua incondicional (ver acima), mas o stub honra o
// contextId em vez de devolver um objeto truthy para qualquer argumento.
// No browser/jsdom real, getContext() com um id nao suportado ('webgl',
// 'bitmaprenderer', ou um id invalido) devolve null; com o stub antigo,
// qualquer `const ctx = canvas.getContext(...); if (!ctx) { fallback }`
// nunca exercitava o branch de fallback sob teste, porque ctx era sempre
// truthy. Devolver null fora do '2d' preserva o objetivo original
// (nenhum warning, nenhum desenho real) e mantem esse branch testavel.
proto.getContext = ((contextId: string) =>
  contextId === '2d' ? contextStub : null) as unknown as typeof proto.getContext;
proto.toDataURL = (() => 'data:image/png;base64,stub') as typeof proto.toDataURL;

// jsdom nao implementa IntersectionObserver, e `useInView` (motion/react) o
// instancia direto no efeito de montagem — sem isto, qualquer componente que
// observe visibilidade estoura com ReferenceError. O stub e' inerte de
// proposito: ele nunca dispara sozinho, entao nada "entra em cena"
// acidentalmente durante um teste. Quem precisa exercitar o caminho de
// visibilidade pega a instancia em `intersectionObservers` e chama o callback.
export const intersectionObservers: Array<{
  callback: IntersectionObserverCallback;
  instance: IntersectionObserver;
  elements: Element[];
}> = [];

class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Document | Element | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  private readonly elements: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    intersectionObservers.push({ callback, instance: this, elements: this.elements });
  }

  observe(element: Element) {
    this.elements.push(element);
  }

  unobserve(element: Element) {
    const index = this.elements.indexOf(element);
    if (index >= 0) this.elements.splice(index, 1);
  }

  disconnect() {
    this.elements.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
