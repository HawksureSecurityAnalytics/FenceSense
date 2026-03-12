import { Post, Segment, Bridge, FaultItem } from './circuitTypes';

export interface PathStep {
  kind: 'strand'|'bridge'|'energizer_out'|'energizer_in';
  id: string;
  segmentId?: string;
  strandIndex?: number;
  bridgeId?: string;
  label: string;
}

export interface CircuitResult {
  path: PathStep[];
  faultStep: number|null;
  complete: boolean;
}

export function traceCircuit(
  posts: Post[], segments: Segment[], bridges: Bridge[],
  faults: FaultItem[], strandCount: number
): CircuitResult {
  const path: PathStep[] = [];
  const faultIds = new Set(faults.map(f=>f.id));
  if (posts.length<2||segments.length===0) return{path:[],faultStep:null,complete:false};
  const postMap = new Map(posts.map(p=>[p.id,p]));
  const sortedSegs = [...segments].sort((a,b)=>(postMap.get(a.postA)?.x??0)-(postMap.get(b.postA)?.x??0));
  const htS = Array.from({length:strandCount},(_,i)=>i).filter(i=>i%2===0);
  const eS  = Array.from({length:strandCount},(_,i)=>i).filter(i=>i%2===1);
  let faultStep: number|null = null;
  const check = (id:string)=>{ if(faultIds.has(id)&&faultStep===null) faultStep=path.length-1; };
  path.push({kind:'energizer_out',id:'enrg_out',label:'Energizer + (Live Out)'});
  htS.forEach((si,k)=>{
    const segs = k%2===0 ? sortedSegs : [...sortedSegs].reverse();
    const side = k%2===0 ? 'right' : 'left';
    segs.forEach(seg=>{
      const sid=`strand-${seg.id}-${si}`;
      path.push({kind:'strand',id:sid,segmentId:seg.id,strandIndex:si,label:`Strand ${si+1} (HT)`});
      check(sid);
    });
    if(k<htS.length-1){
      const br=bridges.find(b=>b.type==='ht'&&b.side===side&&b.strandIndex===si);
      const bid=br?.id??`missing-ht-${side}-${si}`;
      path.push({kind:'bridge',id:bid,bridgeId:br?.id,strandIndex:si,label:`HT Bridge ${si+1}→${htS[k+1]+1} at ${side} end`});
      if(!br&&faultStep===null) faultStep=path.length-1;
      else if(br) check(br.id);
    }
  });
  eS.forEach((si,k)=>{
    const segs = k%2===0 ? [...sortedSegs].reverse() : sortedSegs;
    const side = k%2===0 ? 'left' : 'right';
    segs.forEach(seg=>{
      const sid=`strand-${seg.id}-${si}`;
      path.push({kind:'strand',id:sid,segmentId:seg.id,strandIndex:si,label:`Strand ${si+1} (Earth)`});
      check(sid);
    });
    if(k<eS.length-1){
      const br=bridges.find(b=>b.type==='earth'&&b.side===side&&b.strandIndex===si);
      const bid=br?.id??`missing-earth-${side}-${si}`;
      path.push({kind:'bridge',id:bid,bridgeId:br?.id,strandIndex:si,label:`Earth Bridge ${si+1}→${eS[k+1]+1} at ${side} end`});
      if(!br&&faultStep===null) faultStep=path.length-1;
      else if(br) check(br.id);
    }
  });
  path.push({kind:'energizer_in',id:'enrg_in',label:'Energizer – (Live Return)'});
  return{path,faultStep,complete:faultStep===null};
}

export function generateCorrectBridges(segments:Segment[],strandCount:number):Bridge[]{
  const bridges:Bridge[]=[];
  const htS=Array.from({length:strandCount},(_,i)=>i).filter(i=>i%2===0);
  const eS=Array.from({length:strandCount},(_,i)=>i).filter(i=>i%2===1);
  const lastSeg=segments[segments.length-1];
  const segId=lastSeg?.id??'seg0';
  htS.forEach((si,k)=>{ if(k>=htS.length-1)return; const side=k%2===0?'right':'left'; bridges.push({id:`ht-${side}-${si}`,segmentId:segId,strandIndex:si,type:'ht',side}); });
  eS.forEach((si,k)=>{ if(k>=eS.length-1)return; const side=k%2===0?'left':'right'; bridges.push({id:`earth-${side}-${si}`,segmentId:segId,strandIndex:si,type:'earth',side}); });
  return bridges;
}
