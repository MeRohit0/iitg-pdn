import React from 'react';
import { ComponentType, type PdnNode } from '../../types/graph.types';
import { TYPE_ICONS, TYPE_LABELS } from '../../utils/nodeDefaults';

type FieldType = 'number' | 'checkbox';

interface FieldDescriptor {
  key: string; // key inside node.data.params
  label: string;
  type: FieldType;
  unit?: string;
  step?: number;
}

/** Fields shown for every component type, on top of its type-specific ones. */
const COMMON_FIELDS: FieldDescriptor[] = [
  { key: 'baseVoltageKv', label: 'Base voltage', type: 'number', unit: 'kV', step: 0.1 },
  { key: 'minVoltagePu', label: 'Min voltage', type: 'number', unit: 'p.u.', step: 0.01 },
  { key: 'maxVoltagePu', label: 'Max voltage', type: 'number', unit: 'p.u.', step: 0.01 },
];

/** Type-specific fields — this is the single place to add/remove a
 *  parameter from the inspector; nothing else needs to change. */
const TYPE_FIELDS: Record<ComponentType, FieldDescriptor[]> = {
  [ComponentType.SUBSTATION]: [
    { key: 'isSlackBus', label: 'Slack / reference bus', type: 'checkbox' },
    { key: 'maxImportMw', label: 'Max import', type: 'number', unit: 'MW', step: 0.1 },
  ],
  [ComponentType.TRANSFORMER]: [
    { key: 'ratedPowerMva', label: 'Rated power', type: 'number', unit: 'MVA', step: 0.1 },
    { key: 'primaryKv', label: 'Primary voltage', type: 'number', unit: 'kV', step: 0.1 },
    { key: 'secondaryKv', label: 'Secondary voltage', type: 'number', unit: 'kV', step: 0.1 },
    { key: 'impedancePct', label: 'Impedance', type: 'number', unit: '%', step: 0.1 },
    { key: 'tapRatio', label: 'Tap ratio', type: 'number', step: 0.01 },
  ],
  [ComponentType.GENERATOR]: [
    { key: 'pMaxMw', label: 'Max active power', type: 'number', unit: 'MW', step: 0.1 },
    { key: 'pMinMw', label: 'Min active power', type: 'number', unit: 'MW', step: 0.1 },
    { key: 'qMaxMvar', label: 'Max reactive power', type: 'number', unit: 'MVAr', step: 0.1 },
    { key: 'qMinMvar', label: 'Min reactive power', type: 'number', unit: 'MVAr', step: 0.1 },
    { key: 'costPerMwh', label: 'Generation cost', type: 'number', unit: '$/MWh', step: 1 },
  ],
  [ComponentType.LOAD]: [
    { key: 'pDemandMw', label: 'Load — active power', type: 'number', unit: 'MW', step: 0.1 },
    { key: 'qDemandMvar', label: 'Load — reactive power', type: 'number', unit: 'MVAr', step: 0.1 },
    { key: 'isCritical', label: 'Critical load', type: 'checkbox' },
  ],
  [ComponentType.FEEDER]: [],
};

interface NodeInspectorPanelProps {
  node: PdnNode;
  onClose: () => void;
  onChangeLabel: (label: string) => void;
  onChangeParam: (key: string, value: number | boolean | undefined) => void;
}

/** Slide-in sidebar opened by double-clicking a node. Every field maps
 *  directly onto that node's `data.params`, so edits here are exactly what
 *  the (mock) solver reads from when you next click "Run Optimization". */
export const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = ({
  node,
  onClose,
  onChangeLabel,
  onChangeParam,
}) => {
  const type = node.data.componentType;
  const params = node.data.params as unknown as Record<string, unknown>;
  const fields = [...COMMON_FIELDS, ...TYPE_FIELDS[type]];
  const result = node.data.result;

  return (
    <div className="absolute top-28 right-4 bottom-4 w-72 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none shrink-0">{TYPE_ICONS[type]}</span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate">{TYPE_LABELS[type]}</div>
            <div className="text-[10px] text-slate-400 truncate">{node.id}</div>
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
            value={node.data.label}
            onChange={(e) => onChangeLabel(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {fields.map((field) => {
          const rawValue = params[field.key];

          if (field.type === 'checkbox') {
            return (
              <label
                key={field.key}
                className="flex items-center justify-between text-sm text-slate-700"
              >
                {field.label}
                <input
                  type="checkbox"
                  checked={Boolean(rawValue)}
                  onChange={(e) => onChangeParam(field.key, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            );
          }

          return (
            <div key={field.key}>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                {field.label}
                {field.unit ? <span className="text-slate-400"> ({field.unit})</span> : null}
              </label>
              <input
                type="number"
                step={field.step ?? 1}
                value={typeof rawValue === 'number' ? rawValue : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onChangeParam(field.key, v === '' ? undefined : Number(v));
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          );
        })}

        {result && (
          <div className="mt-2 border-t border-slate-100 pt-3">
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">Last solve result</div>
            <div className="space-y-1 text-xs text-slate-600">
              {result.voltagePu != null && (
                <div>
                  Voltage: {result.voltagePu.toFixed(3)} p.u.
                  {result.voltageKv != null ? ` (${result.voltageKv.toFixed(2)} kV)` : ''}
                </div>
              )}
              {result.pInjectionMw != null && <div>P injection: {result.pInjectionMw.toFixed(3)} MW</div>}
              {result.qInjectionMvar != null && (
                <div>Q injection: {result.qInjectionMvar.toFixed(3)} MVAr</div>
              )}
              <div>Energized: {result.isEnergized ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
