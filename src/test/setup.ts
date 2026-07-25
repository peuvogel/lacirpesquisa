import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom has no real canvas renderer — Chart.js (and the PNG export hook) need
// a getContext()/toDataURL() stub to run under vitest at all. Guard both so a
// future real jsdom canvas backend isn't silently overridden.
const proto = HTMLCanvasElement.prototype;

const needsGetContextStub = (() => {
  try {
    return !proto.getContext.call(document.createElement('canvas'), '2d');
  } catch {
    return true;
  }
})();

if (needsGetContextStub) {
  const noop = () => {};
  const contextStub = new Proxy(
    {},
    {
      get: () => noop,
    },
  );
  proto.getContext = (() => contextStub) as unknown as typeof proto.getContext;
}

const needsToDataURLStub = (() => {
  try {
    const result = proto.toDataURL.call(document.createElement('canvas'));
    return typeof result !== 'string' || !result.startsWith('data:');
  } catch {
    return true;
  }
})();

if (needsToDataURLStub) {
  proto.toDataURL = (() => 'data:image/png;base64,stub') as typeof proto.toDataURL;
}
