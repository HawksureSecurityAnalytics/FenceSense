import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Line, Circle, Rect, Polygon, Text as SvgText, G, Path } from 'react-native-svg';
import { FenceNode, FenceWire, CanvasState, Point, ComponentType } from '../types';
import { colors, WIRE_COLORS } from '../theme';

const SNAP = 24;
const { width: SW } = Dimensions.get('window');

function snapV(v: number) { return Math.round(v / SNAP) * SNAP; }
function toWorld(sx:number,sy:number,pan:Point,scale:number):Point{return{x:(sx-pan.x)/scale,y:(sy-pan.y)/scale};}
function toScreen(wx:number,wy:number,pan:Point,scale:number):Point{return{x:wx*scale+pan.x,y:wy*scale+pan.y};}
function perpUnit(x1:number,y1:number,x2:number,y2:number){
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<1)return{px:0,py:0};
  return{px:-(y2-y1)/len,py:(x2-x1)/len};
}
function alongUnit(x1:number,y1:number,x2:number,y2:number){
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<1)return{ax:1,ay:0};
  return{ax:(x2-x1)/len,ay:(y2-y1)/len};
}
function hitNode(wx:number,wy:number,nodes:FenceNode[]):FenceNode|null{
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    const r=({energizer:24,earth_spike:14,gate:20,post:10,corner:12,join:8}[n.type]??14)+6;
    if((wx-n.x)**2+(wy-n.y)**2<r*r)return n;
  }
  return null;
}
function hitWire(wx:number,wy:number,wires:FenceWire[]):FenceWire|null{
  for(const w of wires){
    const dx=w.x2-w.x1,dy=w.y2-w.y1,l2=dx*dx+dy*dy;
    if(l2===0)continue;
    const t=Math.max(0,Math.min(1,((wx-w.x1)*dx+(wy-w.y1)*dy)/l2));
    if(Math.hypot(wx-(w.x1+t*dx),wy-(w.y1+t*dy))<16)return w;
  }
  return null;
}

interface Props{
  nodes:FenceNode[];wires:FenceWire[];canvasState:CanvasState;
  onPlaceNode:(type:ComponentType,x:number,y:number)=>void;
  onWireDraw:(x1:number,y1:number,x2:number,y2:number)=>void;
  onSelectNode:(id:string|null)=>void;onSelectWire:(id:string|null)=>void;
  onMoveNode:(id:string,x:number,y:number)=>void;
  onDeleteNode:(id:string)=>void;onDeleteWire:(id:string)=>void;
  onPan:(dx:number,dy:number)=>void;onZoom:(s:number,cx:number,cy:number)=>void;
  highlightIds?:string[];canvasHeight:number;
}

const STRAND_GAP = 7;
const LOOP_CAP   = 10; // tight post loop cap size in world units

// Renders one wire segment: parallel strands + tight post loops at ends
const FenceWireEl = ({w,selected,highlight,pan,scale}:{
  w:FenceWire;selected:boolean;highlight:boolean;pan:Point;scale:number;
}) => {
  const col  = WIRE_COLORS[w.type] || '#fff';
  const isBr = w.type.startsWith('bridge');
  const n    = w.strandCount || 1;
  const dash = isBr ? '7,4' : undefined;
  const sw   = 2.2;
  const op   = selected||highlight ? 1 : 0.9;
  const glOp = selected||highlight ? 0.2 : 0.07;

  // Screen coords
  const x1=w.x1*scale+pan.x, y1=w.y1*scale+pan.y;
  const x2=w.x2*scale+pan.x, y2=w.y2*scale+pan.y;
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<2) return null;

  const {px,py}=perpUnit(x1,y1,x2,y2);
  const {ax,ay}=alongUnit(x1,y1,x2,y2);
  const gap = STRAND_GAP;
  // Centre strands around the drawn line
  const spread = (n-1)*gap;
  const o0 = -spread/2;

  // Strand lines
  const lines = Array.from({length:n},(_,i)=>{
    const o = o0+i*gap;
    return <Line key={i}
      x1={x1+px*o} y1={y1+py*o} x2={x2+px*o} y2={y2+py*o}
      stroke={col} strokeWidth={sw} strokeLinecap="round"
      strokeDasharray={dash} strokeOpacity={op}/>;
  });

  // Tight post loops at each end — only for real wires (not bridges)
  // Loop cap extends OUTWARD from the wire endpoint
  const loops:React.ReactElement[] = [];
  if(!isBr && n>=2){
    const capS = LOOP_CAP*scale; // cap size in screen px
    [0,1].forEach(ei=>{
      const ex=ei===0?x1:x2, ey=ei===0?y1:y2;
      const cax=ei===0?-ax:ax, cay=ei===0?-ay:ay; // cap direction away from wire

      for(let i=0;i<n-1;i+=2){
        const oa = o0+i*gap;
        const ob = o0+(i+1)*gap;
        const ax1=ex+px*oa, ay1=ey+py*oa; // strand i at end
        const bx1=ex+px*ob, by1=ey+py*ob; // strand i+1 at end

        // Cap point: midpoint between the two strands, extended outward
        const midO=(oa+ob)/2;
        const cpx=ex+px*midO+cax*capS;
        const cpy=ey+py*midO+cay*capS;

        // Smooth bezier arc: strand i → cap → strand i+1
        loops.push(
          <Path key={`lp${ei}${i}`}
            d={`M ${ax1} ${ay1} Q ${cpx} ${cpy} ${bx1} ${by1}`}
            stroke={col} strokeWidth={sw+0.5}
            fill="none" strokeLinecap="round" strokeOpacity={op}/>
        );
      }
      // Odd strand: tiny end-cap hook
      if(n%2!==0){
        const lastO=o0+(n-1)*gap;
        const lx=ex+px*lastO, ly=ey+py*lastO;
        const cpx=lx+cax*capS*0.6, cpy=ly+cay*capS*0.6;
        loops.push(
          <Path key={`lpOdd${ei}`}
            d={`M ${lx} ${ly} Q ${cpx} ${cpy} ${lx+px*0.5} ${ly+py*0.5}`}
            stroke={col} strokeWidth={sw} fill="none"
            strokeLinecap="round" strokeOpacity={op*0.55}/>
        );
      }
    });
  }

  // Strand count label at midpoint, above the bundle
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  const labelOff = spread/2+12;

  return(
    <G>
      {/* Glow */}
      <Line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={col} strokeWidth={spread+LOOP_CAP*scale*2+6}
        strokeOpacity={glOp} strokeLinecap="round"/>
      {lines}
      {loops}
      {n>1&&!isBr&&(
        <SvgText x={mx+px*(-labelOff)} y={my+py*(-labelOff)}
          fill={col} fontSize={8} textAnchor="middle"
          opacity={0.85} fontWeight="bold">{n}S</SvgText>
      )}
      {isBr&&(
        <SvgText x={mx} y={my-8}
          fill={col} fontSize={7} textAnchor="middle" opacity={0.7}>
          {w.type==='bridge_hot'?'HT BR':'E BR'}
        </SvgText>
      )}
    </G>
  );
};

const NodeEl=({n,selected,highlight}:{n:FenceNode;selected:boolean;highlight:boolean})=>{
  const sel=selected||highlight;
  const col=({energizer:colors.amber,earth_spike:'#78716c',gate:colors.warn,
    post:'#6b7280',corner:'#94a3b8',join:colors.amber})[n.type]||colors.amber;
  switch(n.type){
    case 'energizer':{
      const r=22;
      const pts=Array.from({length:6},(_,i)=>{const a=(Math.PI/3)*i-Math.PI/6;return`${n.x+r*Math.cos(a)},${n.y+r*Math.sin(a)}`;}).join(' ');
      return(<G>
        {sel&&<Circle cx={n.x} cy={n.y} r={r+10} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.6}/>}
        <Polygon points={pts} fill="rgba(245,166,35,0.13)" stroke={col} strokeWidth={2.5}/>
        <SvgText x={n.x} y={n.y+7} textAnchor="middle" fontSize={18} fill={col}>⚡</SvgText>
        <SvgText x={n.x+r+10} y={n.y-2}  fill={colors.hot}   fontSize={11} fontWeight="bold">+</SvgText>
        <SvgText x={n.x+r+10} y={n.y+12} fill={colors.earth} fontSize={11} fontWeight="bold">–</SvgText>
        <SvgText x={n.x} y={n.y+r+14} textAnchor="middle" fontSize={8} fill={col}>{n.label||'ENERGIZER'}</SvgText>
      </G>);
    }
    case 'earth_spike':{
      const r=12;
      return(<G>
        {sel&&<Circle cx={n.x} cy={n.y} r={r+8} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.5}/>}
        <Polygon points={`${n.x},${n.y-r} ${n.x-r*0.7},${n.y+r*0.3} ${n.x+r*0.7},${n.y+r*0.3}`} fill={col}/>
        <Line x1={n.x} y1={n.y+r*0.3} x2={n.x} y2={n.y+r*2} stroke="#a8a29e" strokeWidth={2}/>
        <Line x1={n.x-5} y1={n.y+r*0.9} x2={n.x+5} y2={n.y+r*0.9} stroke="#a8a29e" strokeWidth={1.5}/>
        <Line x1={n.x-3} y1={n.y+r*1.4} x2={n.x+3} y2={n.y+r*1.4} stroke="#a8a29e" strokeWidth={1.5}/>
        <SvgText x={n.x} y={n.y+r*2.7} textAnchor="middle" fontSize={7} fill="#6b7280">GND</SvgText>
      </G>);
    }
    case 'gate':{
      const gw=40,gh=20;
      return(<G>
        {sel&&<Rect x={n.x-gw/2-6} y={n.y-gh/2-6} width={gw+12} height={gh+12} rx={4} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.6}/>}
        <Rect x={n.x-gw/2} y={n.y-gh/2} width={gw} height={gh} fill="rgba(245,158,11,0.1)" stroke={col} strokeWidth={2} rx={2}/>
        <Line x1={n.x-gw/2-10} y1={n.y-5} x2={n.x-gw/2} y2={n.y-5} stroke={colors.hot}   strokeWidth={2} strokeDasharray="3,3"/>
        <Line x1={n.x+gw/2}    y1={n.y-5} x2={n.x+gw/2+10} y2={n.y-5} stroke={colors.hot}   strokeWidth={2} strokeDasharray="3,3"/>
        <Line x1={n.x-gw/2-10} y1={n.y+5} x2={n.x-gw/2} y2={n.y+5} stroke={colors.earth} strokeWidth={2} strokeDasharray="3,3"/>
        <Line x1={n.x+gw/2}    y1={n.y+5} x2={n.x+gw/2+10} y2={n.y+5} stroke={colors.earth} strokeWidth={2} strokeDasharray="3,3"/>
        <SvgText x={n.x} y={n.y+gh/2+13} textAnchor="middle" fontSize={8} fill={col}>{n.label||'GATE'}</SvgText>
      </G>);
    }
    case 'post':
      return(<G>
        {sel&&<Circle cx={n.x} cy={n.y} r={15} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.5}/>}
        <Circle cx={n.x} cy={n.y} r={9} fill="rgba(107,114,128,0.3)" stroke="#6b7280" strokeWidth={2}/>
        <Circle cx={n.x} cy={n.y} r={3} fill="#6b7280"/>
      </G>);
    case 'corner':{
      const r=10;
      return(<G>
        {sel&&<Rect x={n.x-r-6} y={n.y-r-6} width={r*2+12} height={r*2+12} rx={3} stroke={col} strokeWidth={1.5} strokeDasharray="4,3" fill="none" opacity={0.5}/>}
        <Rect x={n.x-r} y={n.y-r} width={r*2} height={r*2} fill="rgba(148,163,184,0.1)" stroke="#94a3b8" strokeWidth={2}/>
        <Line x1={n.x-r} y1={n.y-r} x2={n.x+r} y2={n.y+r} stroke="rgba(148,163,184,0.4)" strokeWidth={1}/>
      </G>);
    }
    default:return<Circle cx={n.x} cy={n.y} r={6} fill={col}/>;
  }
};

export default function FenceCanvas({
  nodes,wires,canvasState,
  onPlaceNode,onWireDraw,onSelectNode,onSelectWire,
  onMoveNode,onDeleteNode,onDeleteWire,onPan,onZoom,
  highlightIds=[],canvasHeight,
}:Props){
  const{tool,wireMode,strandCount,pendingComponent,selectedNodeId,selectedWireId,pan,scale}=canvasState;
  const stateRef=useRef(canvasState); stateRef.current=canvasState;
  const nodesRef=useRef(nodes);       nodesRef.current=nodes;
  const wiresRef=useRef(wires);       wiresRef.current=wires;
  const onPlaceNodeRef =useRef(onPlaceNode);  onPlaceNodeRef.current =onPlaceNode;
  const onWireDrawRef  =useRef(onWireDraw);   onWireDrawRef.current  =onWireDraw;
  const onSelectNodeRef=useRef(onSelectNode); onSelectNodeRef.current=onSelectNode;
  const onSelectWireRef=useRef(onSelectWire); onSelectWireRef.current=onSelectWire;
  const onMoveNodeRef  =useRef(onMoveNode);   onMoveNodeRef.current  =onMoveNode;
  const onDeleteNodeRef=useRef(onDeleteNode); onDeleteNodeRef.current=onDeleteNode;
  const onDeleteWireRef=useRef(onDeleteWire); onDeleteWireRef.current=onDeleteWire;
  const onPanRef       =useRef(onPan);        onPanRef.current       =onPan;
  const onZoomRef      =useRef(onZoom);       onZoomRef.current      =onZoom;

  const wireStartRef=useRef<Point|null>(null);
  const[wirePreview,setWirePreview]=useState<{start:Point;end:Point}|null>(null);
  const lastPagePos=useRef<Point>({x:0,y:0});
  const lastDist=useRef(0);
  const dragNodeId=useRef<string|null>(null);
  const hasMoved=useRef(false);

  const panResponder=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder: ()=>true,
    onPanResponderGrant:(evt)=>{
      const{tool:t,pan:p,scale:s}=stateRef.current;
      const{touches}=evt.nativeEvent;
      hasMoved.current=false;lastDist.current=0;
      if(touches.length>=2){lastDist.current=Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY);return;}
      const lx=touches[0].locationX,ly=touches[0].locationY;
      lastPagePos.current={x:touches[0].pageX,y:touches[0].pageY};
      if(t==='wire'){const wp=toWorld(lx,ly,p,s);const sn={x:snapV(wp.x),y:snapV(wp.y)};wireStartRef.current=sn;setWirePreview({start:sn,end:sn});}
      else if(t==='select'){const wp=toWorld(lx,ly,p,s);dragNodeId.current=hitNode(wp.x,wp.y,nodesRef.current)?.id??null;}
    },
    onPanResponderMove:(evt)=>{
      const{tool:t,pan:p,scale:s}=stateRef.current;
      const{touches}=evt.nativeEvent;
      if(touches.length>=2){
        const dist=Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY);
        if(lastDist.current>0){const cx=(touches[0].pageX+touches[1].pageX)/2;const cy=(touches[0].pageY+touches[1].pageY)/2;onZoomRef.current(dist/lastDist.current,cx,cy);}
        lastDist.current=dist;return;
      }
      const lx=touches[0].locationX,ly=touches[0].locationY;
      const px2=touches[0].pageX,py2=touches[0].pageY;
      if(Math.hypot(px2-lastPagePos.current.x,py2-lastPagePos.current.y)>3)hasMoved.current=true;
      if(t==='wire'&&wireStartRef.current){const wp=toWorld(lx,ly,p,s);setWirePreview({start:wireStartRef.current,end:{x:snapV(wp.x),y:snapV(wp.y)}});lastPagePos.current={x:px2,y:py2};return;}
      if(t==='select'&&dragNodeId.current){const wp=toWorld(lx,ly,p,s);onMoveNodeRef.current(dragNodeId.current,snapV(wp.x),snapV(wp.y));lastPagePos.current={x:px2,y:py2};return;}
      if(t==='pan'){onPanRef.current(px2-lastPagePos.current.x,py2-lastPagePos.current.y);lastPagePos.current={x:px2,y:py2};return;}
      lastPagePos.current={x:px2,y:py2};
    },
    onPanResponderRelease:(evt)=>{
      const{tool:t,pan:p,scale:s,pendingComponent:pc}=stateRef.current;
      const lx=evt.nativeEvent.locationX,ly=evt.nativeEvent.locationY;
      const wp=toWorld(lx,ly,p,s);const sx=snapV(wp.x),sy=snapV(wp.y);
      if(t==='wire'&&wireStartRef.current){
        const start=wireStartRef.current;
        if(Math.hypot(sx-start.x,sy-start.y)>=SNAP*0.5)onWireDrawRef.current(start.x,start.y,sx,sy);
        wireStartRef.current=null;setWirePreview(null);return;
      }
      if(t==='place'&&pc){onPlaceNodeRef.current(pc,sx,sy);return;}
      if(t==='select'){
        dragNodeId.current=null;
        if(!hasMoved.current){
          const hn=hitNode(wp.x,wp.y,nodesRef.current);if(hn){onSelectNodeRef.current(hn.id);return;}
          const hw=hitWire(wp.x,wp.y,wiresRef.current);if(hw){onSelectWireRef.current(hw.id);return;}
          onSelectNodeRef.current(null);onSelectWireRef.current(null);
        }
        return;
      }
      if(t==='delete'){
        const hn=hitNode(wp.x,wp.y,nodesRef.current);if(hn){onDeleteNodeRef.current(hn.id);return;}
        const hw=hitWire(wp.x,wp.y,wiresRef.current);if(hw){onDeleteWireRef.current(hw.id);return;}
      }
    },
    onPanResponderTerminate:()=>{wireStartRef.current=null;setWirePreview(null);dragNodeId.current=null;},
  })).current;

  const gs=SNAP*scale;
  const gridLines=[];
  for(let x=(pan.x%gs+gs)%gs;x<SW;x+=gs)
    gridLines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={canvasHeight} stroke="rgba(20,40,65,0.85)" strokeWidth={0.5}/>);
  for(let y=(pan.y%gs+gs)%gs;y<canvasHeight;y+=gs)
    gridLines.push(<Line key={`h${y}`} x1={0} y1={y} x2={SW} y2={y} stroke="rgba(20,40,65,0.85)" strokeWidth={0.5}/>);

  const previewColor=WIRE_COLORS[wireMode];
  const previewSS=wirePreview?{
    start:toScreen(wirePreview.start.x,wirePreview.start.y,pan,scale),
    end:  toScreen(wirePreview.end.x,  wirePreview.end.y,  pan,scale),
  }:null;

  const sortedWires=[
    ...wires.filter(w=>w.type==='earth'||w.type==='bridge_earth'),
    ...wires.filter(w=>w.type==='hot'||w.type==='bridge_hot'),
  ];

  return(
    <View style={[styles.root,{height:canvasHeight}]} {...panResponder.panHandlers}>
      <Svg width={SW} height={canvasHeight}>
        {gridLines}
        {sortedWires.map(w=>(
          <FenceWireEl key={w.id} w={w}
            selected={w.id===selectedWireId}
            highlight={highlightIds.includes(w.id)}
            pan={pan} scale={scale}/>
        ))}
        {previewSS&&(
          <G>
            <Line x1={previewSS.start.x} y1={previewSS.start.y}
              x2={previewSS.end.x} y2={previewSS.end.y}
              stroke={previewColor} strokeWidth={strandCount*STRAND_GAP+20}
              strokeOpacity={0.08} strokeLinecap="round"/>
            {Array.from({length:strandCount},(_,i)=>{
              const{px,py}=perpUnit(previewSS.start.x,previewSS.start.y,previewSS.end.x,previewSS.end.y);
              const o=(-(strandCount-1)/2+i)*STRAND_GAP;
              return<Line key={i}
                x1={previewSS.start.x+px*o} y1={previewSS.start.y+py*o}
                x2={previewSS.end.x+px*o}   y2={previewSS.end.y+py*o}
                stroke={previewColor} strokeWidth={2.2} strokeLinecap="round" strokeOpacity={0.65}/>;
            })}
            <Circle cx={previewSS.start.x} cy={previewSS.start.y} r={5} fill={previewColor} opacity={0.9}/>
            <Circle cx={previewSS.end.x}   cy={previewSS.end.y}   r={4} fill={previewColor} opacity={0.7}/>
          </G>
        )}
        {nodes.map(n=>{
          const ns={...n,x:n.x*scale+pan.x,y:n.y*scale+pan.y};
          return<NodeEl key={n.id} n={ns} selected={n.id===selectedNodeId} highlight={highlightIds.includes(n.id)}/>;
        })}
        {tool==='place'&&pendingComponent&&previewSS&&(
          <Circle cx={previewSS.end.x} cy={previewSS.end.y}
            r={20} fill={colors.amber} opacity={0.15}
            stroke={colors.amber} strokeWidth={1.5} strokeDasharray="4,3"/>
        )}
      </Svg>
    </View>
  );
}
const styles=StyleSheet.create({root:{backgroundColor:'#0d1219'}});
