import { FenceNode, FenceWire } from '../types';

const SNAP = 24;
const M_PER_SNAP = 2;

function uid() { return `aw_${Date.now()}_${Math.random().toString(36).slice(2,6)}_${Math.floor(Math.random()*9999)}`; }
function snapV(v: number) { return Math.round(v / SNAP) * SNAP; }
function wLen(x1:number,y1:number,x2:number,y2:number) {
  return Math.round(Math.hypot(x2-x1,y2-y1)/SNAP*M_PER_SNAP);
}
function ptKey(x:number,y:number){ return `${Math.round(x/SNAP)},${Math.round(y/SNAP)}`; }

function perpUnit(x1:number,y1:number,x2:number,y2:number){
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<1) return {px:0,py:0};
  return { px:-(y2-y1)/len, py:(x2-x1)/len };
}

function alongUnit(x1:number,y1:number,x2:number,y2:number){
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<1) return {ax:0,ay:0};
  return { ax:(x2-x1)/len, ay:(y2-y1)/len };
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

  const strandCount = Math.max(2, htWires[0].strandCount || 5);
  const STRAND_GAP  = 8;   // px between strands
  const LOOP_EXT    = 14;  // how far loop cap extends past wire end
  const EARTH_BANDS = Math.max(1, Math.floor(strandCount * 0.35)); // ~35% earth strands
  const EARTH_GAP   = 6;   // gap between HT bundle and Earth bundle

  // ── 1. For each HT wire: draw individual strand lines + series loops ──
  let loopsAdded = 0;

  htWires.forEach(ht => {
    const { px, py } = perpUnit(ht.x1,ht.y1,ht.x2,ht.y2);
    const { ax, ay } = alongUnit(ht.x1,ht.y1,ht.x2,ht.y2);

    // Already has earth alongside?
    const htMx=(ht.x1+ht.x2)/2, htMy=(ht.y1+ht.y2)/2;
    const hasEarth = existingWires.filter(w=>w.type==='earth').some(e=>{
      const eMx=(e.x1+e.x2)/2,eMy=(e.y1+e.y2)/2;
      return Math.hypot(htMx-eMx,htMy-eMy)<SNAP*4;
    });

    // ── Earth wire bundle alongside HT ──────────────────────────────────
    if (!hasEarth) {
      const earthOffset = strandCount * STRAND_GAP + EARTH_GAP;
      for (let e = 0; e < EARTH_BANDS; e++) {
        const off = earthOffset + e * STRAND_GAP;
        wiresToAdd.push({
          id:uid(), type:'earth',
          x1: ht.x1 + px*off, y1: ht.y1 + py*off,
          x2: ht.x2 + px*off, y2: ht.y2 + py*off,
          strandCount:1, lengthMeters: wLen(ht.x1,ht.y1,ht.x2,ht.y2),
        });
      }
      // Earth end loops connecting the earth strands
      if (EARTH_BANDS > 1) {
        [0,1].forEach(endIdx => {
          const ex = endIdx===0 ? ht.x1 : ht.x2;
          const ey = endIdx===0 ? ht.y1 : ht.y2;
          const capDir = endIdx===0 ? -1 : 1;
          for (let e = 0; e < EARTH_BANDS-1; e+=2) {
            const off1 = (strandCount * STRAND_GAP + EARTH_GAP) + e * STRAND_GAP;
            const off2 = off1 + STRAND_GAP;
            const s1x = ex + px*off1, s1y = ey + py*off1;
            const s2x = ex + px*off2, s2y = ey + py*off2;
            const capX1 = s1x + ax*capDir*LOOP_EXT, capY1 = s1y + ay*capDir*LOOP_EXT;
            const capX2 = s2x + ax*capDir*LOOP_EXT, capY2 = s2y + ay*capDir*LOOP_EXT;
            wiresToAdd.push({id:uid(),type:'bridge_earth',x1:s1x,y1:s1y,x2:capX1,y2:capY1,strandCount:1,lengthMeters:0.3});
            wiresToAdd.push({id:uid(),type:'bridge_earth',x1:capX1,y1:capY1,x2:capX2,y2:capY2,strandCount:1,lengthMeters:0.2});
            wiresToAdd.push({id:uid(),type:'bridge_earth',x1:capX2,y1:capY2,x2:s2x,y2:s2y,strandCount:1,lengthMeters:0.3});
          }
        });
      }
    }

    // ── HT series loops at BOTH ends ────────────────────────────────────
    // Each end: pairs of strands connected by U-shaped loop
    // This creates the characteristic series wiring seen in reference images
    [0, 1].forEach(endIdx => {
      const ex = endIdx===0 ? ht.x1 : ht.x2;
      const ey = endIdx===0 ? ht.y1 : ht.y2;
      // Loop cap extends AWAY from the fence
      const capDir = endIdx===0 ? -1 : 1;

      // Connect pairs: strand 0-1, 2-3, 4-5 etc (series snaking)
      for (let s = 0; s < strandCount-1; s += 2) {
        const off1 = s * STRAND_GAP;
        const off2 = (s+1) * STRAND_GAP;
        const s1x = ex + px*off1, s1y = ey + py*off1;
        const s2x = ex + px*off2, s2y = ey + py*off2;
        const capX1 = s1x + ax*capDir*LOOP_EXT;
        const capY1 = s1y + ay*capDir*LOOP_EXT;
        const capX2 = s2x + ax*capDir*LOOP_EXT;
        const capY2 = s2y + ay*capDir*LOOP_EXT;

        // Left leg
        wiresToAdd.push({id:uid(),type:'bridge_hot',x1:s1x,y1:s1y,x2:capX1,y2:capY1,strandCount:1,lengthMeters:0.3});
        // Cap (bottom of U)
        wiresToAdd.push({id:uid(),type:'bridge_hot',x1:capX1,y1:capY1,x2:capX2,y2:capY2,strandCount:1,lengthMeters:0.2});
        // Right leg
        wiresToAdd.push({id:uid(),type:'bridge_hot',x1:capX2,y1:capY2,x2:s2x,y2:s2y,strandCount:1,lengthMeters:0.3});
        loopsAdded++;
      }
    });
  });

  if (loopsAdded) summary.push(`✅ ${loopsAdded} series loop connector(s) added`);

  // ── 2. Earth spikes ────────────────────────────────────────────────────
  const allEarth = [
    ...existingWires.filter(w=>w.type==='earth'),
    ...wiresToAdd.filter(w=>w.type==='earth' && w.strandCount===1 && (w.lengthMeters||0)>2),
  ];
  let spikesAdded = 0;
  const existingSpikeCount = existingNodes.filter(n=>n.type==='earth_spike').length;
  const SPIKE_INTERVAL = SNAP * 25;

  // Place spikes only on main earth wires (not loops/connectors)
  const mainEarth = allEarth.filter(e => (e.lengthMeters||0) > 5);
  mainEarth.forEach(ew => {
    const segLen = Math.hypot(ew.x2-ew.x1, ew.y2-ew.y1);
    const numSpikes = Math.max(1, Math.round(segLen / SPIKE_INTERVAL));
    for (let i = 0; i <= numSpikes; i++) {
      const t = numSpikes===0 ? 0.5 : i/numSpikes;
      const sx = snapV(ew.x1+(ew.x2-ew.x1)*t);
      const sy = snapV(ew.y1+(ew.y2-ew.y1)*t);
      const tooClose = [...existingNodes,...nodesToAdd].some(
        n=>n.type==='earth_spike'&&Math.hypot(n.x-sx,n.y-sy)<SNAP*5
      );
      if(tooClose) continue;
      nodesToAdd.push({
        id:uid(), type:'earth_spike', x:sx, y:sy,
        label:`Spike ${existingSpikeCount+spikesAdded+1}`,
      });
      spikesAdded++;
    }
  });
  if(spikesAdded) summary.push(`✅ ${spikesAdded} earth spike(s) placed`);

  // ── 3. Energizer connections ───────────────────────────────────────────
  const ptCount = new Map<string,number>();
  htWires.forEach(w=>{
    const k1=ptKey(w.x1,w.y1), k2=ptKey(w.x2,w.y2);
    ptCount.set(k1,(ptCount.get(k1)||0)+1);
    ptCount.set(k2,(ptCount.get(k2)||0)+1);
  });

  const endpoints:{x:number,y:number}[]=[];
  htWires.forEach(w=>{
    if((ptCount.get(ptKey(w.x1,w.y1))||0)===1) endpoints.push({x:w.x1,y:w.y1});
    if((ptCount.get(ptKey(w.x2,w.y2))||0)===1) endpoints.push({x:w.x2,y:w.y2});
  });
  const uniqueEP = endpoints.filter((p,i)=>
    endpoints.findIndex(q=>ptKey(q.x,q.y)===ptKey(p.x,p.y))===i
  );

  // For closed fence (loop), find nearest point to energizer
  let connectPts = uniqueEP;
  if (connectPts.length === 0) {
    let best:{x:number,y:number}|null=null, bd=Infinity;
    htWires.forEach(w=>{
      [w.x1,w.x2].forEach((ex,i)=>{
        const ey=i===0?w.y1:w.y2;
        const d=Math.hypot(ex-energizer.x,ey-energizer.y);
        if(d<bd){bd=d;best={x:ex,y:ey};}
      });
    });
    if(best) connectPts=[best];
  }

  if(connectPts.length>=1){
    const sorted=[...connectPts].sort((a,b)=>
      Math.hypot(a.x-energizer.x,a.y-energizer.y)-
      Math.hypot(b.x-energizer.x,b.y-energizer.y)
    );
    const liveEnd=sorted[0];
    const retEnd=sorted.length>=2?sorted[sorted.length-1]:sorted[0];

    const liveExists=existingWires.some(w=>
      w.type==='hot'&&Math.hypot(w.x1-energizer.x,w.y1-energizer.y)<SNAP*2
    );
    if(!liveExists){
      wiresToAdd.push({
        id:uid(),type:'hot',
        x1:energizer.x,y1:energizer.y,
        x2:liveEnd.x,y2:liveEnd.y,
        strandCount:1,
        lengthMeters:wLen(energizer.x,energizer.y,liveEnd.x,liveEnd.y),
      });
      summary.push('✅ Live (+) feed wire → fence');
    }

    const retExists=existingWires.some(w=>
      w.type==='earth'&&Math.hypot(w.x2-energizer.x,w.y2-energizer.y)<SNAP*2
    );
    if(!retExists){
      wiresToAdd.push({
        id:uid(),type:'earth',
        x1:retEnd.x,y1:retEnd.y,
        x2:energizer.x,y2:energizer.y,
        strandCount:1,
        lengthMeters:wLen(retEnd.x,retEnd.y,energizer.x,energizer.y),
      });
      summary.push('✅ Return (–) wire → Energizer');
    }
  }

  // ── 4. Gate bypass cables (U-shaped like reference image) ─────────────
  let gateBridges=0;
  const existingBHT=existingWires.filter(w=>w.type==='bridge_hot');
  const existingBE =existingWires.filter(w=>w.type==='bridge_earth');

  gates.forEach(gate=>{
    const allBHT=[...existingBHT,...wiresToAdd.filter(w=>w.type==='bridge_hot')];
    if(!allBHT.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<140)){
      const gW=84, depth=56;
      wiresToAdd.push({id:uid(),type:'bridge_hot',x1:gate.x-gW,y1:gate.y,x2:gate.x-gW,y2:gate.y+depth,strandCount:1,lengthMeters:2});
      wiresToAdd.push({id:uid(),type:'bridge_hot',x1:gate.x-gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+depth,strandCount:1,lengthMeters:4});
      wiresToAdd.push({id:uid(),type:'bridge_hot',x1:gate.x+gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y,strandCount:1,lengthMeters:2});
      gateBridges++;
    }
    const allBE=[...existingBE,...wiresToAdd.filter(w=>w.type==='bridge_earth')];
    if(!allBE.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<140)){
      const gW=84, depth=76;
      wiresToAdd.push({id:uid(),type:'bridge_earth',x1:gate.x-gW,y1:gate.y,x2:gate.x-gW,y2:gate.y+depth,strandCount:1,lengthMeters:2});
      wiresToAdd.push({id:uid(),type:'bridge_earth',x1:gate.x-gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+depth,strandCount:1,lengthMeters:4});
      wiresToAdd.push({id:uid(),type:'bridge_earth',x1:gate.x+gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y,strandCount:1,lengthMeters:2});
    }
  });
  if(gateBridges) summary.push(`✅ Gate bypass cables at ${gateBridges} gate(s)`);

  if(!summary.length) summary.push('ℹ️ Fence already fully wired.');
  return { nodesToAdd, wiresToAdd, summary };
}
