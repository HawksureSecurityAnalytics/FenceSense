export type ComponentType =
  | 'energizer'
  | 'earth_spike'
  | 'gate'
  | 'post'
  | 'corner'
  | 'join';

export type WireType =
  | 'hot'
  | 'earth'
  | 'bridge_hot'
  | 'bridge_earth';

export type FenceType = 'agricultural' | 'security' | 'game' | 'wildlife';

export interface Point {
  x: number;
  y: number;
}

export interface FenceNode {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  label: string;
  properties?: Record<string, any>;
}

export interface FenceWire {
  id: string;
  type: WireType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthMeters?: number;
}

export interface FenceProject {
  id: string;
  name: string;
  fenceType: FenceType;
  nodes: FenceNode[];
  wires: FenceWire[];
  createdAt: number;
  updatedAt: number;
}

export type IssueSeverity = 'error' | 'warn' | 'ok';

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  code: string;
  title: string;
  detail: string;
  affectedIds?: string[];
  suggestion?: string;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  stats: FenceStats;
  recommendations: string[];
}

export interface FenceStats {
  energizerCount: number;
  earthSpikeCount: number;
  gateCount: number;
  postCount: number;
  htLengthM: number;
  earthLengthM: number;
  bridgeCount: number;
  estimatedJoulesNeeded: number;
}

export type ToolMode = 'select' | 'place' | 'wire' | 'delete' | 'pan';

export interface CanvasState {
  tool: ToolMode;
  wireMode: WireType;
  pendingComponent: ComponentType | null;
  selectedNodeId: string | null;
  selectedWireId: string | null;
  wireStart: Point | null;
  pan: Point;
  scale: number;
}

export type FaultType =
  | 'low_voltage'
  | 'open_circuit'
  | 'short_circuit'
  | 'poor_earth'
  | 'vegetation_drain'
  | 'gate_contact_fault';

export interface DiagnosticInput {
  measuredVoltageKV: number;
  energizerOutputKV: number;
  fenceType: FenceType;
  totalLengthM: number;
  earthSpikeCount: number;
  soilCondition: 'dry' | 'normal' | 'wet';
  symptoms: string[];
}

export interface DiagnosticResult {
  likelyFault: FaultType | null;
  confidence: number;
  explanation: string;
  steps: string[];
}
