/**
 * FenceSense — Nodal Voltage Simulation Engine
 *
 * Models the fence as a resistor network and solves for voltages at every node
 * using Modified Nodal Analysis (MNA). This gives us:
 *   - Exact voltage at every post/strand node
 *   - Current through every bridge
 *   - Pinpointed fault location based on anomalous voltage drops
 *
 * Wire resistance values are based on typical hi-tensile fence wire:
 *   - 1.6mm HT wire: ~10 Ω/km  → 0.01 Ω/m
 *   - Galvanised mild: ~15 Ω/km → 0.015 Ω/m
 *   - Bridge clip: ~0.5 Ω (contact resistance)
 *   - Open/fault strand: 1,000,000 Ω (near-open circuit)
 */

import {
  Post, Segment, Bridge, FaultItem,
  NetNode, NetEdge, SimResult, FaultCandidate,
} from './circuitTypes';

// ── Constants ─────────────────────────────────────────────────────────────────
const WIRE_OHM_PER_PX = 0.00008;   // resistance per canvas pixel (scaled to feel realistic)
const BRIDGE_OHM      = 0.5;        // healthy bridge clip contact resistance
const FAULT_OHM       = 1_000_000;  // broken/open element
const ENERGIZER_VOLTS = 8000;       // 8kV energizer output (volts)
const ENERGIZER_INT_R = 200;        // energizer internal resistance (Ω)
const LOAD_R          = 50_000;     // body/load resistance across fence (Ω) — standard animal load

function uid() {
  return 'n' + Math.random().toString(36).slice(2, 9);
}

// ── Build the resistor network ─────────────────────────────────────────────────
export function buildNetwork(
  posts: Post[],
  segments: Segment[],
  bridges: Bridge[],
  faults: FaultItem[],
  strandCount: number,
): { nodes: NetNode[]; edges: NetEdge[] } {
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  const faultIds = new Set(faults.map(f => f.id));

  const postMap = new Map(posts.map(p => [p.id, p]));
  const sortedPosts = [...posts].sort((a, b) => a.x - b.x);
  const minX = sortedPosts[0]?.x ?? 0;
  const maxX = sortedPosts[sortedPosts.length - 1]?.x ?? 1;
  const xRange = Math.max(maxX - minX, 1);

  // Create a node for every (post, strandIndex) combination
  const nodeId = (postId: string, si: number) => `nd_${postId}_${si}`;

  posts.forEach(post => {
    const normX = (post.x - minX) / xRange;
    for (let si = 0; si < strandCount; si++) {
      nodes.push({
        id: nodeId(post.id, si),
        label: `Post@${Math.round(normX * 100)}% Strand${si + 1}`,
        normX,
        strandIndex: si,
      });
    }
  });

  // Create strand edges (horizontal wire between adjacent posts)
  const sortedSegs = [...segments].sort(
    (a, b) => (postMap.get(a.postA)?.x ?? 0) - (postMap.get(b.postA)?.x ?? 0),
  );

  sortedSegs.forEach(seg => {
    const pA = postMap.get(seg.postA);
    const pB = postMap.get(seg.postB);
    if (!pA || !pB) return;
    const dist = Math.abs(pB.x - pA.x);

    for (let si = 0; si < strandCount; si++) {
      const strandId = `strand-${seg.id}-${si}`;
      const isFault = faultIds.has(strandId);
      const R = isFault ? FAULT_OHM : Math.max(1, dist * WIRE_OHM_PER_PX);
      edges.push({
        id: strandId,
        fromNode: nodeId(seg.postA, si),
        toNode: nodeId(seg.postB, si),
        resistance: R,
        kind: 'strand',
        sourceId: strandId,
        label: `Strand ${si + 1} ${si % 2 === 0 ? '(HT)' : '(Earth)'}`,
      });
    }
  });

  // Create bridge edges (vertical clip connecting two strand levels at a post end)
  bridges.forEach(bridge => {
    const seg = segments.find(s => s.id === bridge.segmentId);
    if (!seg) return;
    const pA = postMap.get(seg.postA);
    const pB = postMap.get(seg.postB);
    if (!pA || !pB) return;

    // Which post is the bridge on?
    const postAtSide = bridge.side === 'left'
      ? (pA.x < pB.x ? pA : pB)
      : (pA.x > pB.x ? pA : pB);

    const siA = bridge.strandIndex;
    const siB = bridge.strandIndex + 2; // bridges always connect strand N to strand N+2
    if (siB >= strandCount) return;

    const isFault = faultIds.has(bridge.id);
    const R = isFault ? FAULT_OHM : BRIDGE_OHM;

    edges.push({
      id: bridge.id,
      fromNode: nodeId(postAtSide.id, siA),
      toNode: nodeId(postAtSide.id, siB),
      resistance: R,
      kind: 'bridge',
      sourceId: bridge.id,
      label: `${bridge.type === 'ht' ? 'HT' : 'Earth'} Bridge S${siA + 1}→S${siB + 1} (${bridge.side})`,
    });
  });

  return { nodes, edges };
}

// ── Solve MNA (Modified Nodal Analysis) ───────────────────────────────────────
/**
 * Solves the resistor network using the conductance matrix method (G·V = I).
 * Returns voltage at each node in Volts.
 *
 * Source node: first HT strand of first post (post index 0, strand 0)
 * Ground node: first Earth strand of last post (last post, strand 1)
 */
function solveVoltages(
  nodes: NetNode[],
  edges: NetEdge[],
  sourceNodeId: string,
  groundNodeId: string,
): Record<string, number> {
  const n = nodes.length;
  const nodeIndex = new Map(nodes.map((nd, i) => [nd.id, i]));
  const srcIdx = nodeIndex.get(sourceNodeId) ?? 0;
  const gndIdx = nodeIndex.get(groundNodeId) ?? n - 1;

  // Build conductance matrix G (n×n) and current vector I (n×1)
  const G: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const I: number[] = new Array(n).fill(0);

  edges.forEach(edge => {
    const i = nodeIndex.get(edge.fromNode);
    const j = nodeIndex.get(edge.toNode);
    if (i === undefined || j === undefined) return;
    const g = 1 / edge.resistance;
    G[i][i] += g;
    G[j][j] += g;
    G[i][j] -= g;
    G[j][i] -= g;
  });

  // Add load resistance across the fence (animal/body contact)
  G[srcIdx][srcIdx] += 1 / LOAD_R;
  G[gndIdx][gndIdx] += 1 / LOAD_R;
  G[srcIdx][gndIdx] -= 1 / LOAD_R;
  G[gndIdx][srcIdx] -= 1 / LOAD_R;

  // Apply voltage source via stamping: fix source node voltage
  // Using "big number" method to force V[src] = ENERGIZER_VOLTS, V[gnd] = 0
  const BIG = 1e12;
  G[srcIdx][srcIdx] += BIG;
  I[srcIdx] += BIG * ENERGIZER_VOLTS;
  // Ground is already 0 by default (no stamping needed)
  // But stamp it explicitly to fix it
  G[gndIdx][gndIdx] += BIG;
  I[gndIdx] += BIG * 0;

  // Gaussian elimination with partial pivoting
  const Ab: number[][] = G.map((row, i) => [...row, I[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(Ab[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(Ab[row][col]) > maxVal) {
        maxVal = Math.abs(Ab[row][col]);
        maxRow = row;
      }
    }
    [Ab[col], Ab[maxRow]] = [Ab[maxRow], Ab[col]];

    if (Math.abs(Ab[col][col]) < 1e-12) continue;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = Ab[row][col] / Ab[col][col];
      for (let k = col; k <= n; k++) {
        Ab[row][k] -= factor * Ab[col][k];
      }
    }
  }

  const voltages: Record<string, number> = {};
  nodes.forEach((nd, i) => {
    voltages[nd.id] = Ab[i][n] / (Ab[i][i] || 1);
  });

  return voltages;
}

// ── Main simulation entry point ────────────────────────────────────────────────
export function runSimulation(
  posts: Post[],
  segments: Segment[],
  bridges: Bridge[],
  faults: FaultItem[],
  strandCount: number,
): SimResult {
  if (posts.length < 2 || segments.length === 0) {
    return {
      nodeVoltages: {},
      edgeCurrents: {},
      edgePower: {},
      faultCandidates: [],
      circuitComplete: false,
      totalResistanceOhm: Infinity,
      simulatedOutputKV: 0,
    };
  }

  const { nodes, edges } = buildNetwork(posts, segments, bridges, faults, strandCount);
  const faultIds = new Set(faults.map(f => f.id));

  const sortedPosts = [...posts].sort((a, b) => a.x - b.x);
  const firstPost = sortedPosts[0];
  const lastPost = sortedPosts[sortedPosts.length - 1];

  // Source: strand 0 (first HT) of first post
  // Ground: strand 1 (first Earth) of last post
  const sourceNodeId = `nd_${firstPost.id}_0`;
  const groundNodeId = `nd_${lastPost.id}_1`;

  const hasSource = nodes.some(n => n.id === sourceNodeId);
  const hasGround = nodes.some(n => n.id === groundNodeId);

  if (!hasSource || !hasGround) {
    return {
      nodeVoltages: {},
      edgeCurrents: {},
      edgePower: {},
      faultCandidates: [],
      circuitComplete: false,
      totalResistanceOhm: Infinity,
      simulatedOutputKV: 0,
    };
  }

  const nodeVoltages = solveVoltages(nodes, edges, sourceNodeId, groundNodeId);

  // Calculate currents and power for each edge
  const edgeCurrents: Record<string, number> = {};
  const edgePower: Record<string, number> = {};

  edges.forEach(edge => {
    const vFrom = nodeVoltages[edge.fromNode] ?? 0;
    const vTo = nodeVoltages[edge.toNode] ?? 0;
    const I = Math.abs((vFrom - vTo) / edge.resistance);
    const P = I * I * edge.resistance;
    edgeCurrents[edge.id] = I;
    edgePower[edge.id] = P;
  });

  // Determine simulated output voltage
  const srcV = nodeVoltages[sourceNodeId] ?? ENERGIZER_VOLTS;
  const gndV = nodeVoltages[groundNodeId] ?? 0;
  const simulatedOutputKV = Math.abs(srcV - gndV) / 1000;

  // Calculate total circuit resistance
  const totalCurrent = Object.values(edgeCurrents).reduce((s, c) => s + c, 0);
  const totalResistanceOhm = totalCurrent > 0 ? ENERGIZER_VOLTS / totalCurrent : Infinity;

  // ── Fault detection ──────────────────────────────────────────────────────────
  // Score each edge by how anomalous its voltage drop is
  // Healthy strands should have minimal drop; healthy bridges too
  // A broken element will show a near-full-voltage drop

  const totalV = Math.abs(srcV - gndV) || 1;
  const faultCandidates: FaultCandidate[] = [];

  edges.forEach(edge => {
    if (edge.kind === 'energizer_out' || edge.kind === 'energizer_return') return;

    const vFrom = nodeVoltages[edge.fromNode] ?? 0;
    const vTo = nodeVoltages[edge.toNode] ?? 0;
    const voltageDropKV = Math.abs(vFrom - vTo) / 1000;
    const dropFraction = Math.abs(vFrom - vTo) / totalV;
    const currentA = edgeCurrents[edge.id] ?? 0;
    const isManual = faultIds.has(edge.sourceId);

    // Suspicious if voltage drop is more than 30% of total voltage
    // Or if it was manually marked as faulted
    let score = dropFraction;
    if (isManual) score = Math.max(score, 0.95);

    // Bridges are more suspicious for high drops since they should be ~0V drop
    if (edge.kind === 'bridge' && dropFraction > 0.1) score *= 1.5;

    if (score > 0.15 || isManual) {
      faultCandidates.push({
        edgeId: edge.id,
        sourceId: edge.sourceId,
        label: edge.label,
        kind: edge.kind as 'strand' | 'bridge',
        score: Math.min(1, score),
        voltageDropKV,
        currentA,
        manuallyMarked: isManual,
      });
    }
  });

  faultCandidates.sort((a, b) => b.score - a.score);

  const circuitComplete = faultCandidates.filter(fc => fc.score > 0.5).length === 0 && simulatedOutputKV > 0.5;

  return {
    nodeVoltages,
    edgeCurrents,
    edgePower,
    faultCandidates,
    circuitComplete,
    totalResistanceOhm,
    simulatedOutputKV,
  };
}
