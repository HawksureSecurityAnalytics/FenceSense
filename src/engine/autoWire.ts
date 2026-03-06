import { FenceNode, FenceWire, WireType, ComponentType } from '../types';

const SNAP = 24;
const EARTH_OFFSET = 18;        // pixels between HT and Earth wire
const SPIKE_INTERVAL_M = 50;    // place earth spike every 50m
const M_PER_SNAP = 2;           // 2 metres per snap unit

function snapV(v: number) { return Math.round(v / SNAP) * SNAP; }

function uid() {
  return `aw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function perpOffset(
  x1: number, y1: number, x2: number, y2: number, dist: number
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return { dx: 0, dy: 0 };
  return { dx: -(y2 - y1) / len * dist, dy: (x2 - x1) / len * dist };
}

function wireLen(w: FenceWire) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / SNAP * M_PER_SNAP;
}

interface AutoWireResult {
  nodesToAdd: FenceNode[];
  wiresToAdd: FenceWire[];
  summary: string[];
}

export function autoWireFence(
  existingNodes: FenceNode[],
  existingWires: FenceWire[],
): AutoWireResult {
  const nodesToAdd: FenceNode[] = [];
  const wiresToAdd: FenceWire[] = [];
  const summary: string[] = [];

  const energizer = existingNodes.find(n => n.type === 'energizer');
  const htWires   = existingWires.filter(w => w.type === 'hot');

  if (!energizer) {
    return { nodesToAdd: [], wiresToAdd: [], summary: ['⛔ Place an Energizer first.'] };
  }
  if (!htWires.length) {
    return { nodesToAdd: [], wiresToAdd: [], summary: ['⛔ Draw HT (red) fence wire first.'] };
  }

  // Remove any existing auto-wired items so re-running is idempotent
  const alreadyEarth  = existingWires.filter(w => w.type === 'earth');
  const alreadyBridgeHT    = existingWires.filter(w => w.type === 'bridge_hot');
  const alreadyBridgeEarth = existingWires.filter(w => w.type === 'bridge_earth');

  // ── STEP 1: Add Earth wire parallel to every HT wire ───────────────────
  let earthAdded = 0;
  const earthWireMap = new Map<string, FenceWire>(); // htWire.id → earthWire

  htWires.forEach(ht => {
    // Check if earth wire already exists alongside this HT wire
    const already = alreadyEarth.some(e => {
      const htMx = (ht.x1+ht.x2)/2, htMy = (ht.y1+ht.y2)/2;
      const eMx  = (e.x1+e.x2)/2,   eMy  = (e.y1+e.y2)/2;
      return Math.hypot(htMx-eMx, htMy-eMy) < EARTH_OFFSET * 2;
    });
    if (already) return;

    const { dx, dy } = perpOffset(ht.x1, ht.y1, ht.x2, ht.y2, EARTH_OFFSET);
    const earthWire: FenceWire = {
      id: uid(),
      type: 'earth',
      x1: snapV(ht.x1 + dx), y1: snapV(ht.y1 + dy),
      x2: snapV(ht.x2 + dx), y2: snapV(ht.y2 + dy),
      strandCount: ht.strandCount || 3,
      lengthMeters: wireLen(ht),
    };
    wiresToAdd.push(earthWire);
    earthWireMap.set(ht.id, earthWire);
    earthAdded++;
  });
  if (earthAdded) summary.push(`✅ Added ${earthAdded} earth wire(s) alongside HT fence`);

  // ── STEP 2: Earth spikes every SPIKE_INTERVAL_M along earth wires ──────
  let spikesAdded = 0;
  const allEarthWires = [...alreadyEarth, ...wiresToAdd.filter(w => w.type === 'earth')];

  allEarthWires.forEach(ew => {
    const lenM = wireLen(ew);
    const numSpikes = Math.max(1, Math.floor(lenM / SPIKE_INTERVAL_M));
    for (let i = 0; i <= numSpikes; i++) {
      const t = numSpikes === 0 ? 0.5 : i / numSpikes;
      const sx = snapV(ew.x1 + (ew.x2 - ew.x1) * t);
      const sy = snapV(ew.y1 + (ew.y2 - ew.y1) * t);

      // Don't double-place
      const tooClose = [...existingNodes, ...nodesToAdd].some(
        n => n.type === 'earth_spike' && Math.hypot(n.x - sx, n.y - sy) < SNAP * 3
      );
      if (tooClose) continue;

      nodesToAdd.push({
        id: uid(),
        type: 'earth_spike',
        x: sx, y: sy,
        label: `Spike ${existingNodes.filter(n=>n.type==='earth_spike').length + spikesAdded + 1}`,
      });
      spikesAdded++;
    }
  });
  if (spikesAdded) summary.push(`✅ Placed ${spikesAdded} earth spike(s)`);

  // ── STEP 3: Connect earth spikes to earth wire with short connector ─────
  // (visual — small vertical earth connection lines)
  const newSpikes = nodesToAdd.filter(n => n.type === 'earth_spike');
  newSpikes.forEach(spike => {
    wiresToAdd.push({
      id: uid(),
      type: 'earth',
      x1: spike.x, y1: spike.y,
      x2: spike.x, y2: spike.y + SNAP,
      strandCount: 1,
      lengthMeters: 1,
    });
  });

  // ── STEP 4: Find fence endpoints — connect Energizer + and – ───────────
  // Build adjacency to find wire endpoints (nodes with only one connection)
  const allHT = htWires;
  const pointCount = new Map<string, number>();
  const key = (x: number, y: number) => `${Math.round(x/SNAP)},${Math.round(y/SNAP)}`;

  allHT.forEach(w => {
    const k1 = key(w.x1, w.y1), k2 = key(w.x2, w.y2);
    pointCount.set(k1, (pointCount.get(k1) || 0) + 1);
    pointCount.set(k2, (pointCount.get(k2) || 0) + 1);
  });

  // Endpoints = points that appear only once (open ends of fence)
  const endpoints: {x:number;y:number}[] = [];
  allHT.forEach(w => {
    if ((pointCount.get(key(w.x1,w.y1))||0) === 1)
      endpoints.push({x:w.x1,y:w.y1});
    if ((pointCount.get(key(w.x2,w.y2))||0) === 1)
      endpoints.push({x:w.x2,y:w.y2});
  });

  // Deduplicate endpoints
  const uniqueEndpoints = endpoints.filter((p, i) =>
    endpoints.findIndex(q => key(q.x,q.y) === key(p.x,p.y)) === i
  );

  // ── STEP 5: Live out (+) wire from Energizer to nearest fence endpoint ──
  if (uniqueEndpoints.length >= 1) {
    // Sort endpoints by distance to energizer
    const sorted = [...uniqueEndpoints].sort((a, b) =>
      Math.hypot(a.x-energizer.x, a.y-energizer.y) -
      Math.hypot(b.x-energizer.x, b.y-energizer.y)
    );

    const liveEnd = sorted[0];
    const alreadyLive = existingWires.some(w =>
      w.type === 'hot' &&
      Math.hypot(w.x1-energizer.x, w.y1-energizer.y) < SNAP*2
    );

    if (!alreadyLive) {
      wiresToAdd.push({
        id: uid(),
        type: 'hot',
        x1: snapV(energizer.x + 28), y1: snapV(energizer.y),
        x2: liveEnd.x, y2: liveEnd.y,
        strandCount: 1,
        lengthMeters: Math.hypot(liveEnd.x-energizer.x, liveEnd.y-energizer.y)/SNAP*M_PER_SNAP,
      });
      summary.push(`✅ Live (+) wire: Energizer → fence start`);
    }

    // ── STEP 6: Return (–) earth wire from last fence endpoint back to Energizer
    if (sorted.length >= 2) {
      const returnEnd = sorted[sorted.length - 1];
      wiresToAdd.push({
        id: uid(),
        type: 'earth',
        x1: returnEnd.x, y1: returnEnd.y,
        x2: snapV(energizer.x + 28), y2: snapV(energizer.y + 20),
        strandCount: 1,
        lengthMeters: Math.hypot(returnEnd.x-energizer.x, returnEnd.y-energizer.y)/SNAP*M_PER_SNAP,
      });
      summary.push(`✅ Return (–) wire: fence end → Energizer`);
    }
  }

  // ── STEP 7: HT bridges at wire junctions (corners / joins) ─────────────
  let htBridgesAdded = 0;
  const junctionKeys = new Set<string>();

  // Junctions = points where 2+ HT wires meet
  allHT.forEach(w => {
    const k1 = key(w.x1, w.y1), k2 = key(w.x2, w.y2);
    if ((pointCount.get(k1)||0) >= 2) junctionKeys.add(k1);
    if ((pointCount.get(k2)||0) >= 2) junctionKeys.add(k2);
  });

  junctionKeys.forEach(k => {
    const [gx, gy] = k.split(',').map(Number);
    const jx = gx * SNAP, jy = gy * SNAP;

    // Check no bridge already here
    const allBridgesHT = [...alreadyBridgeHT, ...wiresToAdd.filter(w=>w.type==='bridge_hot')];
    const exists = allBridgesHT.some(b =>
      Math.hypot((b.x1+b.x2)/2 - jx, (b.y1+b.y2)/2 - jy) < SNAP * 2
    );
    if (exists) return;

    // Short HT loop bridge across junction
    wiresToAdd.push({
      id: uid(),
      type: 'bridge_hot',
      x1: jx - SNAP, y1: jy - SNAP,
      x2: jx + SNAP, y2: jy + SNAP,
      strandCount: 1,
      lengthMeters: 1,
    });

    // Earth bridge alongside
    const allBridgesE = [...alreadyBridgeEarth, ...wiresToAdd.filter(w=>w.type==='bridge_earth')];
    const existsE = allBridgesE.some(b =>
      Math.hypot((b.x1+b.x2)/2 - jx, (b.y1+b.y2)/2 - jy) < SNAP * 2
    );
    if (!existsE) {
      wiresToAdd.push({
        id: uid(),
        type: 'bridge_earth',
        x1: jx - SNAP + 8, y1: jy - SNAP + 8,
        x2: jx + SNAP + 8, y2: jy + SNAP + 8,
        strandCount: 1,
        lengthMeters: 1,
      });
    }
    htBridgesAdded++;
  });

  if (htBridgesAdded) summary.push(`✅ Added ${htBridgesAdded} junction bridge(s)`);

  // ── STEP 8: Gate bridges ────────────────────────────────────────────────
  const gates = existingNodes.filter(n => n.type === 'gate');
  let gateBridgesAdded = 0;
  gates.forEach(gate => {
    const allBridgesHT = [...alreadyBridgeHT, ...wiresToAdd.filter(w=>w.type==='bridge_hot')];
    const hasHT = allBridgesHT.some(b =>
      Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y) < 80
    );
    if (!hasHT) {
      wiresToAdd.push({
        id: uid(), type: 'bridge_hot',
        x1: gate.x - 60, y1: gate.y - 8,
        x2: gate.x + 60, y2: gate.y - 8,
        strandCount: 1, lengthMeters: 2,
      });
    }
    const allBridgesE = [...alreadyBridgeEarth, ...wiresToAdd.filter(w=>w.type==='bridge_earth')];
    const hasEarth = allBridgesE.some(b =>
      Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y) < 80
    );
    if (!hasEarth) {
      wiresToAdd.push({
        id: uid(), type: 'bridge_earth',
        x1: gate.x - 60, y1: gate.y + 8,
        x2: gate.x + 60, y2: gate.y + 8,
        strandCount: 1, lengthMeters: 2,
      });
      gateBridgesAdded++;
    }
  });
  if (gateBridgesAdded) summary.push(`✅ Gate bridges added at ${gateBridgesAdded} gate(s)`);

  if (!summary.length) summary.push('ℹ️ Fence already fully wired — nothing to add.');

  return { nodesToAdd, wiresToAdd, summary };
}
