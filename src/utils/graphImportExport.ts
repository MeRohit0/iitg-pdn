import { ComponentType, type ComponentParams, type PdnEdge, type PdnNode } from '../types/graph.types';

const VALID_COMPONENT_TYPES = new Set<string>(Object.values(ComponentType));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeNode(raw: unknown, index: number): PdnNode {
  if (!isPlainObject(raw)) {
    throw new Error(`Node at index ${index} is not an object.`);
  }
  const id = raw.id;
  if (typeof id !== 'string' || !id) {
    throw new Error(`Node at index ${index} is missing a valid "id".`);
  }

  const position = raw.position;
  if (!isPlainObject(position) || typeof position.x !== 'number' || typeof position.y !== 'number') {
    throw new Error(`Node "${id}" is missing a valid "position" ({ x, y }).`);
  }

  const data = raw.data;
  if (!isPlainObject(data)) {
    throw new Error(`Node "${id}" is missing "data".`);
  }
  const componentType = data.componentType;
  if (typeof componentType !== 'string' || !VALID_COMPONENT_TYPES.has(componentType)) {
    throw new Error(`Node "${id}" has an unrecognized componentType: ${String(componentType)}.`);
  }
  const label = typeof data.label === 'string' ? data.label : id;
  // Imported JSON is user-supplied and may not match any single
  // ComponentParams variant's exact required-field set (e.g. a
  // GeneratorParams' required pMaxMw). Every consumer already reads these
  // fields defensively (`as { pMaxMw?: number }`, etc.), so this cast is
  // safe — we're intentionally lenient here rather than rejecting a whole
  // import over one node's incomplete params.
  const params = (isPlainObject(data.params) ? data.params : {}) as unknown as ComponentParams;

  const node: PdnNode = {
    id,
    type: (typeof raw.type === 'string' ? raw.type : componentType) as ComponentType,
    position: { x: position.x, y: position.y },
    data: {
      label,
      componentType: componentType as ComponentType,
      params,
      // Stale solve results shouldn't carry over into a freshly loaded graph.
    },
  };
  return node;
}

function normalizeEdge(raw: unknown, index: number, nodeIds: Set<string>): PdnEdge {
  if (!isPlainObject(raw)) {
    throw new Error(`Line at index ${index} is not an object.`);
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `edge-import-${index}`;

  const source = raw.source;
  if (typeof source !== 'string' || !nodeIds.has(source)) {
    throw new Error(`Line "${id}" references an unknown source node "${String(source)}".`);
  }
  const target = raw.target;
  if (typeof target !== 'string' || !nodeIds.has(target)) {
    throw new Error(`Line "${id}" references an unknown target node "${String(target)}".`);
  }

  const data = isPlainObject(raw.data) ? raw.data : {};

  const edge: PdnEdge = {
    id,
    source,
    target,
    sourceHandle: typeof raw.sourceHandle === 'string' ? raw.sourceHandle : undefined,
    targetHandle: typeof raw.targetHandle === 'string' ? raw.targetHandle : undefined,
    type: 'powerLine',
    data: {
      label: typeof data.label === 'string' ? data.label : undefined,
      resistanceOhm: typeof data.resistanceOhm === 'number' ? data.resistanceOhm : 0.1,
      reactanceOhm: typeof data.reactanceOhm === 'number' ? data.reactanceOhm : 0.1,
      maxCurrentA: typeof data.maxCurrentA === 'number' ? data.maxCurrentA : 400,
      lengthKm: typeof data.lengthKm === 'number' ? data.lengthKm : undefined,
      color: typeof data.color === 'string' ? data.color : undefined,
    },
  };
  return edge;
}

export interface ParsedImportResult {
  nodes: PdnNode[];
  edges: PdnEdge[];
}

/** Parses and validates a graph JSON string, raising a specific,
 *  human-readable Error on the first problem found (bad JSON, wrong shape,
 *  unknown component type, dangling edge reference, duplicate id, etc.)
 *  rather than silently producing a broken canvas. */
export function parseImportedGraph(raw: string): ParsedImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like valid JSON.");
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Expected a JSON object with "nodes" and "edges" arrays.');
  }

  const rawNodes = parsed.nodes;
  const rawEdges = parsed.edges;
  if (!Array.isArray(rawNodes)) throw new Error('Missing or invalid "nodes" array.');
  if (!Array.isArray(rawEdges)) throw new Error('Missing or invalid "edges" array.');
  if (rawNodes.length === 0) throw new Error('The "nodes" array is empty — nothing to load.');

  const nodes = rawNodes.map((n, i) => normalizeNode(n, i));

  const seenIds = new Set<string>();
  for (const n of nodes) {
    if (seenIds.has(n.id)) throw new Error(`Duplicate node id: "${n.id}".`);
    seenIds.add(n.id);
  }

  const edges = rawEdges.map((e, i) => normalizeEdge(e, i, seenIds));

  return { nodes, edges };
}

/** Serializes the current graph to pretty-printed JSON. Drops transient
 *  solve results — an exported file should represent the topology and
 *  parameters, not a stale snapshot of the last solve. */
export function serializeGraph(nodes: PdnNode[], edges: PdnEdge[]): string {
  const cleanNodes = nodes.map((n) => ({ ...n, data: { ...n.data, result: undefined } }));
  const cleanEdges = edges.map((e) => ({ ...e, data: { ...e.data, result: undefined } }));
  return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }, null, 2);
}
