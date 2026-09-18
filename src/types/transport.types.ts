/**
 * Transportation System domain types.
 * Parallel to PDN graph types — kept separate so PDN and transport never share state.
 */

import type { Node, Edge } from '@xyflow/react';

export type RoadType = 'T1' | 'T2' | 'T3';

export const ROAD_TYPES: RoadType[] = ['T1', 'T2', 'T3'];

export const TIME_SLOTS = 96; // 24h × 4 (15-minute intervals)

export const ROAD_TYPE_COLORS: Record<RoadType | 'default', string> = {
  default: '#94a3b8', // slate-400 — unset
  T1: '#22c55e', // green — Type 1
  T2: '#f59e0b', // orange — Type 2
  T3: '#ef4444', // red — Type 3
};

export const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  T1: 'Type 1',
  T2: 'Type 2',
  T3: 'Type 3',
};

export interface TransportNodeData {
  label: string;
  isEvChargingStation: boolean;
  voltageKv: number;
  powerDrawKw: number;
  [key: string]: unknown;
}

export interface TransportRoadData {
  roadNumber: number;
  roadType: RoadType | null;
  label?: string;
  [key: string]: unknown;
}

export type TransportNode = Node<TransportNodeData, 'transportNode'>;
export type TransportRoad = Edge<TransportRoadData>;

/** Shared 96-slot vehicle-count curves keyed by road type. */
export interface TrafficProfiles {
  T1: number[];
  T2: number[];
  T3: number[];
}

export interface TransportNetworkState {
  schemaVersion: number;
  nodes: TransportNode[];
  roads: TransportRoad[];
  trafficProfiles: TrafficProfiles;
}

export function isRoadType(v: unknown): v is RoadType {
  return v === 'T1' || v === 'T2' || v === 'T3';
}

/** Empty 96-slot profiles (zeros). */
export function emptyTrafficProfiles(): TrafficProfiles {
  const zeros = () => Array.from({ length: TIME_SLOTS }, () => 0);
  return { T1: zeros(), T2: zeros(), T3: zeros() };
}

/** Vehicle count for a road at a 1-based time slot, using its type profile. */
export function trafficAt(
  profiles: TrafficProfiles,
  roadType: RoadType | null | undefined,
  timeSlot1Based: number
): number {
  if (!roadType) return 0;
  const idx = Math.max(0, Math.min(TIME_SLOTS - 1, timeSlot1Based - 1));
  const series = profiles[roadType];
  return series[idx] ?? 0;
}

/** Clock label for a 1-based slot (1 = 00:00, 2 = 00:15, …). */
export function timeSlotToClock(slot1Based: number): string {
  const minutes = (slot1Based - 1) * 15;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
