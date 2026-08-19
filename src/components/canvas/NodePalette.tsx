import React from 'react';
import { ComponentType } from '../../types/graph.types';
import { TYPE_ACCENT_CLASS, TYPE_ICONS, TYPE_LABELS } from '../../utils/nodeDefaults';

const PALETTE_TYPES: ComponentType[] = [
  ComponentType.SUBSTATION,
  ComponentType.TRANSFORMER,
  ComponentType.GENERATOR,
  ComponentType.LOAD,
  ComponentType.FEEDER,
  ComponentType.NODE,
];

interface NodePaletteProps {
  /** The type currently armed for click-to-place, if any. */
  activeType: ComponentType | null;
  onSelectType: (type: ComponentType) => void;
}

/** Left-side "Add node" panel. Click a type to arm it, then click anywhere
 *  on the canvas to drop a node of that type there (click the same button
 *  again, or press Esc, to cancel). Positioning, wiring, and deletion are
 *  then handled the same as any other node. */
export const NodePalette: React.FC<NodePaletteProps> = ({ activeType, onSelectType }) => (
  <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 rounded-md bg-white/95 border border-slate-200 shadow px-2 py-2">
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1">
      Add node
    </span>
    {PALETTE_TYPES.map((type) => {
      const isActive = activeType === type;
      return (
        <button
          key={type}
          type="button"
          onClick={() => onSelectType(type)}
          className={[
            'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
            isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-slate-50',
            isActive ? '' : TYPE_ACCENT_CLASS[type],
          ].join(' ')}
        >
          <span className="text-sm leading-none">{TYPE_ICONS[type]}</span>
          {TYPE_LABELS[type]}
        </button>
      );
    })}
  </div>
);
