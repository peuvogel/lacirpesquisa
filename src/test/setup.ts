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
