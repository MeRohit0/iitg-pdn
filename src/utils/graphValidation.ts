import { ComponentType, type PdnEdge, type PdnNode } from '../types/graph.types';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

const LEAF_ALLOWED = new Set<ComponentType>([ComponentType.LOAD, ComponentType.GENERATOR]);

/**
 * Structural checks only (no electrical solve) — orphan nodes, dangling
 * edges, missing slack bus, disconnected islands. Runs entirely client-side
 * so it can be called on every canvas edit without a network round trip.
 */
export function validateGraph(nodes: PdnNode[], edges: PdnEdge[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_NODE_ID',
        message: `Node id '${n.id}' appears more than once.`,
        nodeId: n.id,
      });
    }
    seen.add(n.id);
  }

  for (const e of edges) {
    if (!nodeIds.has(e.source)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_EDGE_SOURCE',
        message: `Edge '${e.id}' references unknown source node '${e.source}'.`,
        edgeId: e.id,
      });
    }
    if (!nodeIds.has(e.target)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_EDGE_TARGET',
        message: `Edge '${e.id}' references unknown target node '${e.target}'.`,
        edgeId: e.id,
      });
    }
    if (e.source === e.target) {
      issues.push({
        severity: 'error',
        code: 'SELF_LOOP_EDGE',
        message: `Edge '${e.id}' connects node '${e.source}' to itself.`,
        edgeId: e.id,
      });
    }
  }

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  for (const n of nodes) {
    const d = degree.get(n.id) ?? 0;
    if (d === 0) {
      issues.push({
        severity: 'error',
        code: 'ORPHAN_NODE',
        message: `Node '${n.id}' (${n.data.componentType}) has no connections.`,
        nodeId: n.id,
      });
    }
    if (LEAF_ALLOWED.has(n.data.componentType) && d > 1) {
      issues.push({
        severity: 'warning',
        code: 'UNEXPECTED_MULTI_CONNECTION',
        message: `${n.data.componentType} node '${n.id}' has ${d} connections; loads/generators are typically leaves.`,
        nodeId: n.id,
      });
    }
  }

  const substations = nodes.filter((n) => n.data.componentType === ComponentType.SUBSTATION);
  if (substations.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_SUBSTATION',
      message: 'Graph contains no substation node; there is no slack/reference bus.',
    });
  }

  if (nodeIds.size > 0) {
    const adjacency = new Map<string, Set<string>>();
    for (const id of nodeIds) adjacency.set(id, new Set());
    for (const e of edges) {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
        adjacency.get(e.source)!.add(e.target);
        adjacency.get(e.target)!.add(e.source);
      }
    }

    const start = nodes[0].id;
    const visited = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const next of adjacency.get(cur) ?? []) {
        if (!visited.has(next)) stack.push(next);
      }
    }

    for (const id of nodeIds) {
      if (!visited.has(id)) {
        issues.push({
          severity: 'error',
          code: 'DISCONNECTED_ISLAND',
          message: `Node '${id}' is not reachable from the rest of the network.`,
          nodeId: id,
        });
      }
    }
  }

  return {
    isValid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
