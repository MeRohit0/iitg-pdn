import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { FourSideHandles } from '../nodes/FourSideHandles';
import type { TransportNodeData } from '../../types/transport.types';

/** Compact junction node; EV charging stations get an emerald ring + badge. */
export const TransportNodeView: React.FC<NodeProps> = ({ data, selected }) => {
  const d = data as TransportNodeData;
  const isEv = Boolean(d.isEvChargingStation);

  const tooltip = [
    d.label,
    isEv ? 'EV charging station' : null,
    `V=${d.voltageKv ?? 0} kV`,
    `P=${d.powerDrawKw ?? 0} kW`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative flex flex-col items-center p-0.5" title={tooltip}>
      <FourSideHandles />
      <div
        className={[
          'relative flex items-center justify-center h-7 w-7 rounded-full transition-transform z-10',
          isEv ? 'bg-emerald-700 ring-2 ring-emerald-400' : 'bg-slate-900 ring-1 ring-slate-300',
          selected ? 'scale-110 ring-2 ring-indigo-500' : '',
        ].join(' ')}
      >
        <span className="text-[10px] font-bold text-white leading-none select-none">{d.label}</span>
        {isEv && (
          <span
            className="absolute -top-1.5 -right-2 px-1 rounded-full text-[7px] font-black leading-tight shadow-sm bg-emerald-500 text-white"
            title="EV charging station"
          >
            EV
          </span>
        )}
      </div>
      {(isEv || (d.powerDrawKw ?? 0) > 0) && (
        <div className="absolute top-[36px] pointer-events-none whitespace-nowrap bg-white/90 border border-slate-200 rounded px-1 py-0.5 text-[8px] text-slate-500 shadow-sm leading-tight">
          {d.voltageKv ?? 0} kV · {d.powerDrawKw ?? 0} kW
        </div>
      )}
    </div>
  );
};

export const transportNodeTypes = {
  transportNode: TransportNodeView,
};
