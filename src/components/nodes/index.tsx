import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { ComponentType, type PdnNodeData } from '../../types/graph.types';

type PdnNodeProps = NodeProps & { data: PdnNodeData };

export const SubstationNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode
    data={data}
    selected={selected}
    icon="⛨"
    accentColorClass="border-indigo-600"
    showTargetHandle={false}
  />
);

export const TransformerNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="⏚" accentColorClass="border-amber-500" />
);

export const GeneratorNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="⚡" accentColorClass="border-emerald-600" />
);

export const LoadNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode
    data={data}
    selected={selected}
    icon="🏠"
    accentColorClass="border-rose-500"
    showSourceHandle={false}
  />
);

export const FeederNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="◆" accentColorClass="border-slate-400" />
);

/** Registry passed to <ReactFlow nodeTypes={...} />. */
export const nodeTypes: Record<ComponentType, React.FC<PdnNodeProps>> = {
  [ComponentType.SUBSTATION]: SubstationNode,
  [ComponentType.TRANSFORMER]: TransformerNode,
  [ComponentType.GENERATOR]: GeneratorNode,
  [ComponentType.LOAD]: LoadNode,
  [ComponentType.FEEDER]: FeederNode,
};
