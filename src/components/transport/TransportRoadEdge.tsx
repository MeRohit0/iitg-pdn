import React, { useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import {
  ROAD_TYPE_COLORS,
  type TransportRoadData,
} from '../../types/transport.types';

type Props = EdgeProps & { data?: TransportRoadData };

/** Road edge colored by T1/T2/T3 (green/orange/red); gray when unset. */
export const TransportRoadEdge: React.FC<Props> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}) => {
  const { deleteElements } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const roadType = data?.roadType ?? null;
  const strokeColor = roadType ? ROAD_TYPE_COLORS[roadType] : ROAD_TYPE_COLORS.default;
  const label = data?.label ?? (data?.roadNumber != null ? `R${data.roadNumber}` : '');

  const baseEdgeProps = markerEnd ? { markerEnd } : {};

  const handleDelete = useCallback(() => {
    deleteElements({ edges: [{ id }] });
  }, [id, deleteElements]);

  return (
    <>
      {/* 1. Selection Highlight Glow */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#6366f1"
          strokeWidth={13}
          strokeOpacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* 2. Road Outer Kerb / Shoulders */}
      <path
        d={edgePath}
        fill="none"
        stroke="#1e293b"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />

      {/* 3. Asphalt Road Bed (BaseEdge handles clicks/events) */}
      <BaseEdge
        id={id}
        path={edgePath}
        {...baseEdgeProps}
        style={{
          stroke: '#334155',
          strokeWidth: 5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />

      {/* 4. Dashed Centerline (Colored by Road Type T1/T2/T3) */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        strokeLinecap="butt"
        style={{ pointerEvents: 'none' }}
      />

      {/* 5. Highway Shield Road Label Badge & Quick Actions */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {label && (
            <span
              className="flex items-center gap-1 rounded bg-slate-900/90 backdrop-blur-xs border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md"
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: strokeColor }}
              />
              {label}
            </span>
          )}
          {selected && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded bg-white border border-rose-300 text-rose-600 text-[10px] font-medium px-1.5 py-0.5 shadow hover:bg-rose-50"
              title="Delete road"
            >
              Delete
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export const transportEdgeTypes = {
  transportRoad: TransportRoadEdge,
};
