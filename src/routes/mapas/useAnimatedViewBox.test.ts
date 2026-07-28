import { describe, expect, it } from 'vitest';
import { paddedViewBoxFromBBox, parseViewBox } from './useAnimatedViewBox';

describe('paddedViewBoxFromBBox', () => {
  it('keeps the UF center and produces a smaller frame than full Brazil', () => {
    // Rough BA bbox in viewBox space (post scale(0.0001,-0.0001))
    const ba = { x: -45.5, y: -18.2, width: 7.2, height: 9.1 };
    const zoomed = parseViewBox(paddedViewBoxFromBBox(ba, 0.38, 3.2));
    const brazil = parseViewBox('-73.9833 -5.2718 39.1806 39.0157');

    expect(zoomed.w).toBeLessThan(brazil.w * 0.7);
    expect(zoomed.h).toBeLessThan(brazil.h * 0.7);

    const zcx = zoomed.x + zoomed.w / 2;
    const zcy = zoomed.y + zoomed.h / 2;
    expect(zcx).toBeCloseTo(ba.x + ba.width / 2, 1);
    expect(zcy).toBeCloseTo(ba.y + ba.height / 2, 1);
  });
});
