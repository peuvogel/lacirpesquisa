import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import viteConfig from '../../vite.config';

describe('Vite application entry discovery', () => {
  it('scans only the real SPA entry instead of archived HTML exports', () => {
    expect(viteConfig).toMatchObject({
      optimizeDeps: { entries: ['index.html'] },
    });
  });

  it('scopes the favicon to Vite BASE_URL for project Pages builds', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('href="%BASE_URL%logo-lacir.png"');
    expect(html).not.toContain('href="/logo-lacir.png"');
  });
});
