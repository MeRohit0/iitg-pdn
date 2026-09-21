import React, { useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

export interface PlotlyChartProps {
  data: any[];
  layout: any;
  config?: any;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Clean, reactive wrapper for Plotly.js charts (both 2D line and WebGL 3D surfaces).
 * Wrapped in React.memo with rAF-throttled resizing and memoized configs.
 */
export const PlotlyChart: React.FC<PlotlyChartProps> = React.memo(({
  data,
  layout,
  config,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeRafRef = useRef<number | null>(null);

  const mergedConfig = useMemo(
    () => ({
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      ...config,
    }),
    [config]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    Plotly.react(containerRef.current, data, layout, mergedConfig);
  }, [data, layout, mergedConfig]);

  useEffect(() => {
    const handleResize = () => {
      if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          Plotly.Plots.resize(containerRef.current);
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current);
      if (containerRef.current) {
        Plotly.purge(containerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', minHeight: '380px', ...style }}
    />
  );
});
