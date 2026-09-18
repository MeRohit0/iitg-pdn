import type {
  RoadType,
  TrafficProfiles,
  TransportNetworkState,
  TransportNode,
  TransportNodeData,
  TransportRoad,
  TransportRoadData,
} from '../types/transport.types';
import { isRoadType, TIME_SLOTS } from '../types/transport.types';
import { normalizeProfiles, normalizeRoadHandles } from '../data/demoTransportNetwork';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeNode(raw: unknown, index: number): TransportNode {
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

  const dataRaw = isPlainObject(raw.data) ? raw.data : {};
  const label = typeof dataRaw.label === 'string' ? dataRaw.label : id;
  const numVoltage = typeof dataRaw.voltageKv === 'number' ? dataRaw.voltageKv : Number(dataRaw.voltageKv);
  const numPower = typeof dataRaw.powerDrawKw === 'number' ? dataRaw.powerDrawKw : Number(dataRaw.powerDrawKw);
  const data: TransportNodeData = {
    label,
    isEvChargingStation: Boolean(dataRaw.isEvChargingStation),
    voltageKv: Number.isFinite(numVoltage) ? numVoltage : 0.4,
    powerDrawKw: Number.isFinite(numPower) ? numPower : 0,
  };

  return {
    id,
    type: 'transportNode',
    position: { x: position.x, y: position.y },
    data,
  };
}

function normalizeRoad(raw: unknown, index: number, nodeIds: Set<string>): TransportRoad {
  if (!isPlainObject(raw)) {
    throw new Error(`Road at index ${index} is not an object.`);
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `road-import-${index}`;

  const source = raw.source;
  if (typeof source !== 'string' || !nodeIds.has(source)) {
    throw new Error(`Road "${id}" references an unknown source node "${String(source)}".`);
  }
  const target = raw.target;
  if (typeof target !== 'string' || !nodeIds.has(target)) {
    throw new Error(`Road "${id}" references an unknown target node "${String(target)}".`);
  }

  // Accept either edge.data or flat Excel-like fields on the road object.
  const dataRaw = isPlainObject(raw.data) ? raw.data : raw;
  const rawNum = dataRaw.roadNumber ?? raw.roadNumber;
  const parsedNum = typeof rawNum === 'number' ? rawNum : Number(rawNum);
  const roadNumber = Number.isFinite(parsedNum) ? parsedNum : index + 1;

  let roadType: RoadType | null = null;
  const rt = dataRaw.roadType ?? raw.roadType;
  if (rt == null || rt === '' || rt === 'null') {
    roadType = null;
  } else if (isRoadType(rt)) {
    roadType = rt;
  } else if (typeof rt === 'string') {
    const upper = rt.toUpperCase().replace(/\s+/g, '');
    if (upper === 'TYPE1' || upper === '1') roadType = 'T1';
    else if (upper === 'TYPE2' || upper === '2') roadType = 'T2';
    else if (upper === 'TYPE3' || upper === '3') roadType = 'T3';
    else if (isRoadType(upper)) roadType = upper;
    else throw new Error(`Road "${id}" has invalid roadType "${String(rt)}".`);
  } else {
    throw new Error(`Road "${id}" has invalid roadType.`);
  }

  const data: TransportRoadData = {
    roadNumber,
    roadType,
    label: typeof dataRaw.label === 'string' ? dataRaw.label : `R${roadNumber}`,
  };

  return normalizeRoadHandles({
    id,
    source,
    target,
    sourceHandle: typeof raw.sourceHandle === 'string' ? raw.sourceHandle : undefined,
    targetHandle: typeof raw.targetHandle === 'string' ? raw.targetHandle : undefined,
    type: 'transportRoad',
    data,
  });
}

function parseProfiles(raw: unknown): TrafficProfiles {
  if (!isPlainObject(raw)) {
    throw new Error('Missing or invalid "trafficProfiles" object (expected T1/T2/T3 arrays of length 96).');
  }
  for (const key of ['T1', 'T2', 'T3'] as const) {
    const arr = raw[key];
    if (!Array.isArray(arr)) {
      throw new Error(`trafficProfiles.${key} must be an array of ${TIME_SLOTS} numbers.`);
    }
    if (arr.length !== TIME_SLOTS) {
      throw new Error(
        `trafficProfiles.${key} must have length ${TIME_SLOTS} (got ${arr.length}).`
      );
    }
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== 'number' || !Number.isFinite(arr[i])) {
        throw new Error(`trafficProfiles.${key}[${i}] must be a finite number.`);
      }
    }
  }
  return normalizeProfiles(raw as unknown as TrafficProfiles);
}

/** Parses and validates a transport-network JSON string. */
export function parseImportedTransport(raw: string): TransportNetworkState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like valid JSON.");
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Expected a JSON object with "nodes", "roads", and "trafficProfiles".');
  }

  // Support "edges" as an alias for "roads" for familiarity with PDN exports.
  const rawRoads = parsed.roads ?? parsed.edges;
  const rawNodes = parsed.nodes;
  if (!Array.isArray(rawNodes)) throw new Error('Missing or invalid "nodes" array.');
  if (!Array.isArray(rawRoads)) throw new Error('Missing or invalid "roads" array.');
  if (rawNodes.length === 0) throw new Error('The "nodes" array is empty — nothing to load.');

  const nodes = rawNodes.map((n, i) => normalizeNode(n, i));
  const seenIds = new Set<string>();
  for (const n of nodes) {
    if (seenIds.has(n.id)) throw new Error(`Duplicate node id: "${n.id}".`);
    seenIds.add(n.id);
  }

  const roads = rawRoads.map((e, i) => normalizeRoad(e, i, seenIds));
  const roadNumbers = new Set<number>();
  for (const road of roads) {
    const num = road.data?.roadNumber;
    if (typeof num !== 'number') throw new Error(`Road "${road.id}" is missing roadNumber.`);
    if (roadNumbers.has(num)) throw new Error(`Duplicate roadNumber: ${num}.`);
    roadNumbers.add(num);
  }

  const trafficProfiles = parseProfiles(parsed.trafficProfiles);
  const schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;

  return { schemaVersion, nodes, roads, trafficProfiles };
}

/** Pretty-print transport network for download / clipboard. */
export function serializeTransport(
  nodes: TransportNode[],
  roads: TransportRoad[],
  trafficProfiles: TrafficProfiles,
  schemaVersion = 1
): string {
  const payload: TransportNetworkState = {
    schemaVersion,
    nodes,
    roads,
    trafficProfiles,
  };
  return JSON.stringify(payload, null, 2);
}
