import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PdnNodeData } from '../../types/graph.types';

interface BaseNodeProps {
  data: PdnNodeData;
  icon: React.ReactNode;
  accentColorClass: string; // Tailwind border/text color, e.g. 'border-amber-500'
  selected?: boolean;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
}

/**
 * Shared visual shell for every network component. Voltage/energization
 * state (post-solve) subtly tints the card so the operator can read health
 * at a glance without switching to the Results overlay.
 */
export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  icon,
  accentColorClass,
  selected,
  showTargetHandle = true,
  showSourceHandle = true,
}) => {
  const isEnergized = data.result?.isEnergized;
  const stateRing =
    isEnergized === false
      ? 'ring-2 ring-gray-400 opacity-60'
      : isEnergized === true
      ? 'ring-2 ring-emerald-400'
      : '';

  return (
    <div
      className={[
        'min-w-[140px] rounded-lg border-2 bg-white shadow-md px-3 py-2',
        accentColorClass,
        stateRing,
        selected ? 'shadow-lg scale-[1.02]' : '',
        'transition-all duration-150',
      ].join(' ')}
    >
      {showTargetHandle && (
        <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      )}

      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800 leading-tight">
            {data.label}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">
            {data.componentType}
          </span>
        </div>
      </div>

      {data.result?.voltagePu != null && (
        <div className="mt-1 text-[10px] text-slate-500">
          {data.result.voltagePu.toFixed(3)} p.u.
        </div>
      )}

      {showSourceHandle && (
        <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
      )}
    </div>
  );
};
