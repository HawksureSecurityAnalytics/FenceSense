/**
 * DrawScreen — FenceSense
 *
 * Performance improvements over previous version:
 *  - PanResponder state no longer stored in React state — pan/zoom are refs
 *    that only trigger a viewBox update via RAF (no per-frame re-renders)
 *  - Pinch-to-zoom handled natively via two-finger distance tracking
 *  - SVG elements are memoized per segment/bridge to avoid full re-renders
 *  - Simulation now uses full nodal voltage analysis (simulationEngine.ts)
 *    instead of simple path tracing — gives voltage at every node & pinpoints
 *    the exact bridge/strand with the fault
 */

import React, {
  useState, useRef, useCallback, useEffect, useMemo, memo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Alert, PanResponder, ScrollView, GestureResponderEvent,
} from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText, G, Path } from 'react-native-svg';
import {
  Post, Segment, Bridge, FaultItem, BridgeType, BridgeSide,
  FaultCandidate,
} from '../engine/circuitTypes';
import { generateCorrectBridges } from '../engine/circuitEngine';
import { runSimulation, SimResult } from '../engine/simulationEngine';

// ── Dimensions & constants ────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const SG = 14;         // strand gap px
const PTOP = 22;       // padding top within post
const PBOT = 22;       // padding bottom
const CLIP = 15;       // bridge clip overhang
const EW = 54;         // energizer width
const EH = 40;         // energizer height
const CW = 4000;       // canvas logical width
const CH = 520;        // canvas logical height
const MIN_SCALE = 0.15;
const MAX_SCALE = 10;
const TAP_SLOP = 14;   // px — max movement to count as a tap

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0d1219',
  dead:      '#2d3748',
  panel:     '#111827',
  border:    '#1e293b',
  ht:        '#ef4444',
  earth:     '#22c55e',
  post:      '#94a3b8',
  energizer: '#f59e0b',
  spike:     '#6b7280',
  fault:     '#f97316',
  text:      '#e2e8f0',
  muted:     '#64748b',
  sim:       '#60a5fa',
  simGood:   '#34d399',
  simWarn:   '#fbbf24',
  voltage:   '#a78bfa',
};

type TM = 'post' | 'ht_bridge' | 'earth_bridge' | 'fault' | 'gate' | 'delete';

interface GateContact { id: string; segmentId: string; open: boolean; }

function uid() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function strandY(si: number, oY: number): number {
  return oY + PTOP + PBOT / 2 + si * SG;
}

// ── Memoized SVG sub-components ───────────────────────────────────────────────

interface StrandProps {
  x1: number; y1: number; x2: number; y2: number;
  color: string; active: boolean; faulted: boolean;
  strandLabel: string; typeLabel: string; showLabels: boolean;
  id: string; tool: TM;
  onFaultToggle: (id: string) => void;
}

const StrandLine = memo(({ x1, y1, x2, y2, color, active, faulted, strandLabel, typeLabel, showLabels, id, tool, onFaultToggle }: StrandProps) => (
  <G onPress={() => { if (tool === 'fault') onFaultToggle(id); }}>
    <Rect x={Math.min(x1, x2) - 4} y={y1 - 6} width={Math.abs(x2 - x1) + 8} height={12} fill="transparent" />
    <Line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth={active ? 3 : 2}
      strokeDasharray={faulted ? '7,4' : undefined}
      strokeLinecap="round"
    />
    {faulted && <Circle cx={(x1 + x2) / 2} cy={y1} r={5} fill={C.fault} opacity={0.85} />}
    {showLabels && <SvgText x={x1 - 6} y={y1 + 4} fill={color} fontSize={8} textAnchor="end" opacity={0.75}>{typeLabel}</SvgText>}
    {showLabels && <SvgText x={x2 + 6} y={y1 + 4} fill={color} fontSize={9} fontWeight="bold" textAnchor="start" opacity={0.85}>{strandLabel}</SvgText>}
  </G>
));

interface BridgeProps {
  px: number; yA: number; yB: number; dir: number;
  color: string; active: boolean; faulted: boolean;
  id: string; tool: TM;
  onFaultToggle: (id: string) => void;
  onDelete: (id: string) => void;
  voltageLabel?: string;
}

const BridgeClip = memo(({ px, yA, yB, dir, color, active, faulted, id, tool, onFaultToggle, onDelete, voltageLabel }: BridgeProps) => {
  const cx = px + dir * CLIP;
  const sw = active || faulted ? 3 : 2;
  return (
    <G onPress={() => {
      if (tool === 'fault') onFaultToggle(id);
      if (tool === 'delete') onDelete(id);
    }}>
      <Rect x={Math.min(px, cx) - 6} y={yA - 6} width={Math.abs(cx - px) + 12} height={yB - yA + 12} fill="transparent" />
      <Line x1={px} y1={yA} x2={cx} y2={yA} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={cx} y1={yA} x2={cx} y2={yB} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={cx} y1={yB} x2={px} y2={yB} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {faulted && <Circle cx={cx} cy={(yA + yB) / 2} r={6} fill={C.fault} />}
      {active && voltageLabel && (
        <SvgText x={cx + dir * 8} y={(yA + yB) / 2 + 4} fill={C.voltage} fontSize={7} textAnchor={dir > 0 ? 'start' : 'end'} opacity={0.9}>
          {voltageLabel}
        </SvgText>
      )}
    </G>
  );
});

// ── Main component ─────────────────────────────────────────────────────────────
export default function DrawScreen() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<Post[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [faults, setFaults] = useState<FaultItem[]>([]);
  const [gates, setGates] = useState<GateContact[]>([]);
  const [n, setN] = useState(8);
  const [tool, setTool] = useState<TM>('post');
  const toolRef = useRef<TM>('post');

  // Simulation state
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simAnimStep, setSimAnimStep] = useState(-1);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const simTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── View transform (refs — never cause re-render during gesture) ────────────
  const panX = useRef(0);
  const panY = useRef(0);
  const scaleRef = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const tapStartX = useRef(0);
  const tapStartY = useRef(0);
  const rafPending = useRef(false);
  const canvasHRef = useRef(SH);

  // Pinch state
  const lastPinchDist = useRef<number | null>(null);
  const pinchCenterX = useRef(0);
  const pinchCenterY = useRef(0);

  // ViewBox is the only view state that changes during pan/zoom
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SW, h: SH });
  const [scale, setScale] = useState(1); // only for display in status bar

  // ── Derived values ─────────────────────────────────────────────────────────
  const strandH = (n - 1) * SG;
  const oY = CH / 2 - (PTOP + strandH / 2);
  const oYRef = useRef(oY);
  oYRef.current = oY;

  const sorted = useMemo(() => [...posts].sort((a, b) => a.x - b.x), [posts]);
  const faultSet = useMemo(() => new Set(faults.map(f => f.id)), [faults]);

  // ── Auto-segment on post change ────────────────────────────────────────────
  useEffect(() => {
    if (posts.length < 2) { setSegments([]); return; }
    const s = [...posts].sort((a, b) => a.x - b.x);
    const segs: Segment[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      const ex = segments.find(sg => sg.postA === s[i].id && sg.postB === s[i + 1].id);
      segs.push(ex ?? { id: uid(), postA: s[i].id, postB: s[i + 1].id });
    }
    setSegments(segs);
  }, [posts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Simulation colour helpers ──────────────────────────────────────────────
  const faultCandidateMap = useMemo(() => {
    const m = new Map<string, FaultCandidate>();
    simResult?.faultCandidates.forEach(fc => m.set(fc.sourceId, fc));
    return m;
  }, [simResult]);

  const nodeVoltages = simResult?.nodeVoltages ?? {};

  const strandColor = useCallback((si: number, segId: string): string => {
    const id = `strand-${segId}-${si}`;
    if (faultSet.has(id)) return C.fault;
    if (!simResult) return si % 2 === 0 ? C.ht : C.earth;
    const fc = faultCandidateMap.get(id);
    if (fc && fc.score > 0.5) return C.fault;
    if (activeIds.has(id)) return C.sim;
    if (simResult && !activeIds.has(id) && simAnimStep >= 0) return C.dead;
    return si % 2 === 0 ? C.ht : C.earth;
  }, [faultSet, simResult, faultCandidateMap, activeIds, simAnimStep]);

  const bridgeColor = useCallback((b: Bridge): string => {
    if (faultSet.has(b.id)) return C.fault;
    if (!simResult) return b.type === 'ht' ? C.ht : C.earth;
    const fc = faultCandidateMap.get(b.id);
    if (fc && fc.score > 0.5) return C.fault;
    if (activeIds.has(b.id)) return C.sim;
    if (simResult && !activeIds.has(b.id) && simAnimStep >= 0) return C.dead;
    return b.type === 'ht' ? C.ht : C.earth;
  }, [faultSet, simResult, faultCandidateMap, activeIds, simAnimStep]);

  const voltageLabel = useCallback((b: Bridge): string | undefined => {
    if (!simResult) return undefined;
    const seg = segments.find(s => s.id === b.segmentId);
    if (!seg) return undefined;
    const postMap = new Map(posts.map(p => [p.id, p]));
    const pA = postMap.get(seg.postA);
    const pB = postMap.get(seg.postB);
    if (!pA || !pB) return undefined;
    const postAtSide = b.side === 'left'
      ? (pA.x < pB.x ? pA : pB)
      : (pA.x > pB.x ? pA : pB);
    const nodeId = `nd_${postAtSide.id}_${b.strandIndex}`;
    const v = nodeVoltages[nodeId];
    if (v === undefined) return undefined;
    return `${(Math.abs(v) / 1000).toFixed(1)}kV`;
  }, [simResult, segments, posts, nodeVoltages]);

  // ── RAF-throttled viewBox update ───────────────────────────────────────────
  const scheduleViewBoxUpdate = useCallback(() => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      const sc = scaleRef.current;
      setViewBox({
        x: -panX.current / sc,
        y: -panY.current / sc,
        w: SW / sc,
        h: canvasHRef.current / sc,
      });
    });
  }, []);

  // ── Tap handler (canvas coords) ────────────────────────────────────────────
  const tap = useCallback((rawX: number, rawY: number) => {
    const x = (rawX - panX.current) / scaleRef.current;
    const y = (rawY - panY.current) / scaleRef.current;
    const t = toolRef.current;

    if (t === 'post') {
      const sx = Math.round(x / 110) * 110;
      if (sx < 80) return;
      if (posts.some(p => Math.abs(p.x - sx) < 80)) return;
      setPosts(p => [...p, { id: uid(), x: sx, y: CH / 2 }]);
      return;
    }

    if ((t === 'ht_bridge' || t === 'earth_bridge') && posts.length >= 2) {
      const s = [...posts].sort((a, b) => a.x - b.x);
      const nearPost = s.reduce((p, c) => Math.abs(c.x - x) < Math.abs(p.x - x) ? c : p);
      const isLeft = nearPost.id === s[0].id;
      const isRight = nearPost.id === s[s.length - 1].id;
      const side: BridgeSide = isLeft ? 'left' : isRight ? 'right' : x < nearPost.x ? 'left' : 'right';
      const bt: BridgeType = t === 'ht_bridge' ? 'ht' : 'earth';
      const strandZeroY = oYRef.current + PTOP + PBOT / 2;
      let si = Math.round((y - strandZeroY) / SG);
      if (bt === 'ht' && si % 2 !== 0) si = si % 2 === 1 ? si - 1 : si + 1;
      if (bt === 'earth' && si % 2 === 0) si = si + 1 < n ? si + 1 : si - 1;
      si = Math.max(0, Math.min(n - 2, si));
      const seg = segments.find(s2 => {
        const pa = posts.find(p => p.id === s2.postA);
        const pb = posts.find(p => p.id === s2.postB);
        return (pa && Math.abs(pa.x - nearPost.x) < 5) || (pb && Math.abs(pb.x - nearPost.x) < 5);
      });
      const segId = seg?.id ?? segments[0]?.id ?? '';
      if (bridges.some(b => b.segmentId === segId && b.type === bt && b.side === side && b.strandIndex === si)) {
        Alert.alert('Already placed'); return;
      }
      setBridges(b => [...b, { id: uid(), segmentId: segId, strandIndex: si, type: bt, side }]);
      return;
    }

    if (t === 'fault' && segments.length > 0) {
      const strandZeroY = oYRef.current + PTOP + PBOT / 2;
      const si = Math.max(0, Math.min(n - 1, Math.round((y - strandZeroY) / SG)));
      const sp = [...posts].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sp.length - 1; i++) {
        if (x >= sp[i].x && x <= sp[i + 1].x) {
          const seg = segments.find(s2 => {
            const pa = posts.find(p => p.id === s2.postA);
            return pa && Math.abs(pa.x - sp[i].x) < 5;
          });
          if (seg) {
            const fid = `strand-${seg.id}-${si}`;
            setFaults(prev => prev.find(f => f.id === fid)
              ? prev.filter(f => f.id !== fid)
              : [...prev, { id: fid, kind: 'strand' }]);
          }
          return;
        }
      }
      return;
    }

    if (t === 'gate' && segments.length > 0) {
      const sp = [...posts].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sp.length - 1; i++) {
        if (x >= sp[i].x && x <= sp[i + 1].x) {
          const seg = segments.find(s2 => {
            const pa = posts.find(p => p.id === s2.postA);
            return pa && Math.abs(pa.x - sp[i].x) < 5;
          });
          if (seg) {
            const ex = gates.find(g => g.segmentId === seg.id);
            if (ex) setGates(prev => prev.map(g => g.id === ex.id ? { ...g, open: !g.open } : g));
            else setGates(prev => [...prev, { id: uid(), segmentId: seg.id, open: false }]);
          }
          return;
        }
      }
      return;
    }

    if (t === 'delete' && posts.length > 0) {
      const near = posts.reduce((p, c) => Math.hypot(c.x - x, c.y - y) < Math.hypot(p.x - x, p.y - y) ? c : p);
      if (near && Math.hypot(near.x - x, near.y - y) < 60) {
        const affSegs = segments.filter(s2 => s2.postA === near.id || s2.postB === near.id);
        setPosts(p => p.filter(pp => pp.id !== near.id));
        setBridges(b => b.filter(br => !affSegs.some(s2 => s2.id === br.segmentId)));
        setGates(g => g.filter(gg => !affSegs.some(s2 => s2.id === gg.segmentId)));
      }
    }
  }, [posts, segments, bridges, gates, n, oY, strandH]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapRef = useRef(tap);
  useEffect(() => { tapRef.current = tap; }, [tap]);

  // ── PanResponder — pan + pinch-to-zoom ────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: (e, gs) => {
        tapStartX.current = gs.x0;
        tapStartY.current = e.nativeEvent.locationY;
        panStartX.current = panX.current;
        panStartY.current = panY.current;
        lastPinchDist.current = null;
      },
      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches;

        // ── Pinch zoom with 2 fingers ──────────────────────────────────────
        if (touches.length >= 2) {
          const t0 = touches[0], t1 = touches[1];
          const dist = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
          const cx = (t0.pageX + t1.pageX) / 2;
          const cy = (t0.pageY + t1.pageY) / 2;

          if (lastPinchDist.current !== null) {
            const ratio = dist / lastPinchDist.current;
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * ratio));

            // Zoom towards pinch center
            const worldCX = (cx - panX.current) / scaleRef.current;
            const worldCY = (cy - panY.current) / scaleRef.current;
            panX.current = cx - worldCX * newScale;
            panY.current = cy - worldCY * newScale;
            scaleRef.current = newScale;
          }
          lastPinchDist.current = dist;
          pinchCenterX.current = cx;
          pinchCenterY.current = cy;
          scheduleViewBoxUpdate();
          return;
        }

        // ── Single finger pan ──────────────────────────────────────────────
        lastPinchDist.current = null;
        panX.current = panStartX.current + gs.dx;
        panY.current = panStartY.current + gs.dy;
        scheduleViewBoxUpdate();
      },
      onPanResponderRelease: (_, gs) => {
        lastPinchDist.current = null;
        if (Math.abs(gs.dx) < TAP_SLOP && Math.abs(gs.dy) < TAP_SLOP) {
          tapRef.current(tapStartX.current, tapStartY.current);
        }
        // Sync scale state for status bar (cheap, one-time on release)
        setScale(Math.round(scaleRef.current * 100) / 100);
      },
    })
  ).current;

  // ── Zoom buttons ───────────────────────────────────────────────────────────
  const zoomBy = useCallback((factor: number) => {
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * factor));
    scaleRef.current = newScale;
    setScale(newScale);
    scheduleViewBoxUpdate();
  }, [scheduleViewBoxUpdate]);

  const resetView = useCallback(() => {
    scaleRef.current = 1;
    const fenceX = sorted.length > 0 ? sorted[0].x : 110;
    const fenceCY = oYRef.current + CH / 4;
    panX.current = -(fenceX - SW / 4);
    panY.current = -(fenceCY - canvasHRef.current / 2);
    setScale(1);
    scheduleViewBoxUpdate();
  }, [sorted, scheduleViewBoxUpdate]);

  // ── Auto-wire ──────────────────────────────────────────────────────────────
  const autoWire = useCallback(() => {
    if (!segments.length) { Alert.alert('Place posts first'); return; }
    setBridges(generateCorrectBridges(segments, n));
  }, [segments, n]);

  // ── Simulation ─────────────────────────────────────────────────────────────
  const stopSim = useCallback(() => {
    if (simTimer.current) clearTimeout(simTimer.current);
    setSimRunning(false);
  }, []);

  const clearSim = useCallback(() => {
    stopSim();
    setSimResult(null);
    setActiveIds(new Set());
    setSimAnimStep(-1);
  }, [stopSim]);

  const clearAll = useCallback(() => {
    clearSim();
    setPosts([]); setSegments([]); setBridges([]);
    setFaults([]); setGates([]);
  }, [clearSim]);

  const startSim = useCallback(() => {
    if (!segments.length) { Alert.alert('Draw the fence first'); return; }
    stopSim();
    setActiveIds(new Set());
    setSimAnimStep(-1);
    setSimResult(null);

    // Run the full nodal analysis
    const result = runSimulation(posts, segments, bridges, faults, n);
    setSimResult(result);
    setSimRunning(true);

    // Build animation path: all edges in topology order
    // We animate by activating edges one-by-one to show current flow
    const allEdgeIds: string[] = [];
    // HT strands left→right
    const sortedSegs = [...segments].sort((a, b) => {
      const pa = posts.find(p => p.id === a.postA)?.x ?? 0;
      const pb = posts.find(p => p.id === b.postA)?.x ?? 0;
      return pa - pb;
    });
    for (let si = 0; si < n; si += 2) {
      sortedSegs.forEach(seg => allEdgeIds.push(`strand-${seg.id}-${si}`));
    }
    // Bridges
    bridges.forEach(b => allEdgeIds.push(b.id));
    // Earth strands right→left
    for (let si = 1; si < n; si += 2) {
      [...sortedSegs].reverse().forEach(seg => allEdgeIds.push(`strand-${seg.id}-${si}`));
    }

    let step = 0;
    const active = new Set<string>();

    const run = () => {
      if (step >= allEdgeIds.length) {
        setSimRunning(false);
        const topFault = result.faultCandidates[0];
        if (!result.circuitComplete && topFault) {
          Alert.alert(
            '⚡ FAULT DETECTED',
            `Most likely fault:\n\n${topFault.label}\n\nSuspicion: ${Math.round(topFault.score * 100)}%\nVoltage drop: ${topFault.voltageDropKV.toFixed(2)} kV\n\nCheck this bridge/strand first.`,
          );
        } else if (result.circuitComplete) {
          Alert.alert(
            '✅ Circuit OK',
            `Fence looks healthy.\nEstimated output: ${result.simulatedOutputKV.toFixed(1)} kV`,
          );
        }
        return;
      }
      active.add(allEdgeIds[step]);
      setActiveIds(new Set(active));
      setSimAnimStep(step);
      step++;
      simTimer.current = setTimeout(run, 80);
    };

    simTimer.current = setTimeout(run, 300);
  }, [posts, segments, bridges, faults, n, stopSim]);

  // ── Fault toggle helpers ───────────────────────────────────────────────────
  const toggleFault = useCallback((id: string, kind: 'strand' | 'bridge' = 'strand') => {
    setFaults(prev => prev.find(f => f.id === id)
      ? prev.filter(f => f.id !== id)
      : [...prev, { id, kind }]);
  }, []);

  const deleteBridge = useCallback((id: string) => {
    setBridges(prev => prev.filter(b => b.id !== id));
  }, []);

  // ── Bridge correctness ─────────────────────────────────────────────────────
  const { correct, missing } = useMemo(() => {
    const c = segments.length > 0 ? generateCorrectBridges(segments, n) : [];
    const placed = bridges.filter(b =>
      c.some(cc => cc.type === b.type && cc.side === b.side && cc.strandIndex === b.strandIndex)
    ).length;
    return { correct: c, missing: c.length - placed };
  }, [segments, bridges, n]);

  // Energizer position
  const ex2 = sorted.length > 0 ? sorted[0].x - EW - 18 : 120;
  const ey2 = oY + strandY(0, 0) - EH / 2;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <View>
          <Text style={s.title}>✏ DRAW FENCE</Text>
          <Text style={s.sub}>
            {n} strands · {posts.length} posts · {bridges.length} bridges
            {missing > 0 ? ` · ⚠ ${missing} missing` : ''}
            {simResult ? ` · ${simResult.simulatedOutputKV.toFixed(1)} kV` : ''}
          </Text>
        </View>
        <View style={s.topBtns}>
          <TouchableOpacity style={s.btn} onPress={autoWire}>
            <Text style={s.btnTxt}>⚡ AUTO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, simRunning ? { borderColor: C.fault } : { borderColor: C.sim }]}
            onPress={simRunning ? stopSim : startSim}
          >
            <Text style={[s.btnTxt, { color: simRunning ? C.fault : C.sim }]}>
              {simRunning ? '■ STOP' : '▶ SIM'}
            </Text>
          </TouchableOpacity>
          {simResult && (
            <TouchableOpacity style={[s.btn, { borderColor: C.muted }]} onPress={clearSim}>
              <Text style={s.btnTxt}>✕ CLR</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.btn} onPress={clearAll}>
            <Text style={s.btnTxt}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Strand count picker ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strandRow} contentContainerStyle={{ paddingHorizontal: 8 }}>
        <Text style={s.sLbl}>STRANDS:</Text>
        {[5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30].map(v => (
          <TouchableOpacity key={v} style={[s.chip, n === v && s.chipOn]} onPress={() => setN(v)}>
            <Text style={[s.cTxt, n === v && s.cOn]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Tool bar ── */}
      <View style={s.toolbar}>
        {([
          ['post', '📍', 'Post'],
          ['ht_bridge', '🔴', 'HT Br'],
          ['earth_bridge', '🟢', 'E Br'],
          ['fault', '⚠', 'Fault'],
          ['gate', '🚪', 'Gate'],
          ['delete', '✕', 'Del'],
        ] as [TM, string, string][]).map(([t, ic, lb]) => (
          <TouchableOpacity
            key={t}
            style={[s.tBtn, tool === t && s.tBtnOn]}
            onPress={() => { setTool(t); toolRef.current = t; }}
          >
            <Text style={s.tIc}>{ic}</Text>
            <Text style={[s.tLb, tool === t && { color: C.energizer }]}>{lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Hint + zoom controls ── */}
      <View style={s.hintBar}>
        <Text style={[s.hintTxt, { flex: 1 }]} numberOfLines={1}>
          {tool === 'post' && '📍 Tap canvas to place posts'}
          {tool === 'ht_bridge' && '🔴 Tap near post end for HT bridge'}
          {tool === 'earth_bridge' && '🟢 Tap near post end for Earth bridge'}
          {tool === 'fault' && '⚠ Tap a strand/bridge to mark faulted'}
          {tool === 'gate' && '🚪 Tap between posts to place/toggle gate'}
          {tool === 'delete' && '✕ Tap a post to remove it'}
        </Text>
        <Text style={s.scaleLabel}>{Math.round(scale * 100)}%</Text>
        <TouchableOpacity style={s.zBtn} onPress={() => zoomBy(1.3)}><Text style={s.zBtnTxt}>＋</Text></TouchableOpacity>
        <TouchableOpacity style={s.zBtn} onPress={() => zoomBy(1 / 1.3)}><Text style={s.zBtnTxt}>－</Text></TouchableOpacity>
        <TouchableOpacity style={s.zBtn} onPress={resetView}><Text style={s.zBtnTxt}>⊙</Text></TouchableOpacity>
      </View>

      {/* ── Fault summary panel (shows during/after sim) ── */}
      {simResult && simResult.faultCandidates.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.faultPanel}>
          {simResult.faultCandidates.slice(0, 5).map((fc, i) => (
            <View key={fc.edgeId} style={[s.faultCard, { borderColor: fc.score > 0.7 ? C.fault : C.simWarn }]}>
              <Text style={[s.faultCardTitle, { color: fc.score > 0.7 ? C.fault : C.simWarn }]}>
                #{i + 1} {fc.kind === 'bridge' ? '🔗' : '〰'} {Math.round(fc.score * 100)}%
              </Text>
              <Text style={s.faultCardLabel} numberOfLines={2}>{fc.label}</Text>
              <Text style={s.faultCardDetail}>
                ΔV: {fc.voltageDropKV.toFixed(2)} kV  I: {(fc.currentA * 1000).toFixed(1)} mA
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Canvas ── */}
      <View
        style={{ flex: 1, overflow: 'hidden' }}
        {...panResponder.panHandlers}
        onLayout={e => {
          canvasHRef.current = e.nativeEvent.layout.height;
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        >
          {/* Grid dots — only render within visible area to keep it fast */}
          {Array.from({ length: Math.floor(CW / 90) + 1 }, (_, xi) =>
            Array.from({ length: Math.floor(CH / 90) + 1 }, (_, yi) => (
              <Circle key={`g${xi}${yi}`} cx={xi * 90} cy={yi * 90} r={1.5} fill={C.border} opacity={0.4} />
            ))
          )}

          {posts.length === 0 && (
            <SvgText x={CW / 3} y={CH / 2} fill={C.muted} fontSize={14} textAnchor="middle">
              Tap here to place posts → then add bridges → run SIM
            </SvgText>
          )}

          {/* ── Energizer ── */}
          {sorted.length > 0 && (
            <G>
              <Rect x={ex2} y={ey2} width={EW} height={EH} fill={C.panel} stroke={C.energizer} strokeWidth={2} rx={4} />
              <SvgText x={ex2 + EW / 2} y={ey2 + 14} fill={C.energizer} fontSize={8} textAnchor="middle" fontWeight="bold">ENERGIZER</SvgText>
              <SvgText x={ex2 + EW / 2} y={ey2 + 26} fill={C.muted} fontSize={7} textAnchor="middle">8kV</SvgText>
              {simResult && (
                <SvgText x={ex2 + EW / 2} y={ey2 + 37} fill={C.voltage} fontSize={7} textAnchor="middle">
                  {simResult.simulatedOutputKV.toFixed(1)} kV
                </SvgText>
              )}
              {/* HT out line */}
              <Line x1={ex2 + EW} y1={ey2 + 10} x2={sorted[0].x} y2={oY + strandY(0, 0)} stroke={C.ht} strokeWidth={2} strokeDasharray="6,3" />
              {/* Earth return line */}
              <Line x1={ex2 + EW} y1={ey2 + 30} x2={sorted[0].x} y2={oY + strandY(1, 0)} stroke={C.earth} strokeWidth={2} strokeDasharray="6,3" />
            </G>
          )}

          {/* ── Strands ── */}
          {segments.map((seg, segIdx) => {
            const pA = posts.find(p => p.id === seg.postA);
            const pB = posts.find(p => p.id === seg.postB);
            if (!pA || !pB) return null;
            const isFirst = segIdx === 0;
            const isLast = segIdx === segments.length - 1;
            return Array.from({ length: n }, (_, si) => {
              const y = oY + strandY(si, 0);
              const id = `strand-${seg.id}-${si}`;
              return (
                <StrandLine
                  key={id}
                  id={id}
                  x1={pA.x} y1={y} x2={pB.x} y2={y}
                  color={strandColor(si, seg.id)}
                  active={activeIds.has(id)}
                  faulted={faultSet.has(id)}
                  strandLabel={`${si + 1}`}
                  typeLabel={si % 2 === 0 ? 'HT' : 'E'}
                  showLabels={isFirst || isLast}
                  tool={tool}
                  onFaultToggle={id => toggleFault(id, 'strand')}
                />
              );
            });
          })}

          {/* ── Posts ── */}
          {sorted.map((post, pi) => {
            const pTop2 = oY + PTOP;
            const pBot2 = oY + PTOP + strandH + PBOT;
            const isFirst = pi === 0;
            const isLast = pi === sorted.length - 1;
            return (
              <G key={`post-${post.id}`}>
                <Line x1={post.x} y1={pTop2 - 12} x2={post.x} y2={pBot2 + 8}
                  stroke={isFirst || isLast ? C.energizer : C.post}
                  strokeWidth={isFirst || isLast ? 10 : 8}
                  strokeLinecap="round" opacity={0.85} />
                <SvgText x={post.x} y={pBot2 + 20} fill={C.muted} fontSize={8} textAnchor="middle">
                  {isFirst ? 'START' : isLast ? 'END' : `P${pi + 1}`}
                </SvgText>
                {/* Voltage at this post (strand 0) */}
                {simResult && (() => {
                  const v = nodeVoltages[`nd_${post.id}_0`];
                  if (v === undefined) return null;
                  return (
                    <SvgText x={post.x} y={pTop2 - 20} fill={C.voltage} fontSize={7} textAnchor="middle" opacity={0.9}>
                      {(Math.abs(v) / 1000).toFixed(1)}kV
                    </SvgText>
                  );
                })()}
              </G>
            );
          })}

          {/* ── Bridges ── */}
          {bridges.map(b => {
            const seg2 = segments.find(s => s.id === b.segmentId);
            if (!seg2) return null;
            const pA2 = posts.find(p => p.id === seg2.postA);
            const pB2 = posts.find(p => p.id === seg2.postB);
            if (!pA2 || !pB2) return null;
            const px = b.side === 'left' ? Math.min(pA2.x, pB2.x) : Math.max(pA2.x, pB2.x);
            const dir = b.side === 'left' ? -1 : 1;
            const iB = b.strandIndex + 2;
            if (iB > n || b.strandIndex < 0) return null;
            const yA = oY + strandY(b.strandIndex, 0);
            const yB = oY + strandY(iB, 0);
            return (
              <BridgeClip
                key={`br-${b.id}`}
                id={b.id}
                px={px} yA={yA} yB={yB} dir={dir}
                color={bridgeColor(b)}
                active={activeIds.has(b.id)}
                faulted={faultSet.has(b.id)}
                tool={tool}
                onFaultToggle={id => toggleFault(id, 'bridge')}
                onDelete={deleteBridge}
                voltageLabel={voltageLabel(b)}
              />
            );
          })}

          {/* ── Gates ── */}
          {gates.map(g => {
            const seg = segments.find(s => s.id === g.segmentId);
            if (!seg) return null;
            const pA = posts.find(p => p.id === seg.postA);
            const pB = posts.find(p => p.id === seg.postB);
            if (!pA || !pB) return null;
            const gL = pA.x, gR = pB.x;
            const topY = oY + PTOP - 12;
            const botY = oY + PTOP + strandH + PBOT + 8;
            const gCol = g.open ? C.fault : '#a78bfa';
            return (
              <G key={'gate-' + g.id} onPress={() => {
                if (tool === 'gate' || tool === 'fault')
                  setGates(prev => prev.map(gg => gg.id === g.id ? { ...gg, open: !gg.open } : gg));
              }}>
                <Line x1={gL} y1={topY} x2={gL} y2={botY} stroke="#a78bfa" strokeWidth={11} strokeLinecap="round" opacity={0.85} />
                <Line x1={gR} y1={topY} x2={gR} y2={botY} stroke="#a78bfa" strokeWidth={11} strokeLinecap="round" opacity={0.85} />
                <Rect
                  x={g.open ? gL + (gR - gL) * 0.3 : gL + 4}
                  y={topY + 10}
                  width={(gR - gL) * 0.63}
                  height={botY - topY - 20}
                  fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="6,4" rx={2} opacity={0.5}
                />
                <SvgText
                  x={gL + (gR - gL) * 0.5}
                  y={(topY + botY) / 2 + 4}
                  fill={gCol} fontSize={9} textAnchor="middle" fontWeight="bold" opacity={0.75}
                >
                  {g.open ? 'OPEN' : 'GATE'}
                </SvgText>
              </G>
            );
          })}

        </Svg>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, borderBottomWidth: 1, borderColor: C.border },
  title:       { color: C.text, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  sub:         { color: C.muted, fontSize: 10, marginTop: 1 },
  topBtns:     { flexDirection: 'row', gap: 6 },
  btn:         { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  btnTxt:      { color: C.text, fontSize: 11, fontWeight: '600' },
  strandRow:   { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderColor: C.border, maxHeight: 36 },
  sLbl:        { color: C.muted, fontSize: 10, alignSelf: 'center', marginRight: 4 },
  chip:        { paddingHorizontal: 7, paddingVertical: 2, marginHorizontal: 2, borderRadius: 4, borderWidth: 1, borderColor: C.border },
  chipOn:      { borderColor: C.energizer, backgroundColor: '#1c1505' },
  cTxt:        { color: C.muted, fontSize: 11 },
  cOn:         { color: C.energizer, fontWeight: '700' },
  toolbar:     { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.panel },
  tBtn:        { alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
  tBtnOn:      { borderColor: C.energizer, backgroundColor: '#1c1505' },
  tIc:         { fontSize: 16 },
  tLb:         { color: C.muted, fontSize: 9, marginTop: 1 },
  hintBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.panel, borderBottomWidth: 1, borderColor: C.border },
  hintTxt:     { color: C.muted, fontSize: 10 },
  scaleLabel:  { color: C.muted, fontSize: 9, marginHorizontal: 4 },
  zBtn:        { width: 28, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 4, marginLeft: 4 },
  zBtnTxt:     { color: C.text, fontSize: 14, lineHeight: 20 },
  faultPanel:  { maxHeight: 72, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.panel },
  faultCard:   { margin: 4, padding: 6, borderWidth: 1, borderRadius: 6, minWidth: 140, backgroundColor: '#0d1219' },
  faultCardTitle: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  faultCardLabel: { color: C.text, fontSize: 9, marginBottom: 2 },
  faultCardDetail:{ color: C.muted, fontSize: 8 },
});
