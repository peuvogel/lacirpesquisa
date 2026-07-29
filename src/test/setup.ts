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

proto.getContext = (() => contextStub) as unknown as typeof proto.getContext;
proto.toDataURL = (() => 'data:image/png;base64,stub') as typeof proto.toDataURL;
