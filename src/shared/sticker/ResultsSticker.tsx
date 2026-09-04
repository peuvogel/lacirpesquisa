import { useRef } from 'react';

import { resolvePublicAssetUrl } from '@/lib/publicAssets';
import { StickerPeel } from './StickerPeel';
import { useStickerRevealed } from './stickerStore';

/**
 * Adesivo da logo LACIR que aparece ao rolar até os resultados e fica colado.
 *
 * Vive numa camada fixa de viewport inteiro, montada pelo AppShell **fora** do
 * wrapper `.lacir-route-enter`: aquele elemento anima `transform`, o que criaria
 * um bloco de contenção e prenderia um `position: fixed` dentro dele.
 *
 * A camada é `pointer-events-none` para não roubar cliques da página; só o
 * adesivo reativa o ponteiro.
 */
export function ResultsSticker() {
  const boundsRef = useRef<HTMLDivElement>(null);
  const revealed = useStickerRevealed();

  if (!revealed) return null;

  return (
    <div
      ref={boundsRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Ancorado à direita e abaixo da faixa dos cards de métrica, para não
          cobrir nenhum número quando a seção de resultados entra em cena. */}
      <div className="pointer-events-auto absolute top-[58%] right-4 sm:right-8">
        <StickerPeel
          imageSrc={resolvePublicAssetUrl(import.meta.env.BASE_URL, 'logo-lacir.png')}
          alt=""
          width={132}
          dragConstraints={boundsRef}
        />
      </div>
    </div>
  );
}
