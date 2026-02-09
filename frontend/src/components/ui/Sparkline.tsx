import { useMemo } from 'react';
import { cn } from '@/lib/cn';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  showDots?: boolean;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = 'currentColor',
  className,
  showDots = false,
}: SparklineProps) {
  const pathData = useMemo(() => {
    if (data.length === 0) return { path: '', points: [] };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return { x, y };
    });

    const path = points
      .map((point, index) => {
        if (index === 0) {
          return `M ${point.x} ${point.y}`;
        }
        return `L ${point.x} ${point.y}`;
      })
      .join(' ');

    return { path, points };
  }, [data, width, height]);

  if (data.length === 0) {
    return null;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-label="Sparkline chart"
      role="img"
    >
      {/* Line */}
      <path
        d={pathData.path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Optional dots for data points */}
      {showDots &&
        pathData.points?.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="1.5"
            fill={color}
            opacity="0.6"
          />
        ))}
    </svg>
  );
}
