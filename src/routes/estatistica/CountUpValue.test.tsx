import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { enterView } from '@/test/intersection';
import { CountUpValue } from './CountUpValue';

describe('CountUpValue', () => {
  it('exposes the exact formatted value on the first paint', () => {
    render(<CountUpValue value="6,042" />);
    expect(screen.getByText('6,042')).toBeInTheDocument();
  });

  it('hides the rolling odometer from assistive tech', () => {
    const { container } = render(<CountUpValue value="6,042" />);
    enterView();

    const odometer = container.querySelector('.lacir-count-value');
    expect(odometer).not.toBeNull();
    expect(odometer).toHaveAttribute('aria-hidden');
    // Um strip por dígito de "6042", separadores ficam estáticos.
    expect(container.querySelectorAll('.lacir-count-digit')).toHaveLength(4);
  });

  it('animates every numeric run of a composite value', () => {
    const { container } = render(<CountUpValue value="-1,35 a -0,85" />);
    enterView();

    expect(screen.getByText('-1,35 a -0,85')).toBeInTheDocument();
    expect(container.querySelectorAll('.lacir-count-digit')).toHaveLength(6);
  });

  it('keeps the thousands separator out of the rolling digits', () => {
    const { container } = render(<CountUpValue value="1.234,568" />);
    enterView();
    expect(container.querySelectorAll('.lacir-count-digit')).toHaveLength(7);
  });

  it('renders plain text when the value carries no number', () => {
    const { container } = render(<CountUpValue value="Pearson" />);
    enterView();

    expect(screen.getByText('Pearson')).toBeInTheDocument();
    expect(container.querySelector('.lacir-count-value')).toBeNull();
    expect(container.querySelector('.sr-only')).toBeNull();
  });

  it('keeps the odometer still until the card enters the viewport', () => {
    // O resultado monta junto com uma rolagem suave: contar fora da tela
    // entregaria o número já parado.
    const { container } = render(<CountUpValue value="6,042" />);
    expect(container.querySelector('.lacir-count-value')).toBeNull();

    enterView();
    expect(container.querySelector('.lacir-count-value')).not.toBeNull();
  });

  it('drives the spring with a duration the animation library reads in seconds', () => {
    // Guarda de unidade: `duration` é lida em milissegundos e `visualDuration`
    // em segundos. Trocar uma pela outra clampa a contagem a 10 ms e ela some.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'CountUpValue.tsx'),
      'utf-8',
    );
    expect(source).toContain('visualDuration: duration');
    expect(source).not.toMatch(/useSpring\([^)]*\{\s*duration\s*,/);
  });
});
