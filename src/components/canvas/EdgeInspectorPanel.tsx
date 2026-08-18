import React from 'react';
import { LineStatus, type PdnEdge } from '../../types/graph.types';

type FieldType = 'number' | 'text';

interface FieldDescriptor {
  key: string; // key inside edge.data
  label: string;
  type: FieldType;
  unit?: string;
  step?: number;
}

// Only R and X are exposed for editing, per request — the underlying edge
// data still carries maxCurrentA (I_max) at its default value behind the
// scenes, since mockSolve needs *some* capacity figure to compute loading
// %/status color; it's just not user-editable here anymore.
const FIELDS: FieldDescriptor[] = [
  { key: 'resistanceOhm', label: 'Resistance (R)', type: 'number', unit: 'Ω', step: 0.01 },
  { key: 'reactanceOhm', label: 'Reactance (X)', type: 'number', unit: 'Ω', step: 0.01 },
];

const STATUS_LABEL: Record<LineStatus, string> = {
  [LineStatus.IDLE]: 'Not yet solved',
  [LineStatus.NORMAL]: 'Normal',
  [LineStatus.WARNING]: 'Near capacity',
  [LineStatus.OVERLOADED]: 'Overloaded',
  [LineStatus.DE_ENERGIZED]: 'De-energized',
};

/** Preset swatches for the manual color override. A custom color is also
 *  available via the native color input alongside them. */
const COLOR_SWATCHES: { label: string; value: string }[] = [
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Slate', value: '#64748b' },
];

interface EdgeInspectorPanelProps {
  edge: PdnEdge;
  sourceLabel: string;
  targetLabel: string;
  onClose: () => void;
  onChangeLabel: (label: string) => void;
  onChangeField: (key: string, value: number | undefined) => void;
  onChangeColor: (color: string | undefined) => void;
}

/** Slide-in sidebar opened by double-clicking a connection. R and X map
 *  directly onto that edge's `data` — the same values `mockSolve` reads
 *  for loading %, voltage drop, and loss. Color is a manual override only
 *  (never fed into the solver); leaving it unset falls back to automatic
 *  status coloring (green/amber/red) after the next solve. */
export const EdgeInspectorPanel: React.FC<EdgeInspectorPanelProps> = ({
  edge,
  sourceLabel,
  targetLabel,
  onClose,
  onChangeLabel,
  onChangeField,
  onChangeColor,
}) => {
  const data = (edge.data ?? {}) as unknown as Record<string, unknown>;
  const result = edge.data?.result;
  const manualColor = edge.data?.color;

  return (
    <div className="absolute top-28 right-4 bottom-4 w-72 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">Connection</div>
          <div className="text-[10px] text-slate-400 truncate">
            {sourceLabel} → {targetLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-slate-400 hover:text-slate-700 text-lg leading-none"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Label</label>
          <input
            type="text"
            value={edge.data?.label ?? ''}
            onChange={(e) => onChangeLabel(e.target.value)}
            placeholder="Optional line label"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {FIELDS.map((field) => {
          const rawValue = data[field.key];
          return (
            <div key={field.key}>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                {field.label}
                {field.unit ? <span className="text-slate-400"> ({field.unit})</span> : null}
              </label>
              <input
                type="number"
                step={field.step ?? 1}
                min={0}
                value={typeof rawValue === 'number' ? rawValue : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onChangeField(field.key, v === '' ? undefined : Number(v));
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          );
        })}

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            Line color
          </label>
          <div className="flex items-center gap-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => onChangeColor(c.value)}
                className={[
                  'h-5 w-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform',
                  manualColor === c.value ? 'ring-2 ring-slate-900' : '',
                ].join(' ')}
                style={{ backgroundColor: c.value }}
              />
            ))}

            <label
              title="Custom color"
              className="h-5 w-5 rounded-full overflow-hidden ring-1 ring-inset ring-black/10 cursor-pointer relative"
              style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
            >
              <input
                type="color"
                value={manualColor ?? '#94a3b8'}
                onChange={(e) => onChangeColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>

            <button
              type="button"
              title="Auto color (by solve status)"
              onClick={() => onChangeColor(undefined)}
              className="h-5 w-5 rounded-full border border-dashed border-slate-400 flex items-center justify-center text-[9px] leading-none text-slate-500 hover:bg-slate-100"
            >
              A
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
            "A" resets to automatic status coloring (green/amber/red from
            the last solve) instead of a fixed color.
          </p>
        </div>

        {result && (
          <div className="mt-2 border-t border-slate-100 pt-3">
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">Last solve result</div>
            <div className="space-y-1 text-xs text-slate-600">
              <div>Status: {STATUS_LABEL[result.status]}</div>
              {result.loadingPct != null && <div>Loading: {result.loadingPct.toFixed(1)}%</div>}
              {result.currentA != null && <div>Current: {result.currentA.toFixed(2)} A</div>}
              {result.pFlowMw != null && <div>P flow: {result.pFlowMw.toFixed(3)} MW</div>}
              {result.lossMw != null && <div>Loss: {result.lossMw.toFixed(5)} MW</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
