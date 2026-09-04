import { useEffect, useId, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';

import { cn } from '@/lib/utils';

export interface StickerPeelProps {
  imageSrc: string;
  alt?: string;
  /** Largura do adesivo em px. */
  width?: number;
  /** Rotação de repouso da arte, em graus. */
  rotate?: number;
  /** Quanto do adesivo descola no hover (0-100). */
  peelBackHoverPct?: number;
  /** Quanto descola enquanto o ponteiro está pressionado (0-100). */
  peelBackActivePct?: number;
  shadowIntensity?: number;
  lightingIntensity?: number;
  /** Elemento que limita o arrasto. */
  dragConstraints?: React.RefObject<HTMLElement | null>;
  /**
   * Onde o adesivo nasce, em deslocamento a partir do ponto de repouso. Lido
   * só na montagem — depois quem manda é o arrasto.
   */
  initialPosition?: { x: number; y: number };
  /** Chamado ao soltar o adesivo, com a posição final. */
  onPositionChange?: (position: { x: number; y: number }) => void;
  /** Falso quando o adesivo já entrou antes: aparece direto onde parou. */
  animateEntrance?: boolean;
  className?: string;
}

/**
 * Adesivo que descola no hover e pode ser arrastado e recolado.
 *
 * Porte do StickerPeel do React Bits para `motion` (o projeto não usa GSAP): o
 * descolar é puro CSS (clip-path + filtros SVG), e o que o GSAP fazia no
 * original — arrastar com inércia, inclinar conforme a velocidade e mover a luz
 * especular — sai de `drag`, `useVelocity` e um handler de mousemove.
 */
export function StickerPeel({
  imageSrc,
  alt = '',
  width = 132,
  rotate = 8,
  peelBackHoverPct = 22,
  peelBackActivePct = 42,
  shadowIntensity = 0.6,
  lightingIntensity = 0.1,
  dragConstraints,
  initialPosition,
  onPositionChange,
  animateEntrance = true,
  className,
}: StickerPeelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointLightRef = useRef<SVGFEPointLightElement>(null);
  const pointLightFlippedRef = useRef<SVGFEPointLightElement>(null);
  const reduceMotion = useReducedMotion();

  // Os filtros são referenciados por id; com dois adesivos no documento, ids
  // fixos fariam o segundo herdar em silêncio os filtros do primeiro. O
  // `useId` do React traz caracteres que não passam num `url(#…)`, daí o corte.
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const lightFilterId = `lacir-sticker-light-${instanceId}`;
  const lightFlippedFilterId = `lacir-sticker-light-flipped-${instanceId}`;
  const shadowFilterId = `lacir-sticker-shadow-${instanceId}`;
  const backFilterId = `lacir-sticker-back-${instanceId}`;

  const startX = initialPosition?.x ?? 0;
  const startY = initialPosition?.y ?? 0;
  const x = useMotionValue(startX);
  const y = useMotionValue(startY);
  // Inclina para o lado do movimento enquanto arrasta e volta sozinho ao parar,
  // porque a velocidade cai a zero — dispensa handler de fim de arrasto.
  const xVelocity = useVelocity(x);
  const tilt = useTransform(xVelocity, [-1400, 1400], [-16, 16], { clamp: true });
  const dragRotate = useSpring(tilt, { stiffness: 220, damping: 28, mass: 0.6 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateLight(event: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      pointLightRef.current?.setAttribute('x', String(localX));
      pointLightRef.current?.setAttribute('y', String(localY));
      pointLightFlippedRef.current?.setAttribute('x', String(localX));
      pointLightFlippedRef.current?.setAttribute('y', String(rect.height - localY));
    }

    container.addEventListener('mousemove', updateLight);
    return () => container.removeEventListener('mousemove', updateLight);
  }, []);

  return (
    <motion.div
      className={cn('lacir-sticker', className)}
      style={
        {
          x,
          y,
          rotate: dragRotate,
          '--lacir-sticker-width': `${width}px`,
          '--lacir-sticker-rotate': `${rotate}deg`,
          '--lacir-sticker-peel-hover': `${peelBackHoverPct}%`,
          '--lacir-sticker-peel-active': `${peelBackActivePct}%`,
          '--lacir-sticker-shadow-opacity': shadowIntensity,
          '--lacir-sticker-filter-light': `url(#${lightFilterId})`,
          '--lacir-sticker-filter-light-flipped': `url(#${lightFlippedFilterId})`,
          '--lacir-sticker-filter-shadow': `url(#${shadowFilterId})`,
          '--lacir-sticker-filter-back': `url(#${backFilterId})`,
        } as unknown as React.CSSProperties
      }
      drag
      dragConstraints={dragConstraints}
      // Encostar na borda cede um pouco e volta com mola; um arremesso bate no
      // limite e retorna, em vez de grudar nele.
      dragElastic={0.16}
      dragMomentum={!reduceMotion}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 26 }}
      whileDrag={{ scale: 1.06, cursor: 'grabbing' }}
      onDragEnd={() => onPositionChange?.({ x: x.get(), y: y.get() })}
      // A entrada precisa terminar na posição restaurada: `animate` escreve
      // nos mesmos motion values de x/y, então fixar 0 aqui desfaria o que
      // veio do armazenamento.
      initial={
        reduceMotion || !animateEntrance
          ? false
          : { opacity: 0, scale: 0.92, x: startX, y: startY - 16 }
      }
      animate={{ opacity: 1, scale: 1, x: startX, y: startY, rotate: 0 }}
      // Tween curto em vez de mola: a mola ficava assentando (e o overshoot
      // dava a impressão de arrasto). Aqui o adesivo aparece e acabou.
      transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
    >
      <svg width="0" height="0" aria-hidden focusable="false">
        <defs>
          <filter id={lightFilterId}>
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feSpecularLighting
              result="spec"
              in="blur"
              specularExponent="100"
              specularConstant={lightingIntensity}
              lightingColor="white"
            >
              <fePointLight ref={pointLightRef} x="100" y="100" z="300" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceGraphic" result="lit" />
            <feComposite in="lit" in2="SourceAlpha" operator="in" />
          </filter>

          <filter id={lightFlippedFilterId}>
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feSpecularLighting
              result="spec"
              in="blur"
              specularExponent="100"
              specularConstant={lightingIntensity * 7}
              lightingColor="white"
            >
              <fePointLight ref={pointLightFlippedRef} x="100" y="100" z="300" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceGraphic" result="lit" />
            <feComposite in="lit" in2="SourceAlpha" operator="in" />
          </filter>

          <filter id={shadowFilterId}>
            <feDropShadow
              dx="2"
              dy="4"
              stdDeviation={3 * shadowIntensity}
              floodColor="black"
              floodOpacity={shadowIntensity}
            />
          </filter>

          {/* Verso do adesivo: silhueta preenchida de cinza. */}
          <filter id={backFilterId}>
            <feOffset dx="0" dy="0" in="SourceAlpha" result="shape" />
            <feFlood floodColor="rgb(179,179,179)" result="flood" />
            <feComposite operator="in" in="flood" in2="shape" />
          </filter>
        </defs>
      </svg>

      <div ref={containerRef} className="lacir-sticker-container">
        <div className="lacir-sticker-main">
          <div className="lacir-sticker-lighting">
            <img
              src={imageSrc}
              alt={alt}
              className="lacir-sticker-image"
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>

        <div className="lacir-sticker-flap" aria-hidden>
          <div className="lacir-sticker-flap-lighting">
            <img
              src={imageSrc}
              alt=""
              className="lacir-sticker-flap-image"
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
