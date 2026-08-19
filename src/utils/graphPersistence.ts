import type { PdnEdge, PdnNode } from '../types/graph.types';

const STORAGE_KEY = 'project-pdn:graph-state:v1';

interface PersistedGraph {
  nodes: PdnNode[];
  edges: PdnEdge[];
  savedAt: string;
}

/** Reads the last-saved graph from localStorage. Returns null on first
 *  visit, on parse failure, or in environments without localStorage (SSR,
 *  privacy mode with storage blocked) — callers should fall back to a
 *  default topology in that case. */
export function loadPersistedGraph(): { nodes: PdnNode[]; edges: PdnEdge[] } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedGraph>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return { nodes: parsed.nodes, edges: parsed.edges };
  } catch {
    return null;
  }
}

/** Persists the current graph. Failures (quota exceeded, storage disabled)
 *  are swallowed — losing autosave shouldn't crash the canvas. */
export function savePersistedGraph(nodes: PdnNode[], edges: PdnEdge[]): void {
  try {
    const payload: PersistedGraph = { nodes, edges, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore — e.g. storage disabled or quota exceeded.
  }
}

export function clearPersistedGraph(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
