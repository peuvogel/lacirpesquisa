import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('Vite application entry discovery', () => {
  it('scans only the real SPA entry instead of archived HTML exports', () => {
    expect(viteConfig).toMatchObject({
      optimizeDeps: { entries: ['index.html'] },
    });
  });
});
