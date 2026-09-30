import React from 'react';
import type { TransportNode } from '../../types/transport.types';

interface Props {
  node: TransportNode;
  onClose: () => void;
  onChange: (patch: Partial<TransportNode['data']>) => void;
  onViewEvAnalytics?: () => void;
}

export const TransportNodeInspector: React.FC<Props> = ({
  node,
  onClose,
  onChange,
  onViewEvAnalytics,
}) => {
  const d = node.data;

  return (
    <aside className="absolute top-28 right-4 z-20 w-72 max-h-[calc(100%-8rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="text-sm font-semibold text-slate-800">Node {d.label}</div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="px-3 py-3 space-y-3 text-xs">
        <label className="block space-y-1">
          <span className="font-medium text-slate-600">Label</span>
          <input
            type="text"
            value={d.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(d.isEvChargingStation)}
            onChange={(e) => onChange({ isEvChargingStation: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-medium text-slate-600">EV charging station</span>
        </label>

        <label className="block space-y-1">
          <span className="font-medium text-slate-600">Voltage (kV)</span>
          <input
            type="number"
            step={0.01}
            value={Number.isFinite(d.voltageKv) ? d.voltageKv : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange({ voltageKv: isNaN(val) ? 0 : val });
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-medium text-slate-600">Power draw (kW)</span>
          <input
            type="number"
            step={0.1}
            value={Number.isFinite(d.powerDrawKw) ? d.powerDrawKw : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange({ powerDrawKw: isNaN(val) ? 0 : val });
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        {Boolean(d.isEvChargingStation) && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 space-y-1.5">
            <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
              Active EV Charging Station
            </div>
            <p className="text-[10px] text-emerald-700 leading-relaxed">
              Included in the 3D Spatial-Temporal EV Charging distribution and 24h diurnal profiles.
            </p>
            {onViewEvAnalytics && (
              <button
                type="button"
                onClick={onViewEvAnalytics}
                className="w-full rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                ⚡ View EV Charging Graph
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
