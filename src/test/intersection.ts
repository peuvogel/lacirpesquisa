import { act } from '@testing-library/react';

import { intersectionObservers } from './setup';

/**
 * Faz todos os elementos observados "entrarem em cena".
 *
 * O stub de IntersectionObserver é inerte de propósito (nada entra em cena por
 * acidente), então quem depende de `useInView` precisa disparar a entrada
 * explicitamente — é o caso do odômetro das métricas, que só conta quando o
 * card fica visível.
 */
export function enterView(): void {
  act(() => {
    for (const observer of intersectionObservers) {
      const entries = observer.elements.map((target) => ({
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      })) as unknown as IntersectionObserverEntry[];
      if (entries.length) observer.callback(entries, observer.instance);
    }
  });
}
