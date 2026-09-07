import React, { useEffect, useRef } from 'react';
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
 */
export const PlotlyChart: React.FC<PlotlyChartProps> = ({
  data,
  layout,
  config,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const defaultConfig = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      ...config,
    };

    Plotly.react(containerRef.current, data, layout, defaultConfig);
  }, [data, layout, config]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
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
};
