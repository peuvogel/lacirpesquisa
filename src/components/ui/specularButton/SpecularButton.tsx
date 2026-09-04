import { useEffect, useRef, type ReactNode } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';

import { cn } from '@/lib/utils';
import './SpecularButton.css';

/** O canvas transborda o botão para o brilho poder vazar pela borda. */
const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = sdRoundedRect(p, uHalfSize, uRadius);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

/**
 * O efeito é acabamento, nunca requisito: sem WebGL ou sem ResizeObserver o
 * botão continua sendo um botão. O ambiente de teste é exatamente esse caso
 * (`getContext` devolve null fora do 2d), e 15 arquivos de teste clicam aqui.
 */
function specularSupported(): boolean {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return false;
  try {
    const probe = window.document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * O acabamento por tom. O verde é o `--color-accent` do tema (#209978): o
 * shader recebe cor por valor (ogl `Color.set`), não resolve `var()`, então o
 * hex vive aqui — e só aqui.
 */
const TONES = {
  neutral: { lineColor: '#ffffff', baseColor: '#525252', textColor: '#f5f5f5' },
  accent: { lineColor: '#209978', baseColor: '#17795e', textColor: '#f4f4f5' },
} as const;

export type SpecularTone = keyof typeof TONES;

export interface SpecularButtonProps {
  children?: ReactNode;
  radius?: number;
  /** Paleta do acabamento. 'accent' é o verde da ação principal. */
  tone?: SpecularTone;
  /** 'lg' para a ação principal de uma tela; 'md' acompanha o Button do app. */
  size?: 'md' | 'lg';
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function SpecularButton({
  children,
  radius = 6,
  tone = 'neutral',
  size = 'md',
  textColor,
  lineColor,
  baseColor,
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className,
  type = 'button',
}: SpecularButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef<Record<string, unknown>>({});

  // Cor explícita ganha do tom: quem passa `lineColor` continua mandando.
  const palette = TONES[tone];
  const resolvedLineColor = lineColor ?? palette.lineColor;
  const resolvedBaseColor = baseColor ?? palette.baseColor;
  const resolvedTextColor = textColor ?? palette.textColor;

  propsRef.current = {
    radius,
    lineColor: resolvedLineColor,
    baseColor: resolvedBaseColor,
    intensity, shineSize, shineFade,
    thickness, speed, followMouse, proximity, autoAnimate,
  };

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx || !specularSupported()) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let cleanup = () => {};

    try {
      const dpr = window.devicePixelRatio || 1;
      const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const geometry = new Triangle(gl);
      if (geometry.attributes.uv) delete geometry.attributes.uv;

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uCenter: { value: [0, 0] },
          uHalfSize: { value: [1, 1] },
          uRadius: { value: 0 },
          uAngle: { value: 2.4 },
          uPx: { value: dpr },
          uLineColor: { value: [1, 1, 1] },
          uBaseColor: { value: [0.32, 0.32, 0.32] },
          uIntensity: { value: 1 },
          uShineSize: { value: 0.17 },
          uShineFade: { value: 0.7 },
          uThickness: { value: 1 },
          uBaseWidth: { value: dpr },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });
      fx.appendChild(gl.canvas);
      btn.dataset.specular = 'on';

      const sizeRef = { w: 1, h: 1 };
      const resize = () => {
        // Medida fracionária + centro explícito mantêm o SDF colado à borda CSS,
        // em vez de derivar até um pixel pelo arredondamento de offsetWidth.
        const rect = btn.getBoundingClientRect();
        sizeRef.w = rect.width;
        sizeRef.h = rect.height;
        renderer.setSize(rect.width + PAD * 2, rect.height + PAD * 2);
        program.uniforms.uCenter.value = [(PAD + rect.width / 2) * dpr, (PAD + rect.height / 2) * dpr];
        program.uniforms.uHalfSize.value = [(rect.width / 2) * dpr, (rect.height / 2) * dpr];
      };
      const ro = new ResizeObserver(resize);
      ro.observe(btn);
      resize();

      const lineC = new Color();
      const baseC = new Color();
      const paint = (angle: number, bright: number) => {
        const p = propsRef.current as Record<string, number & string & boolean>;
        lineC.set(p.lineColor);
        baseC.set(p.baseColor);
        program.uniforms.uAngle.value = angle;
        program.uniforms.uRadius.value = Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
        program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
        program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
        program.uniforms.uIntensity.value = p.intensity * bright;
        program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
        program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
        program.uniforms.uThickness.value = p.thickness * dpr;
        renderer.render({ scene: mesh });
      };

      if (reduceMotion) {
        // Um quadro estático: a borda desenhada, sem varredura nem laço.
        paint(2.4, 1);
        cleanup = () => {
          ro.disconnect();
          if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
        return cleanup;
      }

      let pointerAngle: number | null = null;
      let proximityT = 0;
      const onPointerMove = (e: PointerEvent) => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
        const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
        const dist = Math.hypot(dx, dy);
        if (dist === 0) {
          const nx = (e.clientX - cx) / (rect.width / 2);
          const ny = (cy - e.clientY) / (rect.height / 2);
          pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
        } else {
          pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
        }
        const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity as number, 1));
        proximityT = t * t * (3 - 2 * t);
      };
      window.addEventListener('pointermove', onPointerMove);

      let angle = 2.4;
      let idleAngle = 2.4;
      let bright = 0;
      let last = performance.now();
      let raf = 0;

      const update = (now: number) => {
        raf = requestAnimationFrame(update);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const p = propsRef.current as Record<string, number & boolean>;

        idleAngle += p.speed * dt;
        const steer = p.followMouse && pointerAngle != null && (!p.autoAnimate || proximityT > 0);
        const target = steer ? pointerAngle! : idleAngle;
        const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angle += diff * (1 - Math.exp(-dt * 7));

        const brightTarget = p.autoAnimate ? 1 : proximityT;
        bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));
        paint(angle, bright);
      };
      raf = requestAnimationFrame(update);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch {
      // GPU bloqueada, contexto perdido: cai no botão sem efeito.
      btn.dataset.specular = 'off';
    }

    return () => cleanup();
  }, []);

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-specular="off"
      data-tone={tone}
      data-size={size}
      className={cn('specular-button', size === 'lg' && 'specular-button--lg', className)}
      style={{
        '--sb-radius': `${radius}px`,
        '--sb-text-color': resolvedTextColor,
      } as React.CSSProperties}
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
}

export default SpecularButton;
