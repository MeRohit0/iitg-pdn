import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface FourSideHandlesProps {
  /** Tailwind classes controlling handle dot size/color. */
  className?: string;
}

/**
 * Renders a connection handle on all four sides of a node. Paired with
 * `connectionMode="loose"` on <ReactFlow>, this lets a user drag a new
 * connection starting from — or ending on — whichever side is closest to
 * the other node, instead of always routing through a fixed top/bottom
 * pair.
 *
 * Each handle is declared `type="source"`, but that doesn't limit it to
 * outgoing connections: in loose mode React Flow doesn't enforce
 * source/target roles by a handle's declared type, so every handle here
 * works identically for starting or completing a connection. Each needs a
 * unique `id` since a node has four handles of the same declared type.
 */
export const FourSideHandles: React.FC<FourSideHandlesProps> = React.memo(({ className }) => {
  const base = className ?? '!bg-slate-500 !h-2 !w-2';
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={base} />
      <Handle id="right" type="source" position={Position.Right} className={base} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={base} />
      <Handle id="left" type="source" position={Position.Left} className={base} />
    </>
  );
});
