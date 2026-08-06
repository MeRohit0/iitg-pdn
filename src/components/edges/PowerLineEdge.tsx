import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
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
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const status = data?.result?.status ?? LineStatus.IDLE;
  // Index access always resolves here since STATUS_STYLE covers every
  // LineStatus member, but we fall back explicitly for strict-mode builds
  // (noUncheckedIndexedAccess / exactOptionalPropertyTypes) that widen the
  // inferred type to `... | undefined`.
  const style = STATUS_STYLE[status] ?? FALLBACK_STYLE;
  const loadingPct = data?.result?.loadingPct;

  // BaseEdge's `markerEnd` prop type doesn't accept an explicit `undefined`
  // under `exactOptionalPropertyTypes`, so only spread it in when present.
  const baseEdgeProps = markerEnd ? { markerEnd } : {};

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        {...baseEdgeProps}
        style={{
          stroke: style.stroke,
          strokeWidth: strokeWidthFor(loadingPct),
          ...(style.dash ? { strokeDasharray: style.dash } : {}),
        }}
      />
      {loadingPct != null && (
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
    </>
  );
};

export const edgeTypes = {
  powerLine: PowerLineEdge,
};
