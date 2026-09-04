import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

interface Particle {
  x: number;
  y: number;
  /** Onde a partícula estava quando a reunião começou. */
  startX: number;
  startY: number;
  /** O pixel da letra a que ela pertence. */
  targetX: number;
  targetY: number;
  size: number;
  /** Sorteio fixo por partícula: direção do espalhar e atraso da volta. */
  seed: number;
  depth: number;
  delay: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * O efeito é acabamento, nunca requisito: sem canvas 2d ou sem ResizeObserver
 * o título continua sendo um título. O ambiente de teste é exatamente esse
 * caso (não há ResizeObserver no jsdom).
 */
function particleTextSupported(): boolean {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return false;
  try {
    return Boolean(window.document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
}

/**
 * O canvas só entende px, mas `fontSize` pode chegar em qualquer unidade CSS
 * (clamp(), rem, vw) — um <span> escondido dentro do próprio container serve
 * de régua, já com o contexto de fonte certo.
 */
function resolveFontSize(
  value: number | string,
  container: HTMLElement,
  fontWeight: number,
  fontFamily: string,
): number {
  if (typeof value === 'number') return value;

  const probe = document.createElement('span');
  probe.textContent = 'M';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.fontSize = value;
  probe.style.fontWeight = String(fontWeight);
  probe.style.fontFamily = fontFamily;
  container.appendChild(probe);
  const size = Number.parseFloat(window.getComputedStyle(probe).fontSize) || 96;
  probe.remove();
  return size;
}

/** Amostrar antes de a fonte carregar desenharia as letras do fallback. */
async function waitForFont(font: string): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await document.fonts.load(font);
    await document.fonts.ready;
  } catch {
    // Fonte indisponível: o desenho sai com o que o sistema tiver.
  }
}

export interface ParticleTextProps {
  /** O texto amostrado — e também o que vai para a árvore de acessibilidade. */
  text: string;
  /** Lado de cada partícula, em px de CSS. */
  particleSize?: number;
  /** Passo da amostragem dos glifos: quanto menor, mais partículas. */
  density?: number;
  color?: string;
  /** De quão longe as partículas partem antes de formar o texto. */
  scatter?: number;
  gatherDuration?: number;
  /** Atraso máximo por partícula antes de ela voltar, em ms. */
  stagger?: number;
  /** Força e alcance do empurrão do ponteiro. */
  pointerRepel?: number;
  repelRadius?: number;
  /** Respiração de repouso, depois que o texto já está formado. */
  idleDrift?: number;
  /** O que repete o espalhar-e-reformar depois da primeira vez. */
  trigger?: 'mount' | 'hover' | 'click';
  /**
   * Falso quando o texto já se formou antes: as partículas nascem no lugar e
   * só respiram, sem repetir a entrada.
   */
  animateEntrance?: boolean;
  fontSize?: number | string;
  fontWeight?: number;
  glow?: boolean;
  className?: string;
}

/**
 * Título que se junta a partir de partículas espalhadas.
 *
 * Porte do ParticleText do React Bits: as letras são desenhadas num canvas
 * fora de tela, viram uma lista de pixels opacos, e cada pixel ganha uma
 * partícula que parte de longe e converge para o seu lugar. O texto de
 * verdade continua na árvore — só fica visualmente escondido enquanto as
 * partículas conseguem desenhá-lo.
 */
export function ParticleText({
  text,
  particleSize = 2,
  density = 4,
  color = '#ffffff',
  scatter = 180,
  gatherDuration = 1600,
  stagger = 420,
  pointerRepel = 40,
  repelRadius = 120,
  idleDrift = 0.7,
  trigger = 'mount',
  animateEntrance = true,
  fontSize = 'clamp(2.5rem, 9vw, 6rem)',
  fontWeight = 700,
  glow = true,
  className,
}: ParticleTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [formed, setFormed] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !particleTextSupported()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let frame: number | null = null;
    let sampleFrame: number | null = null;
    // Cada amostragem espera a fonte; o crachá invalida a que ficou para trás.
    let build = 0;
    let gathering = false;
    let gatherStart = 0;
    let width = 0;
    let height = 0;

    const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

    const drawParticle = (particle: Particle) => {
      const size = particle.size;
      // Abaixo de ~2px o arco não rende curva nenhuma, só custa caro.
      if (size <= 2.1) {
        ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
        return;
      }
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow && !reduceMotion ? particleSize * 3 : 0;

      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;

      let complete = true;

      for (const particle of particles) {
        let baseX = particle.targetX;
        let baseY = particle.targetY;
        let progress = 1;

        if (gathering) {
          const local = (now - gatherStart - particle.delay) / Math.max(1, gatherDuration);
          progress = clamp(local, 0, 1);
          const eased = easeOutCubic(progress);
          baseX = particle.startX + (particle.targetX - particle.startX) * eased;
          baseY = particle.startY + (particle.targetY - particle.startY) * eased;
          if (progress < 1) complete = false;
        } else if (!reduceMotion && idleDrift > 0) {
          const seconds = now * 0.001;
          baseX += Math.sin(seconds * 0.9 + particle.seed * 10) * idleDrift * particle.depth;
          baseY += Math.cos(seconds * 0.75 + particle.depth * 10) * idleDrift * particle.depth;
        }

        if (pointer.active && !reduceMotion && pointerRepel > 0 && repelRadius > 0) {
          const dx = baseX - pointer.smoothX;
          const dy = baseY - pointer.smoothY;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < repelRadius) {
            const force = (1 - distance / repelRadius) ** 2 * pointerRepel;
            baseX += (dx / distance) * force;
            baseY += (dy / distance) * force;
          }
        }

        // Perseguição amortecida: é o que transforma o empurrão do ponteiro em
        // movimento com peso, em vez de teletransporte quadro a quadro.
        const follow = reduceMotion ? 1 : 0.22;
        particle.x += (baseX - particle.x) * follow;
        particle.y += (baseY - particle.y) * follow;

        ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
        drawParticle(particle);
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (gathering && complete) gathering = false;
    };

    const loop = (now: number) => {
      draw(now);
      frame = window.requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (frame === null) frame = window.requestAnimationFrame(loop);
    };

    const startGather = () => {
      // Sem movimento, o texto já está formado: não há o que espalhar.
      if (!particles.length || reduceMotion) return;

      for (const particle of particles) {
        const angle = particle.seed * Math.PI * 2;
        const distance = scatter * (0.35 + particle.depth * 0.75);
        particle.x =
          particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * scatter * 0.55;
        particle.y =
          particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * scatter * 0.55;
        particle.startX = particle.x;
        particle.startY = particle.y;
        particle.delay = particle.seed * stagger;
      }

      gatherStart = performance.now();
      gathering = true;
      startLoop();
    };

    const sampleText = async () => {
      const currentBuild = ++build;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      // Acima de 2x a nitidez extra não se vê e o custo por quadro dobra.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const family = window.getComputedStyle(container).fontFamily || 'sans-serif';
      let size = resolveFontSize(fontSize, container, fontWeight, family);
      let font = `${fontWeight} ${size}px ${family}`;
      await waitForFont(font);
      if (currentBuild !== build) return;

      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      const content = text || ' ';
      offCtx.font = font;
      let metrics = offCtx.measureText(content);

      // Numa tela estreita o corpo escolhido transbordaria: encolhe até caber,
      // que é o que mantém o título inteiro em vez de cortado.
      const maxTextWidth = width * 0.92;
      if (metrics.width > maxTextWidth) {
        size = Math.max(18, size * (maxTextWidth / Math.max(1, metrics.width)));
        font = `${fontWeight} ${size}px ${family}`;
        await waitForFont(font);
        if (currentBuild !== build) return;
        offCtx.font = font;
        metrics = offCtx.measureText(content);
      }

      const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.78);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.22);
      const padding = Math.max(12, Math.ceil(size * 0.08));

      offscreen.width = Math.max(1, left + right) + padding * 2;
      offscreen.height = Math.max(1, ascent + descent) + padding * 2;
      // Redimensionar o canvas zera o contexto: a fonte volta a ser declarada.
      offCtx.font = font;
      offCtx.textAlign = 'left';
      offCtx.textBaseline = 'alphabetic';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillText(content, padding - left, padding + ascent);

      let imageData: ImageData | undefined;
      try {
        imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      } catch {
        imageData = undefined;
      }
      // Canvas sem leitura de pixels: fica o texto simples, e nada quebra.
      if (!imageData) return;

      const targets: Array<{ x: number; y: number; alpha: number }> = [];
      const step = Math.max(2, Math.floor(density));
      const originX = width / 2 - offscreen.width / 2;
      const originY = height / 2 - offscreen.height / 2;

      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
          // O limiar descarta o antialias das bordas, que viraria poeira solta.
          if (alpha > 40) {
            targets.push({ x: originX + x, y: originY + y, alpha: alpha / 255 });
          }
        }
      }

      // Teto de partículas proporcional à área: a densidade pedida não pode
      // virar dezenas de milhares de arcos por quadro numa tela grande.
      const maxParticles = clamp(Math.floor((width * height) / 90), 900, 5200);
      const stride = Math.max(1, Math.ceil(targets.length / maxParticles));

      particles = targets
        .filter((_, index) => index % stride === 0)
        .map((target, index) => {
          const seed = ((index * 9301 + 49297) % 233280) / 233280;
          const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
          return {
            x: target.x,
            y: target.y,
            startX: target.x,
            startY: target.y,
            targetX: target.x,
            targetY: target.y,
            size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)),
            seed,
            depth,
            delay: 0,
          };
        });

      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.smoothX = pointer.x;
      pointer.smoothY = pointer.y;
      setFormed(particles.length > 0);

      if (reduceMotion) {
        // Um quadro estático: o texto formado, sem laço nem deriva.
        draw(performance.now());
        return;
      }
      // Sem entrada a formar, o laço começa mesmo assim: a deriva de repouso e
      // o empurrão do ponteiro são ambiente, não a animação de chegada.
      if (animateEntrance) startGather();
      else startLoop();
    };

    const queueSample = () => {
      if (sampleFrame !== null) window.cancelAnimationFrame(sampleFrame);
      sampleFrame = window.requestAnimationFrame(() => void sampleText());
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };

    const handlePointerEnter = (event: PointerEvent) => {
      handlePointerMove(event);
      if (trigger === 'hover') startGather();
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const handleClick = () => {
      if (trigger === 'click') startGather();
    };

    canvas.addEventListener('pointerenter', handlePointerEnter);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('click', handleClick);

    // O observer já dispara na primeira medida — é ele que faz a amostragem
    // inicial, e é ele que refaz tudo quando a caixa muda de tamanho.
    const resizeObserver = new ResizeObserver(queueSample);
    resizeObserver.observe(container);

    return () => {
      build += 1;
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerenter', handlePointerEnter);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (sampleFrame !== null) window.cancelAnimationFrame(sampleFrame);
      setFormed(false);
    };
  }, [
    text,
    particleSize,
    density,
    color,
    scatter,
    gatherDuration,
    stagger,
    pointerRepel,
    repelRadius,
    idleDrift,
    trigger,
    animateEntrance,
    fontSize,
    fontWeight,
    glow,
    reduceMotion,
  ]);

  return (
    // <span> e não <div>: assim isto cabe dentro de um <h1>/<h2> sem quebrar
    // o HTML — o título continua sendo um título.
    <span
      ref={containerRef}
      data-particles={formed ? 'on' : 'off'}
      className={cn('relative flex items-center justify-center overflow-hidden', className)}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {/* Enquanto as partículas não desenharem o texto (sem canvas, caixa de
          altura zero), ele aparece como texto comum: o efeito é acabamento,
          nunca o único caminho até a informação. */}
      <span className={formed ? 'sr-only' : undefined}>{text}</span>
    </span>
  );
}
