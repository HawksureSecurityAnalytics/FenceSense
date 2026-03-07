import { FenceNode, FenceWire } from '../types';

const SNAP = 24;
const M_PER_SNAP = 2;
const STRAND_GAP = 9;

function uid() { return "aw_"+Date.now()+"_"+Math.random().toString(36).slice(2,6); }
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

  if(!energizer)return{nodesToAdd:[],wiresToAdd:[],summary:["⛔ Place an Energizer first."]};
  if(!htWires.length)return{nodesToAdd:[],wiresToAdd:[],summary:["⛔ Draw HT (red) fence wire first."]};

  const n=Math.max(2,htWires[0].strandCount||5);
  const spread=(n-1)*STRAND_GAP;
  const o0=-spread/2;

  // For each fence wire segment, add bridges at both ends
  // HT strands = even indices (0,2,4...) connected by bridge_hot
  // Earth strands = odd indices (1,3,5...) connected by bridge_earth
  // At LEFT end: both HT and Earth bridge outward to the LEFT
  // At RIGHT end: both HT and Earth bridge outward to the RIGHT
  let bridgesAdded=0;

  htWires.forEach(ht=>{
    const{px,py}=perpUnit(ht.x1,ht.y1,ht.x2,ht.y2);
    const{ax,ay}=alongUnit(ht.x1,ht.y1,ht.x2,ht.y2);
    const htIdx=Array.from({length:n},(_,i)=>i).filter(i=>i%2===0);
    const eIdx =Array.from({length:n},(_,i)=>i).filter(i=>i%2===1);

    [[ht.x1,ht.y1,-1],[ht.x2,ht.y2,1]].forEach(([ex,ey,dir])=>{
      const EX=ex as number, EY=ey as number, DIR=dir as number;
      const capHT=20, capE=28; // how far bridge extends past wire end

      // Check bridge already exists here
      const allBridges=[...existingWires,...wiresToAdd].filter(w=>w.type==="bridge_hot"||w.type==="bridge_earth");
      if(allBridges.some(b=>Math.hypot((b.x1+b.x2)/2-EX,(b.y1+b.y2)/2-EY)<SNAP*2.5))return;

      // HT bridge: vertical bar connecting all HT strands, plus legs from each strand to the bar
      if(htIdx.length>=2){
        const barX1=snapV(EX+px*(o0+htIdx[0]*STRAND_GAP)+ax*DIR*capHT);
        const barY1=snapV(EY+py*(o0+htIdx[0]*STRAND_GAP)+ay*DIR*capHT);
        const barX2=snapV(EX+px*(o0+htIdx[htIdx.length-1]*STRAND_GAP)+ax*DIR*capHT);
        const barY2=snapV(EY+py*(o0+htIdx[htIdx.length-1]*STRAND_GAP)+ay*DIR*capHT);
        // The connecting bar (perpendicular)
        wiresToAdd.push({id:uid(),type:"bridge_hot",x1:barX1,y1:barY1,x2:barX2,y2:barY2,strandCount:1,lengthMeters:1});
        // Legs from each HT strand to the bar
        htIdx.forEach(i=>{
          const o=o0+i*STRAND_GAP;
          wiresToAdd.push({id:uid(),type:"bridge_hot",
            x1:snapV(EX+px*o), y1:snapV(EY+py*o),
            x2:snapV(EX+px*o+ax*DIR*capHT), y2:snapV(EY+py*o+ay*DIR*capHT),
            strandCount:1,lengthMeters:1});
        });
      }

      // Earth bridge: same but for odd strands, slightly further out
      if(eIdx.length>=1){
        if(eIdx.length>=2){
          const barX1=snapV(EX+px*(o0+eIdx[0]*STRAND_GAP)+ax*DIR*capE);
          const barY1=snapV(EY+py*(o0+eIdx[0]*STRAND_GAP)+ay*DIR*capE);
          const barX2=snapV(EX+px*(o0+eIdx[eIdx.length-1]*STRAND_GAP)+ax*DIR*capE);
          const barY2=snapV(EY+py*(o0+eIdx[eIdx.length-1]*STRAND_GAP)+ay*DIR*capE);
          wiresToAdd.push({id:uid(),type:"bridge_earth",x1:barX1,y1:barY1,x2:barX2,y2:barY2,strandCount:1,lengthMeters:1});
        }
        eIdx.forEach(i=>{
          const o=o0+i*STRAND_GAP;
          wiresToAdd.push({id:uid(),type:"bridge_earth",
            x1:snapV(EX+px*o), y1:snapV(EY+py*o),
            x2:snapV(EX+px*o+ax*DIR*capE), y2:snapV(EY+py*o+ay*DIR*capE),
            strandCount:1,lengthMeters:1});
        });
      }
      bridgesAdded++;
    });
  });

  if(bridgesAdded>0)summary.push("✅ HT & Earth bridges added at "+bridgesAdded+" wire ends");

  // Earth spikes near energizer
  const existingSpikes=existingNodes.filter(n=>n.type==="earth_spike").length;
  if(existingSpikes===0){
    let bx=energizer.x,by=energizer.y+SNAP*4,bd=Infinity;
    htWires.forEach(w=>{[[w.x1,w.y1],[w.x2,w.y2]].forEach(([ex,ey])=>{const d=Math.hypot((ex as number)-energizer.x,(ey as number)-energizer.y);if(d<bd){bd=d;bx=ex as number;by=(ey as number)+SNAP*4;}});});
    for(let i=0;i<3;i++){
      nodesToAdd.push({id:uid(),type:"earth_spike",x:snapV(bx+(i-1)*SNAP*3),y:snapV(by),label:"Spike "+(existingSpikes+i+1)});
    }
    summary.push("✅ 3 earth spikes placed");
  }

  // Energizer connections
  const ptCount=new Map<string,number>();
  htWires.forEach(w=>{const k1=ptKey(w.x1,w.y1),k2=ptKey(w.x2,w.y2);ptCount.set(k1,(ptCount.get(k1)||0)+1);ptCount.set(k2,(ptCount.get(k2)||0)+1);});
  const eps:{x:number,y:number}[]=[];
  htWires.forEach(w=>{if((ptCount.get(ptKey(w.x1,w.y1))||0)===1)eps.push({x:w.x1,y:w.y1});if((ptCount.get(ptKey(w.x2,w.y2))||0)===1)eps.push({x:w.x2,y:w.y2});});
  const uEP=eps.filter((p,i)=>eps.findIndex(q=>ptKey(q.x,q.y)===ptKey(p.x,p.y))===i);
  const cPts=uEP.length?uEP:[{x:htWires[0].x1,y:htWires[0].y1}];
  const sorted=[...cPts].sort((a,b)=>Math.hypot(a.x-energizer.x,a.y-energizer.y)-Math.hypot(b.x-energizer.x,b.y-energizer.y));
  const liveEnd=sorted[0],retEnd=sorted.length>=2?sorted[sorted.length-1]:sorted[0];

  if(!existingWires.some(w=>w.type==="hot"&&Math.hypot(w.x1-energizer.x,w.y1-energizer.y)<SNAP*2)){
    wiresToAdd.push({id:uid(),type:"hot",x1:energizer.x,y1:energizer.y,x2:liveEnd.x,y2:liveEnd.y,strandCount:1,lengthMeters:wLen(energizer.x,energizer.y,liveEnd.x,liveEnd.y)});
    summary.push("✅ Live OUT (+) → fence");
  }
  if(!existingWires.some(w=>w.type==="earth"&&Math.hypot(w.x2-energizer.x,w.y2-energizer.y)<SNAP*2)){
    wiresToAdd.push({id:uid(),type:"earth",x1:retEnd.x,y1:retEnd.y,x2:energizer.x,y2:energizer.y,strandCount:1,lengthMeters:wLen(retEnd.x,retEnd.y,energizer.x,energizer.y)});
    summary.push("✅ Live RETURN (–) → Energizer");
  }

  // Gate bypasses
  gates.forEach(gate=>{
    const allB=[...existingWires,...wiresToAdd].filter(w=>w.type==="bridge_hot");
    if(allB.some(b=>Math.hypot((b.x1+b.x2)/2-gate.x,(b.y1+b.y2)/2-gate.y)<140))return;
    const gW=80,depth=spread+30;
    wiresToAdd.push({id:uid(),type:"bridge_hot",x1:gate.x-gW,y1:gate.y-spread/2,x2:gate.x-gW,y2:gate.y+depth,strandCount:1,lengthMeters:3});
    wiresToAdd.push({id:uid(),type:"bridge_hot",x1:gate.x-gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y+depth,strandCount:1,lengthMeters:5});
    wiresToAdd.push({id:uid(),type:"bridge_hot",x1:gate.x+gW,y1:gate.y+depth,x2:gate.x+gW,y2:gate.y-spread/2,strandCount:1,lengthMeters:3});
    wiresToAdd.push({id:uid(),type:"bridge_earth",x1:gate.x-gW,y1:gate.y+spread/2+4,x2:gate.x-gW,y2:gate.y+depth+18,strandCount:1,lengthMeters:3});
    wiresToAdd.push({id:uid(),type:"bridge_earth",x1:gate.x-gW,y1:gate.y+depth+18,x2:gate.x+gW,y2:gate.y+depth+18,strandCount:1,lengthMeters:5});
    wiresToAdd.push({id:uid(),type:"bridge_earth",x1:gate.x+gW,y1:gate.y+depth+18,x2:gate.x+gW,y2:gate.y+spread/2+4,strandCount:1,lengthMeters:3});
    summary.push("✅ Gate bypass added");
  });

  if(!summary.length)summary.push("ℹ️ Fence already fully wired.");
  return{nodesToAdd,wiresToAdd,summary};
}
