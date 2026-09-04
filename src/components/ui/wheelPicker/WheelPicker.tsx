import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { faceIndexAt, type WheelGeometry } from './wheelGeometry';
import './wheel-picker.css';

const WHEEL_SLOTS = 24;

export interface WheelOption {
  value: string;
  label: string;
  className?: string;
}

export interface WheelPickerProps {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  label?: string;
  width?: number;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
}

export default function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
  label,
  width = 104,
  disabled = false,
  selected = false,
  className,
  onInteractStart,
  onInteractEnd,
}: WheelPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const frameRef = useRef<number | null>(null);
  const settlingRef = useRef(false);

  const interactingRef = useRef(false);
  const interactEndTimerRef = useRef<number | null>(null);
  const cbRef = useRef({ onInteractStart, onInteractEnd });
  cbRef.current = { onInteractStart, onInteractEnd };

  const [active, setActive] = useState(false);

  const endInteract = useCallback(() => {
    if (interactEndTimerRef.current !== null) {
      window.clearTimeout(interactEndTimerRef.current);
      interactEndTimerRef.current = null;
    }
    setActive(false);
    if (!interactingRef.current) return;
    interactingRef.current = false;
    cbRef.current.onInteractEnd?.();
  }, []);

  const scheduleInteractEnd = useCallback(() => {
    if (!interactingRef.current) return;
    if (interactEndTimerRef.current !== null) window.clearTimeout(interactEndTimerRef.current);
    interactEndTimerRef.current = window.setTimeout(endInteract, 450);
  }, [endInteract]);

  const beginInteract = useCallback(() => {
    setActive(true);
    if (!interactingRef.current) {
      interactingRef.current = true;
      cbRef.current.onInteractStart?.();
    }
    scheduleInteractEnd();
  }, [scheduleInteractEnd]);

  useEffect(() => endInteract, [endInteract]);

  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const total = options.length;

  const geometry = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const faceH = parseFloat(getComputedStyle(root).getPropertyValue('--face-h')) || 34;
    const slots = Math.max(total, WHEEL_SLOTS);
    const radius = faceH / (2 * Math.tan(Math.PI / slots));
    root.style.setProperty('--radius', `${radius}px`);
    root.style.setProperty('--step', `${360 / slots}deg`);
  }, [total]);

  useLayoutEffect(() => {
    geometry();
  }, [geometry]);

  const progressRef = useRef(0);
  const setProgress = useCallback((p: number) => {
    progressRef.current = p;
    rootRef.current?.style.setProperty('--progress', String(p));
  }, []);

  const readGeometry = useCallback((): WheelGeometry | null => {
    const root = rootRef.current;
    if (!root) return null;
    const styles = getComputedStyle(root);
    const radius = parseFloat(styles.getPropertyValue('--radius'));
    const stepDeg = parseFloat(styles.getPropertyValue('--step'));
    const perspective = parseFloat(styles.perspective);
    if (!radius || !stepDeg || !perspective) return null;
    return { radius, stepDeg, perspective };
  }, []);

  const itemHeight = () => {
    const first = scrollerRef.current?.firstElementChild as HTMLElement | null;
    return first?.offsetHeight || 44;
  };

  const animFrameRef = useRef<number | null>(null);

  const scrollToIndex = useCallback(
    (i: number, smooth: boolean) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const clampedIndex = Math.max(0, Math.min(options.length - 1, i));
      const targetTop = clampedIndex * itemHeight();

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      if (!smooth) {
        scroller.scrollTop = targetTop;
        setProgress(clampedIndex);
        return;
      }

      const startTop = scroller.scrollTop;
      const distance = targetTop - startTop;
      if (Math.abs(distance) < 0.5) return;

      const startTime = performance.now();
      const duration = 360;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const p = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        const currentTop = startTop + distance * ease;

        scroller.scrollTop = currentTop;
        setProgress(currentTop / itemHeight());

        if (p < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          scroller.scrollTop = targetTop;
          setProgress(clampedIndex);
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    },
    [options.length, setProgress]
  );

  const handleScroll = useCallback(() => {
    scheduleInteractEnd();
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const progress = scroller.scrollTop / itemHeight();

      if (!interactingRef.current) {
        if (Math.abs(progress - index) > 0.01) {
          scrollToIndex(index, false);
        } else {
          setProgress(progress);
        }
        return;
      }

      setProgress(progress);

      const next = options[Math.round(progress)];
      if (next && next.value !== value) {
        settlingRef.current = true;
        onChange(next.value);
      }
    });
  }, [options, value, onChange, setProgress, scheduleInteractEnd, index, scrollToIndex]);

  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (settlingRef.current) {
      settlingRef.current = false;
      return;
    }

    scrollToIndex(index, mountedRef.current);
    setProgress(index);
    mountedRef.current = true;
  }, [index, setProgress, scrollToIndex]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      beginInteract();
      if (disabled || options.length === 0) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextIndex = Math.max(0, index - 1);
        if (nextIndex !== index) {
          onChange(options[nextIndex].value);
          scrollToIndex(nextIndex, true);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = Math.min(options.length - 1, index + 1);
        if (nextIndex !== index) {
          onChange(options[nextIndex].value);
          scrollToIndex(nextIndex, true);
        }
      }
    },
    [beginInteract, disabled, index, onChange, options, scrollToIndex]
  );

  const pointerHitRef = useRef(false);
  const handlePointerSelect = useCallback(
    (e: React.MouseEvent<HTMLUListElement>) => {
      pointerHitRef.current = false;
      if (disabled || options.length === 0) return;
      const root = rootRef.current;
      const geo = readGeometry();
      if (!root || !geo) return;
      const rect = root.getBoundingClientRect();
      if (!rect.height) return;
      if (e.clientY < rect.top || e.clientY > rect.bottom) return;

      const offset = e.clientY - (rect.top + rect.height / 2);
      const target = faceIndexAt(offset, progressRef.current, options.length, geo);
      if (target < 0) return;

      pointerHitRef.current = true;
      beginInteract();
      if (options[target].value !== value) onChange(options[target].value);
      scrollToIndex(target, true);
    },
    [beginInteract, disabled, onChange, options, readGeometry, scrollToIndex, value]
  );

  return (
    <div className="group/wheel flex flex-col items-center gap-2">
      {label && (
        <span
          className={`font-sans flex h-8 items-start justify-center text-center text-[11px] font-medium uppercase leading-tight tracking-[0.14em] text-white transition-opacity duration-200 group-hover/wheel:opacity-100 ${
            active ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden
        >
          {label}
        </span>
      )}
      <div
        ref={rootRef}
        className={`mn-wheel ${className || ''}`}
        style={{ '--wheel-w': `${width}px` } as React.CSSProperties}
        data-disabled={disabled || undefined}
        data-selected={selected || undefined}
      >
        <ul
          ref={scrollerRef}
          className="mn-wheel-scroller outline-none border-none"
          onScroll={handleScroll}
          onPointerDown={beginInteract}
          onTouchStart={beginInteract}
          onWheel={beginInteract}
          onKeyDown={handleKeyDown}
          onClickCapture={handlePointerSelect}
          onPointerUp={scheduleInteractEnd}
          onTouchEnd={scheduleInteractEnd}
          onBlur={endInteract}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={disabled ? -1 : 0}
        >
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={(e) => {
                if (pointerHitRef.current) return;
                e.stopPropagation();
                if (option.value !== value) onChange(option.value);
                scrollToIndex(i, true);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>

        {/* Tambor 3D */}
        <div className="mn-wheel-stage" aria-hidden>
          <div className="mn-wheel-drum">
            {options.map((option, i) => (
              <div
                key={option.value}
                className="mn-wheel-face"
                style={{ '--i': i } as React.CSSProperties}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>

        {/* Visor Central */}
        <div className="mn-wheel-visor" data-selected={selected || undefined} aria-hidden>
          <div className="mn-wheel-track">
            {options.map((option) => (
              <span key={option.value} className={option.className ?? 'text-white'}>
                {option.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
