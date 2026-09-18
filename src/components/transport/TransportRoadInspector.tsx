import React from 'react';
import {
  ROAD_TYPE_COLORS,
  ROAD_TYPE_LABELS,
  ROAD_TYPES,
  type RoadType,
  type TransportRoad,
} from '../../types/transport.types';

interface Props {
  road: TransportRoad;
  sourceLabel: string;
  targetLabel: string;
  onClose: () => void;
  onChange: (patch: Partial<TransportRoad['data']>) => void;
}

export const TransportRoadInspector: React.FC<Props> = ({
  road,
  sourceLabel,
  targetLabel,
  onClose,
  onChange,
}) => {
  const d = road.data!;
  const current = d.roadType;

  return (
    <aside className="absolute top-28 right-4 z-20 w-72 max-h-[calc(100%-8rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="text-sm font-semibold text-slate-800">
          Road {d.roadNumber ?? '—'}
        </div>
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
        <p className="text-slate-500">
          {sourceLabel} → {targetLabel}
        </p>

        <label className="block space-y-1">
          <span className="font-medium text-slate-600">Road number</span>
          <input
            type="number"
            step={1}
            value={d.roadNumber || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              const roadNum = isNaN(val) ? 0 : val;
              const isDefaultLabel = !d.label || d.label === `R${d.roadNumber}`;
              onChange({
                roadNumber: roadNum,
                ...(isDefaultLabel ? { label: `R${roadNum}` } : {}),
              });
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-medium text-slate-600">Label</span>
          <input
            type="text"
            value={d.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="font-medium text-slate-600">Road type</legend>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`road-type-${road.id}`}
              checked={current == null}
              onChange={() => onChange({ roadType: null })}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ROAD_TYPE_COLORS.default }}
              />
              Unset (gray)
            </span>
          </label>
          {ROAD_TYPES.map((t: RoadType) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`road-type-${road.id}`}
                checked={current === t}
                onChange={() => onChange({ roadType: t })}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ROAD_TYPE_COLORS[t] }}
                />
                {ROAD_TYPE_LABELS[t]} ({t})
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </aside>
  );
};
