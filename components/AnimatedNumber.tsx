"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Number of decimal places to render. Default 0. */
  decimals?: number;
  /** Animation duration in ms. Default 800. */
  duration?: number;
  /** Optional formatter (e.g. for thousand separators). */
  format?: (value: number) => string;
  /** Optional className for the rendered span. */
  className?: string;
  /** Suffix appended after the formatted value, e.g. "%" or "d". */
  suffix?: string;
  /** Prefix prepended, e.g. "€" or "+". */
  prefix?: string;
}

/**
 * Counts up from the previous value to the new value with an
 * easeOut cubic curve. Keeps `tabular-nums` mono-spacing so the
 * width never jitters during the animation.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 800,
  format,
  className = "",
  suffix = "",
  prefix = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startedRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    fromRef.current = display;
    startedRef.current = null;
    const target = value;

    const step = (now: number) => {
      if (startedRef.current === null) startedRef.current = now;
      const elapsed = now - startedRef.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const text = format
    ? format(display)
    : decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toString();

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
