import { FenceNode, FenceWire } from '../types';

const SNAP = 24;
const M_PER_SNAP = 2;
const STRAND_GAP = 9;

function uid(){return "aw_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);}
function snapV(v:number){return Math.round(v/SNAP)*SNAP;}
function wLen(x1:number,y1:number,x2:number,y2:number){return Math.round(Math.hypot(x2-x1,y2-y1)/SNAP*M_PER_SNAP);}
function ptKey(x:number,y:number){return Math.round(x/SNAP)+","+Math.round(y/SNAP);}
function perpUnit(x1:number,y1:number,x2:number,y2:number){const len=Math.hypot(x2-x1,y2-y1);if(len<1)return{px:0,py:0};return{px:-(y2-y1)/len,py:(x2-x1)/len};}
function alongUnit(x1:number,y1:number,x2:number,y2:number){const len=Math.hypot(x2-x1,y2-y1);if(len<1)return{ax:1,ay:0};return{ax:(x2-x1)/len,ay:(y2-y1)/len};}

export interface AutoWireResult{nodesToAdd:FenceNode[];wiresToAdd:FenceWire[];summary:string[];}

export function autoWireFence(existingNodes:FenceNode[],existingWires:FenceWire[]):AutoWireResult{
  const nodesToAdd:FenceNode[]=[];
  const wiresToAdd:FenceWire[]=[];
  const summary:string[]=[];
  const energizer=existingNodes.find(n=>n.type==="energizer");
  const htWires=existingWires.filter(w=>w.type==="hot");
  const gates=existingNodes.filter(n=>n.type==="gate");
  if(!energizer)return{nodesToAdd:[],wiresToAdd:[],summary:["No energizer placed."]};
  if(!htWires.length)return{nodesToAdd:[],wiresToAdd:[],summary:["No HT wire drawn."]};

  const n=Math.max(2,htWires[0].strandCount||5);
  const spread=(n-1)*STRAND_GAP;
  const o0=-spread/2;
  const CAP=16;
  let bridgesAdded=0;

  htWires.forEach(ht=>{
    const{px,py}=perpUnit(ht.x1,ht.y1,ht.x2,ht.y2);
    const{ax,ay}=alongUnit(ht.x1,ht.y1,ht.x2,ht.y2);
    const htIdx=Array.from({length:n},(_,i)=>i).filter(i=>i%2===0);
    const eIdx=Array.from({length:n},(_,i)=>i).filter(i=>i%2===1);

    ([[-1,ht.x1,ht.y1],[1,ht.x2,ht.y2]] as [number,number,number][]).forEach(([dir,ex,ey])=>{
      const allBr=[...existingWires,...wiresToAdd].filter(w=>w.type==="bridge_hot"||w.type==="bridge_earth");
      if(allBr.some(b=>Math.hypot((b.x1+b.x2)/2-ex,(b.y1+b.y2)/2-ey)<SNAP*3))return;

      for(let k=0;k<htIdx.length-1;k++){
        const oA=o0+htIdx[k]*STRAND_GAP, oB=o0+htIdx[k+1]*STRAND_GAP;
        const cAx=ex+px*oA+ax*dir*CAP, cAy=ey+py*oA+ay*dir*CAP;
        const cBx=ex+px*oB+ax*dir*CAP, cBy=ey+py*oB+ay*dir*CAP;
        wiresToAdd.push({id:uid(),type:"bridge_hot",x1:ex+px*oA,y1:ey+py*oA,x2:cAx,y2:cAy,strandCount:1,lengthMeters:1});
        wiresToAdd.push({id:uid(),type:"bridge_hot",x1:cAx,y1:cAy,x2:cBx,y2:cBy,strandCount:1,lengthMeters:1});
        wiresToAdd.push({id:uid(),type:"bridge_hot",x1:cBx,y1:cBy,x2:ex+px*oB,y2:ey+py*oB,strandCount:1,lengthMeters:1});
      }

      for(let k=0;k<eIdx.length-1;k++){
        const oA=o0+eIdx[k]*STRAND_GAP, oB=o0+eIdx[k+1]*STRAND_GAP;
        const cap=CAP+8;
        const cAx=ex+px*oA+ax*dir*cap, cAy=ey+py*oA+ay*dir*cap;
        const cBx=ex+px*oB+ax*dir*cap, cBy=ey+py*oB+ay*dir*cap;
        wiresToAdd.push({id:uid(),type:"bridge_earth",x1:ex+px*oA,y1:ey+py*oA,x2:cAx,y2:cAy,strandCount:1,lengthMeters:1});
        wiresToAdd.push({id:uid(),type:"bridge_earth",x1:cAx,y1:cAy,x2:cBx,y2:cBy,strandCount:1,lengthMeters:1});
        wiresToAdd.push({id:uid(),type:"bridge_earth",x1:cBx,y1:cBy,x2:ex+px*oB,y2:ey+py*oB,strandCount:1,lengthMeters:1});
      }
      if(eIdx.length===1){
        const o=o0+eIdx[0]*STRAND_GAP;
        wiresToAdd.push({id:uid(),type:"bridge_earth",x1:ex+px*o,y1:ey+py*o,x2:ex+px*o+ax*dir*(CAP+8),y2:ey+py*o+ay*dir*(CAP+8),strandCount:1,lengthMeters:1});
      }
      bridgesAdded++;
    });
  });
  if(bridgesAdded>0)summary.push("HT and Earth hairpin bridges added at "+bridgesAdded+" ends");

  const existingSpikes=existingNodes.filter(n=>n.type==="earth_spike").length;
  if(existingSpikes===0){
    let bx=energizer.x,by=energizer.y,bd=Infinity;
    htWires.forEach(w=>{[[w.x1,w.y1],[w.x2,w.y2]].forEach(([ex,ey])=>{const d=Math.hypot((ex as number)-energizer.x,(ey as number)-energizer.y);if(d<bd){bd=d;bx=ex as number;by=ey as number;}});});
    for(let i=0;i<3;i++)nodesToAdd.push({id:uid(),type:"earth_spike",x:snapV(bx+(i-1)*SNAP*3),y:snapV(by+SNAP*5),label:"Spike "+(i+1)});
    summary.push("3 earth spikes added");
  }

  const ptCount=new Map<string,number>();
  htWires.forEach(w=>{ptCount.set(ptKey(w.x1,w.y1),(ptCount.get(ptKey(w.x1,w.y1))||0)+1);ptCount.set(ptKey(w.x2,w.y2),(ptCount.get(ptKey(w.x2,w.y2))||0)+1);});
  const eps:{x:number,y:number}[]=[];
  htWires.forEach(w=>{if((ptCount.get(ptKey(w.x1,w.y1))||0)===1)eps.push({x:w.x1,y:w.y1});if((ptCount.get(ptKey(w.x2,w.y2))||0)===1)eps.push({x:w.x2,y:w.y2});});
  const uEP=eps.filter((p,i)=>eps.findIndex(q=>ptKey(q.x,q.y)===ptKey(p.x,p.y))===i);
  const cPts=uEP.length?uEP:[{x:htWires[0].x1,y:htWires[0].y1}];
  const sorted=[...cPts].sort((a,b)=>Math.hypot(a.x-energizer.x,a.y-energizer.y)-Math.hypot(b.x-energizer.x,b.y-energizer.y));
  const liveEnd=sorted[0],retEnd=sorted.length>=2?sorted[sorted.length-1]:sorted[0];
  if(!existingWires.some(w=>w.type==="hot"&&Math.hypot(w.x1-energizer.x,w.y1-energizer.y)<SNAP*2)){
    wiresToAdd.push({id:uid(),type:"hot",x1:energizer.x,y1:energizer.y,x2:liveEnd.x,y2:liveEnd.y,strandCount:1,lengthMeters:wLen(energizer.x,energizer.y,liveEnd.x,liveEnd.y)});
    summary.push("Live OUT connected");
  }
  if(!existingWires.some(w=>w.type==="earth"&&Math.hypot(w.x2-energizer.x,w.y2-energizer.y)<SNAP*2)){
    wiresToAdd.push({id:uid(),type:"earth",x1:retEnd.x,y1:retEnd.y,x2:energizer.x,y2:energizer.y,strandCount:1,lengthMeters:wLen(retEnd.x,retEnd.y,energizer.x,energizer.y)});
    summary.push("Live RETURN connected");
  }

  gates.forEach(gate=>{
    const allB=[...existingWires,...wiresToAdd].filter(w=>w.type==="bridge_hot");
    if(allB.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<140))return;
    const gW=80,depth=spread+32;
    wiresToAdd.push({id:uid(),type:"bridge_hot",x1:gate.x-gW,y1:gate.y-spread/2,x2:gate.x-gW,y2:gate.y+depth,strandCount:1,lengthMeters:3});
    wiresToAdd.push({id:uid(),type:"bridge_hot",x1:gate.x-gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+depth,strandCount:1,lengthMeters:5});
    wiresToAdd.push({id:uid(),type:"bridge_hot",x1:gate.x+gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y-spread/2,strandCount:1,lengthMeters:3});
    wiresToAdd.push({id:uid(),type:"bridge_earth",x1:gate.x-gW,y1:gate.y+spread/2+4,x2:gate.x-gW,y2:gate.y+depth+18,strandCount:1,lengthMeters:3});
    wiresToAdd.push({id:uid(),type:"bridge_earth",x1:gate.x-gW,y1:gate.y+depth+18,x2:gate.x+gW,y2:gate.y+depth+18,strandCount:1,lengthMeters:5});
    wiresToAdd.push({id:uid(),type:"bridge_earth",x1:gate.x+gW,y1:gate.y+depth+18,x2:gate.x+gW,y2:gate.y+spread/2+4,strandCount:1,lengthMeters:3});
    summary.push("Gate bypass added");
  });

  if(!summary.length)summary.push("Already fully wired.");
  return{nodesToAdd,wiresToAdd,summary};
}
