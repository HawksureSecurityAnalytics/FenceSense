import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Line, Circle, Rect, Polygon, Text as SvgText, G } from 'react-native-svg';
import { FenceNode, FenceWire, CanvasState, Point, ComponentType } from '../types';
import { colors, WIRE_COLORS } from '../theme';

const SNAP = 24;
const { width: SW } = Dimensions.get('window');
const MIN_DRAG = 8; // minimum px movement to count as a wire

interface Props {
  nodes: FenceNode[];
  wires: FenceWire[];
  canvasState: CanvasState;
  onPlaceNode: (type: ComponentType, x: number, y: number) => void;
  onWireDraw: (x1: number, y1: number, x2: number, y2: number) => void;
  onSelectNode: (id: string | null) => void;
  onSelectWire: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onDeleteWire: (id: string) => void;
  onPan: (dx: number, dy: number) => void;
  onZoom: (scale: number, cx: number, cy: number) => void;
  highlightIds?: string[];
  canvasHeight: number;
}

function snap(v: number) { return Math.round(v / SNAP) * SNAP; }

function s2w(sx: number, sy: number, pan: Point, scale: number): Point {
  return { x: (sx - pan.x) / scale, y: (sy - pan.y) / scale };
}

function hitNode(wx: number, wy: number, nodes: FenceNode[]): FenceNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const r = ({energizer:22,earth_spike:12,gate:18,post:8,corner:10,join:6}[n.type]??14)+8;
    if ((wx-n.x)**2+(wy-n.y)**2 < r*r) return n;
  }
  return null;
}

function hitWire(wx: number, wy: number, wires: FenceWire[]): FenceWire | null {
  for (const w of wires) {
    const dx=w.x2-w.x1, dy=w.y2-w.y1, l2=dx*dx+dy*dy;
    if (l2===0) continue;
    const t=Math.max(0,Math.min(1,((wx-w.x1)*dx+(wy-w.y1)*dy)/l2));
    if (Math.hypot(wx-(w.x1+t*dx),wy-(w.y1+t*dy))<14) return w;
  }
  return null;
}

// Draw multiple parallel strand lines
const StrandLines = ({
  x1,y1,x2,y2,color,strands,opacity=1,dashArray,strokeW=2.5
}: {
  x1:number;y1:number;x2:number;y2:number;
  color:string;strands:number;opacity?:number;
  dashArray?:string;strokeW?:number;
}) => {
  const dx = x2-x1, dy = y2-y1;
  const len = Math.hypot(dx,dy);
  if (len===0) return null;
  // Perpendicular unit vector
  const px = -dy/len, py = dx/len;
  const spacing = 4; // px between strands
  const offset = (strands-1)/2;
  const lines = [];
  for (let i=0;i<strands;i++) {
    const o = (i-offset)*spacing;
    lines.push(
      <Line key={i}
        x1={x1+px*o} y1={y1+py*o}
        x2={x2+px*o} y2={y2+py*o}
        stroke={color} strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        strokeOpacity={opacity}
      />
    );
  }
  return <G>{lines}</G>;
};

const WireEl = ({w, selected, highlight}: {w:FenceWire;selected:boolean;highlight:boolean}) => {
  const col = WIRE_COLORS[w.type] || '#fff';
  const isBridge = w.type.startsWith('bridge');
  const strands = w.strandCount || 1;
  const dash = isBridge ? '10,6' : undefined;
  const sw = isBridge ? 2 : 2.5;
  const totalSpread = (strands-1)*4+12;

  return (
    <G>
      {/* Glow */}
      <Line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
        stroke={col} strokeWidth={totalSpread+6}
        strokeOpacity={selected||highlight ? 0.2 : 0.08}
        strokeLinecap="round"/>
      {/* Strands */}
      <StrandLines
        x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
        color={col} strands={strands}
        opacity={selected||highlight ? 1 : 0.92}
        dashArray={dash} strokeW={sw}
      />
      {/* Strand count label */}
      {strands > 1 && (
        <SvgText
          x={(w.x1+w.x2)/2} y={(w.y1+w.y2)/2-8}
          fill={col} fontSize={8} textAnchor="middle" opacity={0.8}>
          {strands}S
        </SvgText>
      )}
      {isBridge && (
        <SvgText
          x={(w.x1+w.x2)/2} y={(w.y1+w.y2)/2-18}
          fill={col} fontSize={7} textAnchor="middle" opacity={0.75}>
          {w.type==='bridge_hot'?'HT BR':'E BR'}
        </SvgText>
      )}
    </G>
  );
};

const NodeEl = ({n,selected,highlight}:{n:FenceNode;selected:boolean;highlight:boolean}) => {
  const sel = selected||highlight;
  const col = ({energizer:colors.amber,earth_spike:'#78716c',gate:colors.warn,
    post:'#6b7280',corner:'#94a3b8',join:colors.amber})[n.type]||colors.amber;

  if (n.type==='energizer') {
    const r=22;
    const pts=Array.from({length:6},(_,i)=>{
      const a=(Math.PI/3)*i-Math.PI/6;
      return `${n.x+r*Math.cos(a)},${n.y+r*Math.sin(a)}`;
    }).join(' ');
    return (
      <G>
        {sel&&<Circle cx={n.x} cy={n.y} r={r+10} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.6}/>}
        <Polygon points={pts} fill="rgba(245,166,35,0.13)" stroke={col} strokeWidth={2.5}/>
        <SvgText x={n.x} y={n.y+7} textAnchor="middle" fontSize={18} fill={col}>⚡</SvgText>
        <SvgText x={n.x+r+10} y={n.y-2} fill={colors.hot} fontSize={10} fontWeight="bold">+</SvgText>
        <SvgText x={n.x+r+10} y={n.y+10} fill={colors.earth} fontSize={10} fontWeight="bold">–</SvgText>
        <SvgText x={n.x} y={n.y+r+14} textAnchor="middle" fontSize={8} fill={col}>{n.label||'ENERGIZER'}</SvgText>
      </G>
    );
  }
  if (n.type==='earth_spike') {
    const r=12;
    return (
      <G>
        {sel&&<Circle cx={n.x} cy={n.y} r={r+8} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.5}/>}
        <Polygon points={`${n.x},${n.y-r} ${n.x-r*0.7},${n.y+r*0.3} ${n.x+r*0.7},${n.y+r*0.3}`} fill={col}/>
        <Line x1={n.x} y1={n.y+r*0.3} x2={n.x} y2={n.y+r*2} stroke="#a8a29e" strokeWidth={2}/>
        <Line x1={n.x-5} y1={n.y+r*0.8} x2={n.x+5} y2={n.y+r*0.8} stroke="#a8a29e" strokeWidth={1.5}/>
        <Line x1={n.x-3} y1={n.y+r*1.3} x2={n.x+3} y2={n.y+r*1.3} stroke="#a8a29e" strokeWidth={1.5}/>
        <SvgText x={n.x} y={n.y+r*2.6} textAnchor="middle" fontSize={7} fill="#6b7280">GND</SvgText>
      </G>
    );
  }
  if (n.type==='gate') {
    const gw=40,gh=20;
    return (
      <G>
        {sel&&<Rect x={n.x-gw/2-6} y={n.y-gh/2-6} width={gw+12} height={gh+12} rx={4} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.6}/>}
        <Rect x={n.x-gw/2} y={n.y-gh/2} width={gw} height={gh} fill="rgba(245,158,11,0.1)" stroke={col} strokeWidth={2} rx={2}/>
        <Line x1={n.x-gw/2} y1={n.y-gh*0.25} x2={n.x+gw/2} y2={n.y-gh*0.25} stroke="rgba(245,158,11,0.35)" strokeWidth={1}/>
        <Line x1={n.x-gw/2} y1={n.y+gh*0.25} x2={n.x+gw/2} y2={n.y+gh*0.25} stroke="rgba(245,158,11,0.35)" strokeWidth={1}/>
        <Line x1={n.x-gw/2-6} y1={n.y} x2={n.x-gw/2} y2={n.y} stroke={colors.hot} strokeWidth={2} strokeDasharray="3,3"/>
        <Line x1={n.x+gw/2} y1={n.y} x2={n.x+gw/2+6} y2={n.y} stroke={colors.hot} strokeWidth={2} strokeDasharray="3,3"/>
        <SvgText x={n.x} y={n.y+gh/2+12} textAnchor="middle" fontSize={8} fill={col}>{n.label||'GATE'}</SvgText>
      </G>
    );
  }
  if (n.type==='post') {
    return (
      <G>
        {sel&&<Circle cx={n.x} cy={n.y} r={14} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.5}/>}
        <Circle cx={n.x} cy={n.y} r={8} fill="rgba(107,114,128,0.3)" stroke="#6b7280" strokeWidth={2}/>
        <Circle cx={n.x} cy={n.y} r={3} fill="#6b7280"/>
      </G>
    );
  }
  if (n.type==='corner') {
    const r=10;
    return (
      <G>
        {sel&&<Rect x={n.x-r-6} y={n.y-r-6} width={r*2+12} height={r*2+12} rx={3} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.5}/>}
        <Rect x={n.x-r} y={n.y-r} width={r*2} height={r*2} fill="rgba(148,163,184,0.1)" stroke="#94a3b8" strokeWidth={2}/>
        <Line x1={n.x-r} y1={n.y-r} x2={n.x+r} y2={n.y+r} stroke="rgba(148,163,184,0.4)" strokeWidth={1}/>
      </G>
    );
  }
  return <Circle cx={n.x} cy={n.y} r={6} fill={col}/>;
};

export default function FenceCanvas({
  nodes, wires, canvasState,
  onPlaceNode, onWireDraw,
  onSelectNode, onSelectWire,
  onMoveNode, onDeleteNode, onDeleteWire,
  onPan, onZoom, highlightIds=[], canvasHeight,
}: Props) {
  // Live drag state
  const [dragStart, setDragStart] = useState<Point|null>(null);
  const [dragEnd,   setDragEnd]   = useState<Point|null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string|null>(null);

  const lastPan  = useRef<Point>({x:0,y:0});
  const lastDist = useRef(0);
  const touchStartPos = useRef<Point>({x:0,y:0});
  const didMove = useRef(false);

  const {tool, wireMode, strandCount, pendingComponent,
    selectedNodeId, selectedWireId, pan, scale} = canvasState;

  const toWorld = (lx:number,ly:number) => s2w(lx,ly,pan,scale);
  const toScreen = (wx:number,wy:number) => ({x:wx*scale+pan.x, y:wy*scale+pan.y});

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: ()=>true,
    onMoveShouldSetPanResponder:  ()=>true,

    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      didMove.current = false;

      if (touches.length===2) {
        lastDist.current = Math.hypot(
          touches[0].pageX-touches[1].pageX,
          touches[0].pageY-touches[1].pageY);
        return;
      }

      const lx = e.nativeEvent.locationX;
      const ly = e.nativeEvent.locationY;
      lastPan.current  = {x:touches[0].pageX, y:touches[0].pageY};
      touchStartPos.current = {x:lx, y:ly};

      const wp = toWorld(lx,ly);

      if (tool==='wire') {
        setDragStart({x:snap(wp.x), y:snap(wp.y)});
        setDragEnd(null);
      }

      if (tool==='select') {
        const hn = hitNode(wp.x, wp.y, nodes);
        if (hn) setDraggingNodeId(hn.id);
      }
    },

    onPanResponderMove: (e) => {
      const touches = e.nativeEvent.touches;

      // Pinch zoom
      if (touches.length===2) {
        const dist=Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY);
        const cx=(touches[0].pageX+touches[1].pageX)/2;
        const cy=(touches[0].pageY+touches[1].pageY)/2;
        if (lastDist.current>0) onZoom(dist/lastDist.current,cx,cy);
        lastDist.current=dist;
        return;
      }

      const lx = e.nativeEvent.locationX;
      const ly = e.nativeEvent.locationY;
      const tx = touches[0].pageX;
      const ty = touches[0].pageY;
      const moved = Math.hypot(tx-lastPan.current.x, ty-lastPan.current.y);
      if (moved>2) didMove.current=true;

      if (tool==='wire' && dragStart) {
        const wp = toWorld(lx,ly);
        setDragEnd({x:snap(wp.x), y:snap(wp.y)});
        return;
      }

      if (tool==='select' && draggingNodeId) {
        const wp = toWorld(lx,ly);
        onMoveNode(draggingNodeId, snap(wp.x), snap(wp.y));
        return;
      }

      if (tool==='pan') {
        onPan(tx-lastPan.current.x, ty-lastPan.current.y);
      }

      lastPan.current={x:tx,y:ty};
    },

    onPanResponderRelease: (e) => {
      const lx = e.nativeEvent.locationX;
      const ly = e.nativeEvent.locationY;
      const wp = toWorld(lx,ly);
      const sx = snap(wp.x), sy = snap(wp.y);

      lastDist.current=0;

      // Wire: place on release
      if (tool==='wire' && dragStart) {
        const dx = sx-dragStart.x, dy = sy-dragStart.y;
        if (Math.hypot(dx,dy) > MIN_DRAG) {
          onWireDraw(dragStart.x, dragStart.y, sx, sy);
        }
        setDragStart(null);
        setDragEnd(null);
        return;
      }

      // Place component
      if (tool==='place' && pendingComponent) {
        onPlaceNode(pendingComponent, sx, sy);
        return;
      }

      // Select (tap, not drag)
      if (tool==='select') {
        setDraggingNodeId(null);
        if (!didMove.current) {
          const hn = hitNode(wp.x, wp.y, nodes);
          if (hn) { onSelectNode(hn.id); return; }
          const hw = hitWire(wp.x, wp.y, wires);
          if (hw) { onSelectWire(hw.id); return; }
          onSelectNode(null); onSelectWire(null);
        }
        return;
      }

      // Delete
      if (tool==='delete') {
        const hn = hitNode(wp.x, wp.y, nodes);
        if (hn) { onDeleteNode(hn.id); return; }
        const hw = hitWire(wp.x, wp.y, wires);
        if (hw) { onDeleteWire(hw.id); return; }
      }
    },
  })).current;

  // Screen coords helpers
  const ts = (w:FenceWire) => ({...w,
    x1:w.x1*scale+pan.x, y1:w.y1*scale+pan.y,
    x2:w.x2*scale+pan.x, y2:w.y2*scale+pan.y});
  const ns = (n:FenceNode) => ({...n, x:n.x*scale+pan.x, y:n.y*scale+pan.y});

  // Grid
  const gs=SNAP*scale;
  const gridLines=[];
  for (let x=(pan.x%gs+gs)%gs; x<SW; x+=gs)
    gridLines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={canvasHeight} stroke="rgba(20,40,65,0.8)" strokeWidth={0.5}/>);
  for (let y=(pan.y%gs+gs)%gs; y<canvasHeight; y+=gs)
    gridLines.push(<Line key={`h${y}`} x1={0} y1={y} x2={SW} y2={y} stroke="rgba(20,40,65,0.8)" strokeWidth={0.5}/>);

  // Live preview wire
  const previewColor = WIRE_COLORS[wireMode];
  const previewStart = dragStart ? toScreen(dragStart.x,dragStart.y) : null;
  const previewEnd   = dragEnd   ? toScreen(dragEnd.x,  dragEnd.y)   : null;

  return (
    <View style={[styles.container,{height:canvasHeight}]} {...panResponder.panHandlers}>
      <Svg width={SW} height={canvasHeight}>
        {gridLines}

        {/* Placed wires */}
        {wires.map(ts).map(w=>(
          <WireEl key={w.id} w={w}
            selected={w.id===selectedWireId}
            highlight={highlightIds.includes(w.id)}/>
        ))}

        {/* Live drag preview */}
        {previewStart && previewEnd && (
          <G>
            <StrandLines
              x1={previewStart.x} y1={previewStart.y}
              x2={previewEnd.x}   y2={previewEnd.y}
              color={previewColor} strands={strandCount}
              opacity={0.5} strokeW={2}
            />
          </G>
        )}

        {/* Start dot */}
        {previewStart && (
          <Circle cx={previewStart.x} cy={previewStart.y} r={6}
            fill={previewColor} opacity={0.9}/>
        )}

        {/* Nodes */}
        {nodes.map(ns).map(n=>(
          <NodeEl key={n.id} n={n}
            selected={n.id===selectedNodeId}
            highlight={highlightIds.includes(n.id)}/>
        ))}

        {/* Ghost placement */}
        {tool==='place' && pendingComponent && previewEnd && (
          <Circle cx={previewEnd.x} cy={previewEnd.y} r={18}
            fill={colors.amber} opacity={0.2}
            stroke={colors.amber} strokeWidth={1.5} strokeDasharray="4,3"/>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{backgroundColor:'#0d1219'},
});
