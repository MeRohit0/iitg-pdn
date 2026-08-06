import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { ComponentType, type PdnNodeData } from '../../types/graph.types';

type PdnNodeProps = NodeProps & { data: PdnNodeData };

// Every node type gets both a source and a target handle so any node can be
// wired to any number of other nodes in either direction — substations can
// receive (e.g. a backfeed/tie line), loads can pass through to another
// load, etc. Nothing here limits how many edges can attach to one handle;
// draw as many connections from/to a single node as the topology needs.

export const SubstationNode: React.FC<PdnNodeProps> = ({ data, selected }) => (
  <BaseNode data={data} selected={selected} icon="⛨" accentColorClass="border-indigo-600" />
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

/** Registry passed to <ReactFlow nodeTypes={...} />. */
export const nodeTypes: Record<ComponentType, React.FC<PdnNodeProps>> = {
  [ComponentType.SUBSTATION]: SubstationNode,
  [ComponentType.TRANSFORMER]: TransformerNode,
  [ComponentType.GENERATOR]: GeneratorNode,
  [ComponentType.LOAD]: LoadNode,
  [ComponentType.FEEDER]: FeederNode,
};
