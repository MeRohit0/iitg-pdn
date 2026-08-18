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
export const SubstationBarNode: React.FC<SubstationBarNodeProps> = ({ data, selected }) => {
  const tooltipParts = [data.label, 'Substation'];
  if (data.result?.voltagePu != null) {
    tooltipParts.push(`${data.result.voltagePu.toFixed(3)} p.u.`);
  }

  return (
    <div className="relative flex items-center p-2" title={tooltipParts.join(' · ')}>
      <FourSideHandles />

      <div
        className={[
          'h-16 w-3.5 rounded-sm bg-red-600 transition-transform shadow-sm',
          selected ? 'scale-105 ring-2 ring-indigo-500' : '',
        ].join(' ')}
      />
    </div>
  );
};
