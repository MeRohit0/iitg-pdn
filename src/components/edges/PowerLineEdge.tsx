import React, { useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { LineStatus, type PdnEdgeData } from '../../types/graph.types';

type PdnEdgeProps = EdgeProps & { data: PdnEdgeData };

const STATUS_STYLE: Record<LineStatus, { stroke: string; dash?: string; label: string }> = {
  [LineStatus.IDLE]: { stroke: '#94a3b8', label: 'Unsolved' },
  [LineStatus.NORMAL]: { stroke: '#22c55e', label: 'Normal' },
  [LineStatus.WARNING]: { stroke: '#f59e0b', label: 'Near capacity' },
  [LineStatus.OVERLOADED]: { stroke: '#ef4444', label: 'Overloaded' },
  [LineStatus.DE_ENERGIZED]: { stroke: '#cbd5e1', dash: '4 4', label: 'De-energized' },
};

const FALLBACK_STYLE = STATUS_STYLE[LineStatus.IDLE];

/** Preset swatches shown in the on-edge color picker. Users can also pick
 *  a custom color via the native color input at the end of the row. */
const COLOR_SWATCHES: { label: string; value: string }[] = [
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Slate', value: '#64748b' },
];

function strokeWidthFor(loadingPct: number | undefined): number {
  if (loadingPct == null) return 2;
  if (loadingPct >= 100) return 5;
  if (loadingPct >= 85) return 3.5;
  return 2;
}

export const PowerLineEdge: React.FC<PdnEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}) => {
  const { setEdges, deleteElements } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const manualColor = data?.color;
  const status = data?.result?.status ?? LineStatus.IDLE;
  const statusStyle = STATUS_STYLE[status] ?? FALLBACK_STYLE;
  const strokeColor = manualColor ?? statusStyle.stroke;
  const loadingPct = data?.result?.loadingPct;

  // BaseEdge's `markerEnd` prop type doesn't accept an explicit `undefined`
  // under `exactOptionalPropertyTypes`, so only spread it in when present.
  const baseEdgeProps = markerEnd ? { markerEnd } : {};

  const setColor = useCallback(
    (color: string | undefined) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, color } } : e))
      );
    },
    [id, setEdges]
  );

  const handleDelete = useCallback(() => {
    deleteElements({ edges: [{ id }] });
  }, [id, deleteElements]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        {...baseEdgeProps}
        style={{
          stroke: strokeColor,
          strokeWidth: strokeWidthFor(loadingPct) + (selected ? 1.5 : 0),
          ...(statusStyle.dash && !manualColor ? { strokeDasharray: statusStyle.dash } : {}),
        }}
      />

      {loadingPct != null && !selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium shadow border border-slate-200"
          >
            {loadingPct.toFixed(0)}%
          </div>
        </EdgeLabelRenderer>
      )}

      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan flex items-center gap-1 rounded-full bg-white border border-slate-200 shadow-lg px-1.5 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setColor(c.value)}
                className={[
                  'h-4 w-4 rounded-full ring-1 ring-inset ring-black/10 hover:scale-125 transition-transform',
                  manualColor === c.value ? 'ring-2 ring-slate-900' : '',
                ].join(' ')}
                style={{ backgroundColor: c.value }}
              />
            ))}

            <label
              title="Custom color"
              className="h-4 w-4 rounded-full overflow-hidden ring-1 ring-inset ring-black/10 cursor-pointer relative"
              style={{
                background:
                  'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              }}
            >
              <input
                type="color"
                value={manualColor ?? '#94a3b8'}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>

            <button
              type="button"
              title="Auto color (by solve status)"
              onClick={() => setColor(undefined)}
              className="h-4 w-4 rounded-full border border-dashed border-slate-400 flex items-center justify-center text-[8px] leading-none text-slate-500 hover:bg-slate-100"
            >
              A
            </button>

            <span className="mx-0.5 h-4 w-px bg-slate-200" />

            <button
              type="button"
              title="Delete connection"
              onClick={handleDelete}
              className="h-4 w-4 rounded-full flex items-center justify-center text-sm leading-none text-red-500 hover:text-white hover:bg-red-500 transition-colors"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export const edgeTypes = {
  powerLine: PowerLineEdge,
};
