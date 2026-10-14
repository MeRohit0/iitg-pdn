import React from 'react';
import type { PdnNodeData } from '../../types/graph.types';
import { FourSideHandles } from './FourSideHandles';

interface SubstationBarNodeProps {
  data: PdnNodeData;
  selected?: boolean;
}

/**
 * Single-line-diagram convention: the substation/source bus is a thick red
 * vertical bar rather than a card. Connectable from all four sides — see
 * FourSideHandles — so the feeder can run out to the right (typical), or
 * a tie line can come in from any other direction.
 */
export const SubstationBarNode: React.FC<SubstationBarNodeProps> = React.memo(({ data, selected }) => {
  const tooltipParts = [data.label, 'Substation'];
  if (data.result?.voltagePu != null) {
    tooltipParts.push(`${data.result.voltagePu.toFixed(3)} p.u.`);
  }

  return (
    <div className="relative flex flex-col items-center p-0.5" title={tooltipParts.join(' · ')}>
      <FourSideHandles />

      <div
        className={[
          'h-16 w-3.5 rounded-sm bg-red-600 transition-transform shadow-sm z-10',
          selected ? 'scale-105 ring-2 ring-indigo-500' : '',
        ].join(' ')}
      />

      {/* Inline solved voltage/injection label */}
      <div className="absolute top-[72px] flex flex-col items-center pointer-events-none whitespace-nowrap bg-white/90 border border-slate-200 rounded px-1 py-0.5 text-[8px] text-slate-500 shadow-sm leading-tight">
        {data.result?.voltagePu != null && (
          <div className="font-bold text-indigo-600">
            {data.result.voltagePu.toFixed(3)} pu
            {data.result.voltageAngleDeg != null ? ` ∠${data.result.voltageAngleDeg.toFixed(1)}°` : ''}
          </div>
        )}
        {data.result?.pInjectionMw != null && (
          <div className="text-emerald-600 font-bold">
            P:{data.result.pInjectionMw.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
});
