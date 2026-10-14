import demoRaw from './demoTransportNetwork.json';
import type {
  TrafficProfiles,
  TransportNetworkState,
  TransportNode,
  TransportRoad,
} from '../types/transport.types';
import { isRoadType, TIME_SLOTS } from '../types/transport.types';

/** Deep-clone the bundled demo network (Excel-derived 41 nodes / 140 roads). */
export function getDemoTransportNetwork(): TransportNetworkState {
  const raw = demoRaw as TransportNetworkState;
  return {
    schemaVersion: raw.schemaVersion ?? 1,
    nodes: structuredClone(raw.nodes) as TransportNode[],
    roads: (structuredClone(raw.roads) as TransportRoad[]).map(normalizeRoadHandles),
    trafficProfiles: normalizeProfiles(raw.trafficProfiles),
  };
}

export function normalizeRoadHandles(road: TransportRoad): TransportRoad {
  return {
    ...road,
    type: road.type ?? 'transportRoad',
    sourceHandle: road.sourceHandle ?? 'bottom',
    targetHandle: road.targetHandle ?? 'top',
    data: {
      roadNumber: road.data?.roadNumber ?? 0,
      roadType: isRoadType(road.data?.roadType) ? road.data.roadType : null,
      label: road.data?.label,
    },
  };
}

export function normalizeProfiles(raw: Partial<TrafficProfiles> | undefined): TrafficProfiles {
  const pad = (arr: number[] | undefined): number[] => {
    const base = Array.isArray(arr) ? arr.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)) : [];
    if (base.length >= TIME_SLOTS) return base.slice(0, TIME_SLOTS);
    return [...base, ...Array.from({ length: TIME_SLOTS - base.length }, () => 0)];
  };
  return {
    T1: pad(raw?.T1),
    T2: pad(raw?.T2),
    T3: pad(raw?.T3),
  };
}
