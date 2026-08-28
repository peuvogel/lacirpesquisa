import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const themeCss = stripComments(readFileSync(join(__dirname, 'theme.css'), 'utf-8'));
const indexCss = stripComments(readFileSync(join(__dirname, '..', 'index.css'), 'utf-8'));
const combinedCss = `${themeCss}\n${indexCss}`;

const REQUIRED_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-elevated',
  '--color-accent',
  '--color-accent-soft',
  '--color-accent-border',
  '--color-text',
  '--color-text-muted',
  '--color-destructive',
  '--color-warning',
  '--color-border',
  '--color-border-strong',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--font-sans',
  '--font-mono',
  '--text-label',
  '--text-body',
  '--text-heading',
  '--text-display',
  '--text-data',
];

const FORBIDDEN_HEXES = ['#8b5cf6', '#22c55e'];

describe('LACIR theme token contract', () => {
  it.each(REQUIRED_TOKENS)('declares required token %s in src/app/theme.css', (token) => {
    expect(themeCss.includes(`${token}:`)).toBe(true);
  });

  it('declares the locked green accent value #209978', () => {
    expect(themeCss.toLowerCase()).toContain('#209978');
  });

  it.each(FORBIDDEN_HEXES)('never declares the forbidden legacy value %s (comments stripped)', (hex) => {
    expect(combinedCss.toLowerCase()).not.toContain(hex);
  });

  it('declares exactly the two first-party D-15 accent classes', () => {
    expect(themeCss).toContain('.lacir-header-grain');
    expect(themeCss).toContain('.lacir-route-enter');
  });

  it('guards the route-entry animation with prefers-reduced-motion', () => {
    expect(combinedCss).toContain('prefers-reduced-motion');
  });

  it('uses the approved shared system font stack and never clips chart cards', () => {
    expect(themeCss).toContain(
      "--font-sans: -apple-system, BlinkMacSystemFont, 'Geist Variable', 'Segoe UI', sans-serif;",
    );
    expect(themeCss).not.toMatch(/\.lacir-chart-card\s*\{[^}]*overflow:\s*hidden/s);
  });

  it('never declares a font-weight other than 400 or 700 in the token layer', () => {
    const matches = [...combinedCss.matchAll(/font-weight\s*:\s*([^;]+);/gi)];
    const disallowed = matches
      .map((match) => match[1].trim())
      .filter((value) => value !== '400' && value !== '700' && value !== 'normal' && value !== 'bold');
    expect(disallowed).toEqual([]);
  });
});
