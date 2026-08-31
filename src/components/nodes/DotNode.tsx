import React from 'react';
import type { PdnNodeData } from '../../types/graph.types';
import { FourSideHandles } from './FourSideHandles';

interface DotNodeProps {
  data: PdnNodeData;
  selected?: boolean;
}

/**
 * Generic compact bus/junction node. Deliberately small — a filled circle
 * rather than a labeled card — so networks with dozens of these (e.g. 33
 * nodes / 120+ lines) stay readable instead of turning into a wall of
 * cards. The bus number sits *inside* the circle (single-line-diagram
 * convention); voltage/P/Q show on hover via the native tooltip and in
 * full in the double-click inspector sidebar.
 *
 * The outer wrapper has a bit of padding, which pushes the 4 side handles
 * (see FourSideHandles) a few pixels clear of the circle itself — enough
 * room to grab a connection point without it overlapping the number.
 */
export const DotNode: React.FC<DotNodeProps> = ({ data, selected }) => {
  const isEnergized = data.result?.isEnergized;
  const params = data.params as { activePowerMw?: number; reactivePowerMvar?: number };

  const tooltipParts = [data.label];
  if (data.result?.voltagePu != null) {
    tooltipParts.push(`${data.result.voltagePu.toFixed(3)} p.u.`);
  }
  if (params.activePowerMw != null) tooltipParts.push(`P=${params.activePowerMw} MW`);
  if (params.reactivePowerMvar != null) tooltipParts.push(`Q=${params.reactivePowerMvar} MVAr`);

  const ringClass =
    isEnergized === false
      ? 'ring-2 ring-slate-300'
      : isEnergized === true
      ? 'ring-2 ring-emerald-400'
      : 'ring-1 ring-slate-300';

  return (
    <div className="relative flex flex-col items-center p-0.5" title={tooltipParts.join(' · ')}>
      <FourSideHandles />

      <div
        className={[
          'flex items-center justify-center h-7 w-7 rounded-full bg-slate-900 transition-transform z-10',
          ringClass,
          selected ? 'scale-110 ring-2 ring-indigo-500' : '',
        ].join(' ')}
      >
        <span className="text-[10px] font-bold text-white leading-none select-none">
          {data.label}
        </span>
      </div>

      {/* Inline data and solved voltage label */}
      <div className="absolute top-[36px] flex flex-col items-center pointer-events-none whitespace-nowrap bg-white/90 border border-slate-200 rounded px-1 py-0.5 text-[8px] text-slate-500 shadow-sm leading-tight">
        {data.result?.voltagePu != null && (
          <div className="font-bold text-indigo-600">
            {data.result.voltagePu.toFixed(3)} pu
            {data.result.voltageAngleDeg != null ? ` ∠${data.result.voltageAngleDeg.toFixed(1)}°` : ''}
          </div>
        )}
        {((params.activePowerMw ?? 0) !== 0 || (params.reactivePowerMvar ?? 0) !== 0) && (
          <div className="text-slate-400 font-medium">
            {params.activePowerMw ?? 0}/{params.reactivePowerMvar ?? 0}
          </div>
        )}
      </div>
    </div>
  );
};
