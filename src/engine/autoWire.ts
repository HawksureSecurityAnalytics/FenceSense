import { FenceNode, FenceWire, ComponentType } from '../types';

const SNAP = 24;
const M_PER_SNAP = 2;
const EARTH_OFFSET = 6;          // tight alongside HT wire
const SPIKE_INTERVAL_PX = 240;   // ~100m in canvas units

function snapV(v: number) { return Math.round(v / SNAP) * SNAP; }
function uid() { return `aw_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
function wireLen(x1:number,y1:number,x2:number,y2:number) {
  return Math.hypot(x2-x1,y2-y1)/SNAP*M_PER_SNAP;
}
function key(x:number,y:number){ return `${Math.round(x/SNAP)},${Math.round(y/SNAP)}`; }

// Perpendicular offset — pushes wire sideways relative to its direction
function perp(x1:number,y1:number,x2:number,y2:number,dist:number){
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<1) return {dx:0,dy:0};
  return { dx:-(y2-y1)/len*dist, dy:(x2-x1)/len*dist };
}

// Find the wire endpoint (x1,y1 or x2,y2) closest to a given point
function nearestEndpoint(wires: FenceWire[], tx:number, ty:number){
  let best:{x:number,y:number}|null=null, bd=Infinity;
  wires.forEach(w=>{
    const d1=Math.hypot(w.x1-tx,w.y1-ty);
    const d2=Math.hypot(w.x2-tx,w.y2-ty);
    if(d1<bd){bd=d1;best={x:w.x1,y:w.y1};}
    if(d2<bd){bd=d2;best={x:w.x2,y:w.y2};}
  });
  return best;
}

export interface AutoWireResult {
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
  const gates     = existingNodes.filter(n => n.type === 'gate');

  if (!energizer) return { nodesToAdd:[], wiresToAdd:[], summary:['⛔ Place an Energizer first.'] };
  if (!htWires.length) return { nodesToAdd:[], wiresToAdd:[], summary:['⛔ Draw HT (red) fence wire first.'] };

  // ── 1. Earth wire tight alongside each HT wire ────────────────────────
  let earthAdded = 0;
  const existingEarth = existingWires.filter(w=>w.type==='earth');

  htWires.forEach(ht => {
    // Skip if earth already runs alongside this segment
    const htMx=(ht.x1+ht.x2)/2, htMy=(ht.y1+ht.y2)/2;
    const already = existingEarth.some(e=>{
      const eMx=(e.x1+e.x2)/2,eMy=(e.y1+e.y2)/2;
      return Math.hypot(htMx-eMx,htMy-eMy) < SNAP*3;
    });
    if(already) return;

    const {dx,dy} = perp(ht.x1,ht.y1,ht.x2,ht.y2,EARTH_OFFSET);
    wiresToAdd.push({
      id:uid(), type:'earth',
      x1:ht.x1+dx, y1:ht.y1+dy,
      x2:ht.x2+dx, y2:ht.y2+dy,
      strandCount: ht.strandCount||3,
      lengthMeters: wireLen(ht.x1,ht.y1,ht.x2,ht.y2),
    });
    earthAdded++;
  });
  if(earthAdded) summary.push(`✅ ${earthAdded} earth wire(s) added alongside HT`);

  // ── 2. Earth spikes along earth wires ─────────────────────────────────
  const allEarth = [
    ...existingEarth,
    ...wiresToAdd.filter(w=>w.type==='earth'),
  ];
  let spikesAdded = 0;
  const existingSpikeCount = existingNodes.filter(n=>n.type==='earth_spike').length;

  allEarth.forEach(ew=>{
    const segLen = Math.hypot(ew.x2-ew.x1,ew.y2-ew.y1);
    const numSpikes = Math.max(1, Math.round(segLen/SPIKE_INTERVAL_PX));
    for(let i=0;i<=numSpikes;i++){
      const t = numSpikes===0 ? 0.5 : i/numSpikes;
      const sx = snapV(ew.x1+(ew.x2-ew.x1)*t);
      const sy = snapV(ew.y1+(ew.y2-ew.y1)*t);
      const tooClose = [...existingNodes,...nodesToAdd].some(
        n=>n.type==='earth_spike'&&Math.hypot(n.x-sx,n.y-sy)<SNAP*4
      );
      if(tooClose) continue;
      nodesToAdd.push({
        id:uid(), type:'earth_spike',
        x:sx, y:sy,
        label:`Spike ${existingSpikeCount+spikesAdded+1}`,
      });
      spikesAdded++;
    }
  });
  if(spikesAdded) summary.push(`✅ ${spikesAdded} earth spike(s) placed`);

  // ── 3. Corner/junction bridges ─────────────────────────────────────────
  // Count how many times each endpoint appears across all HT wires
  const ptCount = new Map<string,number>();
  htWires.forEach(w=>{
    const k1=key(w.x1,w.y1), k2=key(w.x2,w.y2);
    ptCount.set(k1,(ptCount.get(k1)||0)+1);
    ptCount.set(k2,(ptCount.get(k2)||0)+1);
  });

  // Junctions = points shared by 2+ wires (corners)
  const junctions = new Set<string>();
  htWires.forEach(w=>{
    if((ptCount.get(key(w.x1,w.y1))||0)>=2) junctions.add(key(w.x1,w.y1));
    if((ptCount.get(key(w.x2,w.y2))||0)>=2) junctions.add(key(w.x2,w.y2));
  });

  const existingBHT   = existingWires.filter(w=>w.type==='bridge_hot');
  const existingBEarth= existingWires.filter(w=>w.type==='bridge_earth');
  let bridgesAdded = 0;

  junctions.forEach(k=>{
    const [gx,gy]=k.split(',').map(Number);
    const jx=gx*SNAP, jy=gy*SNAP;

    // Find the two wires meeting here and draw bridge perpendicular to each
    const meetingWires = htWires.filter(w=>
      key(w.x1,w.y1)===k || key(w.x2,w.y2)===k
    );

    // HT bridge — small loop across the corner
    const bhtExists = [...existingBHT,...wiresToAdd.filter(w=>w.type==='bridge_hot')]
      .some(b=>Math.hypot((b.x1+b.x2)/2-jx,(b.y1+b.y2)/2-jy)<SNAP*3);

    if(!bhtExists && meetingWires.length>=2){
      // Bridge goes from a point on wire1 to a point on wire2
      const w1=meetingWires[0], w2=meetingWires[1];
      // Direction along each wire from junction
      const d1x = key(w1.x1,w1.y1)===k ? w1.x2-w1.x1 : w1.x1-w1.x2;
      const d1y = key(w1.x1,w1.y1)===k ? w1.y2-w1.y1 : w1.y1-w1.y2;
      const d2x = key(w2.x1,w2.y1)===k ? w2.x2-w2.x1 : w2.x1-w2.x2;
      const d2y = key(w2.x1,w2.y1)===k ? w2.y2-w2.y1 : w2.y1-w2.y2;
      const len1=Math.hypot(d1x,d1y)||1, len2=Math.hypot(d2x,d2y)||1;
      const LOOP=SNAP*1.5;
      wiresToAdd.push({
        id:uid(), type:'bridge_hot',
        x1:snapV(jx+d1x/len1*LOOP), y1:snapV(jy+d1y/len1*LOOP),
        x2:snapV(jx+d2x/len2*LOOP), y2:snapV(jy+d2y/len2*LOOP),
        strandCount:1, lengthMeters:1,
      });

      // Earth bridge offset slightly from HT bridge
      const beExists = [...existingBEarth,...wiresToAdd.filter(w=>w.type==='bridge_earth')]
        .some(b=>Math.hypot((b.x1+b.x2)/2-jx,(b.y1+b.y2)/2-jy)<SNAP*3);
      if(!beExists){
        wiresToAdd.push({
          id:uid(), type:'bridge_earth',
          x1:snapV(jx+d1x/len1*LOOP+6), y1:snapV(jy+d1y/len1*LOOP+6),
          x2:snapV(jx+d2x/len2*LOOP+6), y2:snapV(jy+d2y/len2*LOOP+6),
          strandCount:1, lengthMeters:1,
        });
      }
      bridgesAdded++;
    }
  });
  if(bridgesAdded) summary.push(`✅ ${bridgesAdded} corner bridge(s) added`);

  // ── 4. Energizer connections — snap to ACTUAL nearest wire endpoints ───
  // Find fence endpoints (wire ends that appear only once = open ends)
  const endpoints: {x:number,y:number}[] = [];
  htWires.forEach(w=>{
    if((ptCount.get(key(w.x1,w.y1))||0)===1) endpoints.push({x:w.x1,y:w.y1});
    if((ptCount.get(key(w.x2,w.y2))||0)===1) endpoints.push({x:w.x2,y:w.y2});
  });
  // Deduplicate
  const uniqueEP = endpoints.filter((p,i)=>
    endpoints.findIndex(q=>key(q.x,q.y)===key(p.x,p.y))===i
  );

  // If it's a closed loop (no endpoints), pick the wire end closest to energizer
  const connectPoints = uniqueEP.length>=2 ? uniqueEP :
    (() => {
      const nearest = nearestEndpoint(htWires, energizer.x, energizer.y);
      return nearest ? [nearest] : [];
    })();

  if(connectPoints.length>=1){
    // Sort by distance to energizer
    const sorted=[...connectPoints].sort((a,b)=>
      Math.hypot(a.x-energizer.x,a.y-energizer.y)-
      Math.hypot(b.x-energizer.x,b.y-energizer.y)
    );

    const liveEnd = sorted[0];
    // Live (+): energizer → nearest fence endpoint, snap to exact point
    const liveExists = existingWires.some(w=>
      w.type==='hot'&&Math.hypot(w.x1-energizer.x,w.y1-energizer.y)<SNAP*3
    );
    if(!liveExists){
      wiresToAdd.push({
        id:uid(), type:'hot',
        x1:energizer.x, y1:energizer.y,
        x2:liveEnd.x,   y2:liveEnd.y,
        strandCount:1,
        lengthMeters:wireLen(energizer.x,energizer.y,liveEnd.x,liveEnd.y),
      });
      summary.push(`✅ Live (+) wire → fence start`);
    }

    // Return (–): furthest endpoint → energizer
    const retEnd = sorted.length>=2 ? sorted[sorted.length-1] : sorted[0];
    const retExists = existingWires.some(w=>
      w.type==='earth'&&Math.hypot(w.x2-energizer.x,w.y2-energizer.y)<SNAP*3
    );
    if(!retExists){
      wiresToAdd.push({
        id:uid(), type:'earth',
        x1:retEnd.x, y1:retEnd.y,
        x2:energizer.x, y2:energizer.y,
        strandCount:1,
        lengthMeters:wireLen(retEnd.x,retEnd.y,energizer.x,energizer.y),
      });
      summary.push(`✅ Return (–) wire → Energizer`);
    }
  }

  // ── 5. Gate bridges ────────────────────────────────────────────────────
  let gateBridges = 0;
  gates.forEach(gate=>{
    const allBHT=[...existingBHT,...wiresToAdd.filter(w=>w.type==='bridge_hot')];
    if(!allBHT.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<100)){
      wiresToAdd.push({id:uid(),type:'bridge_hot',
        x1:gate.x-60,y1:gate.y-8,x2:gate.x+60,y2:gate.y-8,
        strandCount:1,lengthMeters:2});
    }
    const allBE=[...existingBEarth,...wiresToAdd.filter(w=>w.type==='bridge_earth')];
    if(!allBE.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<100)){
      wiresToAdd.push({id:uid(),type:'bridge_earth',
        x1:gate.x-60,y1:gate.y+8,x2:gate.x+60,y2:gate.y+8,
        strandCount:1,lengthMeters:2});
      gateBridges++;
    }
  });
  if(gateBridges) summary.push(`✅ Gate bridges at ${gateBridges} gate(s)`);

  if(!summary.length) summary.push('ℹ️ Fence already fully wired.');
  return { nodesToAdd, wiresToAdd, summary };
}
