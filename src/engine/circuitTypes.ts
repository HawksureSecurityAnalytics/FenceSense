export interface Post { id: string; x: number; y: number; }
export interface Segment { id: string; postA: string; postB: string; }
export type BridgeType = 'ht' | 'earth';
export type BridgeSide = 'left' | 'right';
export interface Bridge {
  id: string;
  segmentId: string;
  strandIndex: number;
  type: BridgeType;
  side: BridgeSide;
}
export interface FaultItem { id: string; kind: 'bridge' | 'strand'; }

// ── Simulation types ──────────────────────────────────────────────────────────

/** A node in the electrical network graph */
export interface NetNode {
  id: string;
  label: string;
  /** Estimated position along fence for display (0-1) */
  normX: number;
  strandIndex: number;
}

/** An edge/element connecting two NetNodes */
export interface NetEdge {
  id: string;
  fromNode: string;
  toNode: string;
  /** Resistance in Ohms */
  resistance: number;
  kind: 'strand' | 'bridge' | 'energizer_out' | 'energizer_return';
  /** Reference back to the source Bridge or strand id */
  sourceId: string;
  label: string;
}

/** Full result from the nodal voltage simulation */
export interface SimResult {
  /** Voltage at each node (nodeId → kV) */
  nodeVoltages: Record<string, number>;
  /** Current through each edge (edgeId → Amps) */
  edgeCurrents: Record<string, number>;
  /** Power dissipated at each edge (edgeId → Watts) */
  edgePower: Record<string, number>;
  /** Fault candidates sorted by suspicion score (highest first) */
  faultCandidates: FaultCandidate[];
  /** Whether the circuit is complete */
  circuitComplete: boolean;
  /** Total circuit resistance */
  totalResistanceOhm: number;
  /** Simulated output voltage across fence */
  simulatedOutputKV: number;
}

export interface FaultCandidate {
  edgeId: string;
  sourceId: string;
  label: string;
  kind: 'strand' | 'bridge';
  /** 0-1 suspicion score */
  score: number;
  /** Voltage drop across this element */
  voltageDropKV: number;
  /** Current through element */
  currentA: number;
  /** Whether it was manually marked as faulted */
  manuallyMarked: boolean;
}
