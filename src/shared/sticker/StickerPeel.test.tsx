import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { StickerPeel } from './StickerPeel';

function translateY(element: HTMLElement): number {
  const match = /translateY\((-?[\d.]+)px\)/.exec(element.style.transform);
  return match ? Number(match[1]) : Number.NaN;
}

describe('StickerPeel', () => {
  it('starts at the restored position instead of snapping back to the resting spot', async () => {
    const { container } = render(
      <StickerPeel imageSrc="/logo-lacir.png" initialPosition={{ x: 120, y: -40 }} />,
    );
    const sticker = container.querySelector('.lacir-sticker') as HTMLElement;

    // A entrada cai de cima, mas sobre a posição salva — não sobre a origem.
    expect(sticker.style.transform).toContain('translateX(120px)');
    await waitFor(() => {
      expect(translateY(sticker)).toBeCloseTo(-40, 0);
    });
  });

  it('skips the entrance when the sticker is already stuck', () => {
    const { container } = render(
      <StickerPeel
        imageSrc="/logo-lacir.png"
        initialPosition={{ x: 120, y: -40 }}
        animateEntrance={false}
      />,
    );
    const sticker = container.querySelector('.lacir-sticker') as HTMLElement;

    // Só o deslocamento salvo: nenhuma queda, escala ou giro de entrada.
    expect(sticker.style.transform).toBe('translateX(120px) translateY(-40px)');
    expect(translateY(sticker)).toBe(-40);
  });

  it('scopes its SVG filters per instance so a second sticker cannot inherit the first', () => {
    const { container } = render(
      <>
        <StickerPeel imageSrc="/logo-lacir.png" />
        <StickerPeel imageSrc="/logo-lacir.png" lightingIntensity={0.5} />
      </>,
    );

    const filterIds = [...container.querySelectorAll('filter')].map((filter) => filter.id);
    expect(filterIds).toHaveLength(8);
    expect(new Set(filterIds).size).toBe(8);

    // Cada raiz aponta para os filtros da própria instância.
    for (const sticker of container.querySelectorAll<HTMLElement>('.lacir-sticker')) {
      const shadow = sticker.style.getPropertyValue('--lacir-sticker-filter-shadow');
      const id = /url\(#(.+)\)/.exec(shadow)?.[1];
      expect(id).toBeTruthy();
      expect(sticker.querySelector(`filter[id="${id}"]`)).not.toBeNull();
    }
  });
});
