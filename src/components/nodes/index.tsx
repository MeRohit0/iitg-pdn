import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { DotNode } from './DotNode';
import { SubstationBarNode } from './SubstationBarNode';
import { ComponentType, type PdnNodeData } from '../../types/graph.types';

type PdnNodeProps = NodeProps & { data: PdnNodeData };

// Substation and the generic compact Node get their own dedicated visuals
// (red bar / small dot, single-line-diagram style). Transformer, Generator,
// and Load keep the full labeled card since those tend to be fewer in
// number and benefit from showing more detail inline.

export const SubstationNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <SubstationBarNode data={data} selected={selected} />
);

export const TransformerNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="⏚" accentColorClass="border-amber-500" />
);

export const GeneratorNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="⚡" accentColorClass="border-emerald-600" />
);

export const LoadNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="🏠" accentColorClass="border-rose-500" />
);

export const FeederNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="◆" accentColorClass="border-slate-400" />
);

export const GenericNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <DotNode data={data} selected={selected} />
);

/** Registry passed to <ReactFlow nodeTypes={...} />. */
export const nodeTypes: Record<ComponentType, React.FC<PdnNodeProps>> = {
  [ComponentType.SUBSTATION]: SubstationNode,
  [ComponentType.TRANSFORMER]: TransformerNode,
  [ComponentType.GENERATOR]: GeneratorNode,
  [ComponentType.LOAD]: LoadNode,
  [ComponentType.FEEDER]: FeederNode,
  [ComponentType.NODE]: GenericNode,
};
