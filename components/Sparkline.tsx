"use client";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  /** Stroke color, e.g. "#0E6B85" */
  stroke?: string;
  /** Optional area fill color (rgba). */
  fill?: string;
  strokeWidth?: number;
  className?: string;
  /** Render a small dot at the latest value. */
  showLast?: boolean;
}

/**
 * Bloomberg-style mini sparkline. Pure SVG, zero deps. Auto-scales
 * vertical extent to data, with a small floor so flat lines still
 * show a baseline.
 */
export function Sparkline({
  values,
  width = 96,
  height = 22,
  stroke = "currentColor",
  fill,
  strokeWidth = 1.25,
  className = "",
  showLast = true,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden="true"
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.0001, max - min);
  const padY = 2;
  const usableH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = padY + usableH - ((v - min) / span) * usableH;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    fill !== undefined
      ? `${path} L ${width.toFixed(2)} ${height} L 0 ${height} Z`
      : null;

  const lastX = points[points.length - 1][0];
  const lastY = points[points.length - 1][1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-hidden="true"
    >
      {areaPath && fill && (
        <path d={areaPath} fill={fill} stroke="none" />
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showLast && (
        <circle
          cx={lastX}
          cy={lastY}
          r={1.6}
          fill={stroke}
          opacity="0.95"
        />
      )}
    </svg>
  );
}

/**
 * Synthesizes a plausible mini-history series from a single composite
 * score and a momentum value (-1..1). Used when we don't have a real
 * time series but want a visual hint at trajectory.
 */
export function syntheticSeries(
  endValue: number,
  momentum: number,
  points = 24
): number[] {
  const out: number[] = [];
  // start point chosen so the line ends at endValue and trends with
  // momentum; add tiny pseudo-random wobble so it doesn't look fake.
  const drift = momentum * (endValue * 0.18);
  const start = Math.max(0, endValue - drift);
  for (let i = 0; i < points; i++) {
    const t = i / Math.max(1, points - 1);
    // Cubic ease so the curve reads as a confident move
    const eased = t * t * (3 - 2 * t);
    const wobble = Math.sin((i * 1.7 + endValue) * 0.9) * (endValue * 0.025);
    out.push(start + (endValue - start) * eased + wobble);
  }
  return out;
}
