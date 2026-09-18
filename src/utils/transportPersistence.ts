import type {
  TrafficProfiles,
  TransportNetworkState,
  TransportNode,
  TransportRoad,
} from '../types/transport.types';
import { normalizeProfiles, normalizeRoadHandles } from '../data/demoTransportNetwork';

const STORAGE_KEY = 'project-pdn:transport-state:v1';

interface PersistedTransport {
  schemaVersion: number;
  nodes: TransportNode[];
  roads: TransportRoad[];
  trafficProfiles: TrafficProfiles;
  savedAt: string;
}

export function loadPersistedTransport(): TransportNetworkState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTransport>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.roads)) return null;
    if (!parsed.trafficProfiles) return null;
    return {
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
      nodes: parsed.nodes,
      roads: parsed.roads.map(normalizeRoadHandles),
      trafficProfiles: normalizeProfiles(parsed.trafficProfiles),
    };
  } catch {
    return null;
  }
}

export function savePersistedTransport(
  nodes: TransportNode[],
  roads: TransportRoad[],
  trafficProfiles: TrafficProfiles,
  schemaVersion = 1
): void {
  try {
    const payload: PersistedTransport = {
      schemaVersion,
      nodes,
      roads,
      trafficProfiles,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / privacy-mode failures.
  }
}

export function clearPersistedTransport(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
