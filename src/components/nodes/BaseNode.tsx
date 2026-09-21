import React from 'react';
import { ComponentType, type PdnNodeData } from '../../types/graph.types';
import { FourSideHandles } from './FourSideHandles';

interface BaseNodeProps {
  data: PdnNodeData;
  icon: React.ReactNode;
  accentColorClass: string; // Tailwind border/text color, e.g. 'border-amber-500'
  selected?: boolean;
}

/**
 * Shared visual shell for every network component. Voltage/energization
 * state (post-solve) subtly tints the card so the operator can read health
 * at a glance without switching to the Results overlay. Connectable from
 * all four sides — see FourSideHandles.
 */
export const BaseNode: React.FC<BaseNodeProps> = React.memo(({ data, icon, accentColorClass, selected }) => {
  const isEnergized = data.result?.isEnergized;
  const stateRing =
    isEnergized === false
      ? 'ring-2 ring-gray-400 opacity-60'
      : isEnergized === true
      ? 'ring-2 ring-emerald-400'
      : '';

  const customerType = (data.params as any)?.customerType;

  // Border color driven by customer type; falls back to component accent if unset
  const borderClass =
    customerType === 'Industrial'  ? 'border-red-600'   :
    customerType === 'Commercial'  ? 'border-green-600'  :
    customerType === 'Residential' ? 'border-blue-600'   :
    accentColorClass;

  let custBadge: { text: string; className: string } | null = null;
  if (customerType === 'Residential') {
    custBadge = { text: 'Residential', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  } else if (customerType === 'Industrial') {
    custBadge = { text: 'Industrial', className: 'bg-red-100 text-red-700 border-red-200' };
  } else if (customerType === 'Commercial') {
    custBadge = { text: 'Commercial', className: 'bg-green-100 text-green-700 border-green-200' };
  }

  return (
    <div
      className={[
        'relative min-w-[140px] rounded-lg border-2 bg-white shadow-md px-3 py-2',
        borderClass,
        stateRing,
        selected ? 'shadow-lg scale-[1.02]' : '',
        'transition-all duration-150',
      ].join(' ')}
    >
      <FourSideHandles />

      <div className="flex items-center justify-between gap-2">
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
        {custBadge && (
          <span className={`px-1.5 py-0.5 rounded border text-[8px] font-semibold ${custBadge.className}`}>
            {custBadge.text}
          </span>
        )}
      </div>

      {/* Parameters and solved results inline display */}
      <div className="mt-1.5 flex flex-col text-[10px] text-slate-500 font-medium leading-normal border-t border-slate-100 pt-1">
        {data.componentType === ComponentType.LOAD && (
          <div>
            Load: {((data.params as any).pDemandMw ?? 0)}/{(data.params as any).qDemandMvar ?? 0}
          </div>
        )}
        {data.componentType === ComponentType.GENERATOR && (
          <div>
            Gen: {((data.params as any).pMaxMw ?? 0)} MW
          </div>
        )}
        {data.componentType === ComponentType.TRANSFORMER && (
          <div>
            Rating: {((data.params as any).ratedPowerMva ?? 0)} MVA
          </div>
        )}
        {data.result?.voltagePu != null && (
          <div className="font-bold text-indigo-600 mt-0.5 whitespace-nowrap">
            V: {data.result.voltagePu.toFixed(3)} pu
            {data.result.voltageAngleDeg != null ? ` ∠${data.result.voltageAngleDeg.toFixed(1)}°` : ''}
          </div>
        )}
      </div>
    </div>
  );
});
