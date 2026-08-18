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
    <div className="relative flex items-center justify-center p-2" title={tooltipParts.join(' · ')}>
      <FourSideHandles />

      <div
        className={[
          'flex items-center justify-center h-7 w-7 rounded-full bg-slate-900 transition-transform',
          ringClass,
          selected ? 'scale-110 ring-2 ring-indigo-500' : '',
        ].join(' ')}
      >
        <span className="text-[10px] font-bold text-white leading-none select-none">
          {data.label}
        </span>
      </div>
    </div>
  );
};
