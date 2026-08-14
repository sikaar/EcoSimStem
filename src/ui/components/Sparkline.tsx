export interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
}

/** Minimal SVG polyline sparkline — a per-gene trend line (§9.2), not a
 * full chart: no axes, no ticks, just shape. */
export function Sparkline({ values, width = 90, height = 22, color = '#63b3c4' }: SparklineProps) {
  if (values.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
