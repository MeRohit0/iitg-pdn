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

function strokeWidthFor(loadingPct: number | undefined): number {
  if (loadingPct == null) return 2;
  if (loadingPct >= 100) return 5;
  if (loadingPct >= 85) return 3.5;
  return 2;
}

/**
 * Renders the line itself, colored by manual override (set from
 * EdgeInspectorPanel — double-click the line) or, failing that, by solve
 * status. Selecting the line (single click) shows just a small delete
 * button at its midpoint; double-click for the full properties sidebar
 * (R, X, color, label).
 */
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
  const { deleteElements } = useReactFlow();

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
