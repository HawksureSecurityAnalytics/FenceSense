import { FenceNode, FenceWire } from '../types';

const SNAP = 24;
const M_PER_SNAP = 2;

function uid() { return `aw_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
function snapV(v: number) { return Math.round(v / SNAP) * SNAP; }
function wLen(x1:number,y1:number,x2:number,y2:number) {
  return Math.round(Math.hypot(x2-x1,y2-y1)/SNAP*M_PER_SNAP);
}
function ptKey(x:number,y:number){ return `${Math.round(x/SNAP)},${Math.round(y/SNAP)}`; }
function perpUnit(x1:number,y1:number,x2:number,y2:number){
  const len=Math.hypot(x2-x1,y2-y1);
  if(len<1)return{px:0,py:0};
  return{px:-(y2-y1)/len,py:(x2-x1)/len};
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
  // Earth strands sit just below the HT bundle — same fence line, small offset
  const STRAND_GAP  = 7;
  const HT_SPREAD   = (strandCount - 1) * STRAND_GAP;
  // Earth wire offset = just past the HT bundle + small gap
  const EARTH_OFFSET = HT_SPREAD / 2 + 14;
  const earthStrands = Math.max(1, Math.round(strandCount * 0.4));

  // ── 1. Earth wire on SAME fence line as HT, just offset slightly ──────
  let earthAdded = 0;
  htWires.forEach(ht => {
    const htMx=(ht.x1+ht.x2)/2, htMy=(ht.y1+ht.y2)/2;
    const hasEarth = existingWires.filter(w=>w.type==='earth').some(e=>
      Math.hypot((e.x1+e.x2)/2-htMx,(e.y1+e.y2)/2-htMy)<SNAP*4
    );
    if(hasEarth) return;

    const {px,py} = perpUnit(ht.x1,ht.y1,ht.x2,ht.y2);
    wiresToAdd.push({
      id:uid(), type:'earth',
      x1: ht.x1 + px*EARTH_OFFSET,
      y1: ht.y1 + py*EARTH_OFFSET,
      x2: ht.x2 + px*EARTH_OFFSET,
      y2: ht.y2 + py*EARTH_OFFSET,
      strandCount: earthStrands,
      lengthMeters: wLen(ht.x1,ht.y1,ht.x2,ht.y2),
    });
    earthAdded++;
  });
  if(earthAdded) summary.push(`✅ ${earthAdded} earth wire(s) added alongside HT`);

  // ── 2. Earth spikes below earth wire endpoints ────────────────────────
  // Place at start and end of each earth wire — spikes go straight down
  const allEarth=[
    ...existingWires.filter(w=>w.type==='earth'),
    ...wiresToAdd.filter(w=>w.type==='earth'),
  ];
  let spikesAdded = 0;
  const existingSpikeCount = existingNodes.filter(n=>n.type==='earth_spike').length;

  allEarth.filter(e=>(e.lengthMeters||0)>4).forEach(ew=>{
    const segLen = Math.hypot(ew.x2-ew.x1,ew.y2-ew.y1);
    const numSpikes = Math.max(1, Math.round(segLen/(SNAP*25)));
    for(let i=0;i<=numSpikes;i++){
      const t = numSpikes===0?0.5:i/numSpikes;
      const sx = snapV(ew.x1+(ew.x2-ew.x1)*t);
      const sy = snapV(ew.y1+(ew.y2-ew.y1)*t);
      const tooClose=[...existingNodes,...nodesToAdd].some(
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

  // ── 3. Energizer: live out to fence start, return from fence end ───────
  const ptCount=new Map<string,number>();
  htWires.forEach(w=>{
    const k1=ptKey(w.x1,w.y1),k2=ptKey(w.x2,w.y2);
    ptCount.set(k1,(ptCount.get(k1)||0)+1);
    ptCount.set(k2,(ptCount.get(k2)||0)+1);
  });
  const endpoints:{x:number,y:number}[]=[];
  htWires.forEach(w=>{
    if((ptCount.get(ptKey(w.x1,w.y1))||0)===1) endpoints.push({x:w.x1,y:w.y1});
    if((ptCount.get(ptKey(w.x2,w.y2))||0)===1) endpoints.push({x:w.x2,y:w.y2});
  });
  const uniqueEP=endpoints.filter((p,i)=>endpoints.findIndex(q=>ptKey(q.x,q.y)===ptKey(p.x,p.y))===i);

  let connectPts=uniqueEP;
  if(connectPts.length===0){
    let best:{x:number,y:number}|null=null,bd=Infinity;
    htWires.forEach(w=>{
      [[w.x1,w.y1],[w.x2,w.y2]].forEach(([ex,ey])=>{
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

    // Live OUT (+) — single strand from energizer + to nearest fence end
    if(!existingWires.some(w=>w.type==='hot'&&Math.hypot(w.x1-energizer.x,w.y1-energizer.y)<SNAP*2)){
      wiresToAdd.push({
        id:uid(), type:'hot',
        x1:energizer.x, y1:energizer.y,
        x2:liveEnd.x,   y2:liveEnd.y,
        strandCount:1,
        lengthMeters:wLen(energizer.x,energizer.y,liveEnd.x,liveEnd.y),
      });
      summary.push('✅ Live OUT (+) → fence');
    }

    // Live RETURN (–) — single earth strand from far fence end back to energizer
    if(!existingWires.some(w=>w.type==='earth'&&Math.hypot(w.x2-energizer.x,w.y2-energizer.y)<SNAP*2)){
      wiresToAdd.push({
        id:uid(), type:'earth',
        x1:retEnd.x,    y1:retEnd.y,
        x2:energizer.x, y2:energizer.y,
        strandCount:1,
        lengthMeters:wLen(retEnd.x,retEnd.y,energizer.x,energizer.y),
      });
      summary.push('✅ Live RETURN (–) → Energizer');
    }
  }

  // ── 4. Gate bypass U-cables (down post, across, up other post) ─────────
  let gateBridges=0;
  const existingBHT=existingWires.filter(w=>w.type==='bridge_hot');
  const existingBE =existingWires.filter(w=>w.type==='bridge_earth');

  gates.forEach(gate=>{
    const allBHT=[...existingBHT,...wiresToAdd.filter(w=>w.type==='bridge_hot')];
    if(!allBHT.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<140)){
      // HT bypass: down left post, across bottom, up right post
      const gW=80, depth=HT_SPREAD+24;
      wiresToAdd.push({id:uid(),type:'bridge_hot',x1:gate.x-gW,y1:gate.y-(HT_SPREAD/2),x2:gate.x-gW,y2:gate.y+depth,strandCount:1,lengthMeters:3});
      wiresToAdd.push({id:uid(),type:'bridge_hot',x1:gate.x-gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+depth,strandCount:1,lengthMeters:5});
      wiresToAdd.push({id:uid(),type:'bridge_hot',x1:gate.x+gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y-(HT_SPREAD/2),strandCount:1,lengthMeters:3});
      gateBridges++;
    }
    const allBE=[...existingBE,...wiresToAdd.filter(w=>w.type==='bridge_earth')];
    if(!allBE.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<140)){
      const gW=80, depth=HT_SPREAD+40;
      wiresToAdd.push({id:uid(),type:'bridge_earth',x1:gate.x-gW,y1:gate.y+(HT_SPREAD/2)+2,x2:gate.x-gW,y2:gate.y+depth,strandCount:1,lengthMeters:3});
      wiresToAdd.push({id:uid(),type:'bridge_earth',x1:gate.x-gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+depth,strandCount:1,lengthMeters:5});
      wiresToAdd.push({id:uid(),type:'bridge_earth',x1:gate.x+gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+(HT_SPREAD/2)+2,strandCount:1,lengthMeters:3});
    }
  });
  if(gateBridges) summary.push(`✅ Gate bypass at ${gateBridges} gate(s)`);

  if(!summary.length) summary.push('ℹ️ Fence already fully wired.');
  return { nodesToAdd, wiresToAdd, summary };
}
