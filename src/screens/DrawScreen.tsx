import React,{useState,useRef,useCallback,useEffect}from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Dimensions,ScrollView,Alert,PanResponder}from 'react-native';
import Svg,{Line,Rect,Circle,Text as SvgText,G}from 'react-native-svg';
import{Post,Segment,Bridge,FaultItem,BridgeType,BridgeSide}from '../engine/circuitTypes';
import{traceCircuit,generateCorrectBridges,PathStep}from '../engine/circuitEngine';

const{width:SW,height:SH}=Dimensions.get('window');
const C={bg:'#0d1219',dead:'#2d3748',panel:'#111827',border:'#1e293b',ht:'#ef4444',earth:'#22c55e',post:'#94a3b8',energizer:'#f59e0b',spike:'#6b7280',fault:'#f97316',text:'#e2e8f0',muted:'#64748b',sim:'#60a5fa',dead:'#2d3748'};
const SG=14,PTOP=22,PBOT=22,CLIP=15,EW=54,EH=40,CW=4000,CH=520;
type TM='post'|'ht_bridge'|'earth_bridge'|'fault'|'gate'|'delete';
interface GateContact{id:string;segmentId:string;open:boolean;}
function uid(){return 'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}

export default function DrawScreen(){
  const[posts,setPosts]=useState<Post[]>([]);
  const[segments,setSegments]=useState<Segment[]>([]);
  const[bridges,setBridges]=useState<Bridge[]>([]);
  const[faults,setFaults]=useState<FaultItem[]>([]);
  const[gates,setGates]=useState<GateContact[]>([]);
  const[n,setN]=useState(8);
  const[tool,setTool]=useState<TM>('post');
  const toolRef=useRef<TM>('post');
  const[simRunning,setSimRunning]=useState(false);
  const[activeIds,setActiveIds]=useState<Set<string>>(new Set());
  const[faultHighlight,setFaultHighlight]=useState<Set<string>>(new Set());
  const[simDone,setSimDone]=useState<'ok'|'fault'|null>(null);
  const[simStep,setSimStep]=useState(-1);
  const timer=useRef<any>(null);
  const[scale,setScale]=useState(1);
  const panX=useRef(0);
  const panY=useRef(0);
  const[viewBox,setViewBox]=useState({x:-SW/2+100,y:-SH/2+CH/2,w:SW,h:SH});
  const scaleRef=useRef(1);
  const panStart=useRef({x:0,y:0});
  const rafPending=useRef(false);
  const strandH=(n-1)*SG;
  const pTop=PTOP,pBot=PTOP+strandH+PBOT;
  const sY=(i:number)=>PTOP+PBOT/2+i*SG;
  const tapStart=useRef({x:0,y:0});
  const canvasTop=useRef(0);
  const oYRef=useRef(0);
  const panResponder=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:(_,gs)=>Math.abs(gs.dx)>4||Math.abs(gs.dy)>4,
    onPanResponderGrant:(e,gs)=>{
      tapStart.current={x:gs.x0,y:e.nativeEvent.locationY};
      panStart.current={x:panX.current,y:panY.current};
    },
    onPanResponderMove:(_,gs)=>{
      panX.current=panStart.current.x+gs.dx;
      panY.current=panStart.current.y+gs.dy;
      if(!rafPending.current){
        rafPending.current=true;
        requestAnimationFrame(()=>{
          rafPending.current=false;
          setViewBox({x:-panX.current/scaleRef.current,y:-panY.current/scaleRef.current,w:SW/scaleRef.current,h:SH/scaleRef.current});
        });
      }
    },
    onPanResponderRelease:(_,gs)=>{
      if(Math.abs(gs.dx)<12&&Math.abs(gs.dy)<12){
        tapRef.current(tapStart.current.x,tapStart.current.y);
      }
    },
  })).current;
  const oY=CH/2-(pTop+strandH/2);
  oYRef.current=oY;

  useEffect(()=>{
    if(posts.length<2){setSegments([]);return;}
    const sorted=[...posts].sort((a,b)=>a.x-b.x);
    const segs:Segment[]=[];
    for(let i=0;i<sorted.length-1;i++){
      const ex=segments.find(s=>s.postA===sorted[i].id&&s.postB===sorted[i+1].id);
      segs.push(ex??{id:uid(),postA:sorted[i].id,postB:sorted[i+1].id});
    }
    setSegments(segs);
  },[posts.length]);

  const tap=useCallback((rawX:number,rawY:number)=>{
    const x=(rawX-panX.current)/scaleRef.current,y=(rawY-panY.current)/scaleRef.current;
    const strandZeroY=oY+PTOP+PBOT/2;
    const tool=toolRef.current;
    if(tool==='post'){
      const sx=Math.round(x/110)*110;
      if(sx<80)return;
      if(posts.some(p=>Math.abs(p.x-sx)<80))return;
      setPosts(p=>[...p,{id:uid(),x:sx,y:CH/2}]);
      return;
    }
    if((tool==='ht_bridge'||tool==='earth_bridge')&&posts.length>=2){
      const sorted=[...posts].sort((a,b)=>a.x-b.x);
      const nearPost=sorted.reduce((p,c)=>Math.abs(c.x-x)<Math.abs(p.x-x)?c:p);
      const isLeft=nearPost.id===sorted[0].id;
      const isRight=nearPost.id===sorted[sorted.length-1].id;
      const side:BridgeSide=isLeft?'left':isRight?'right':x<nearPost.x?'left':'right';
      const bt:BridgeType=tool==='ht_bridge'?'ht':'earth';
      const strandZeroYNow=oYRef.current+PTOP+PBOT/2;
      let si=Math.round((y-strandZeroYNow)/SG);
      si=Math.max(0,Math.min(n-2,si));
      Alert.alert('TAP DEBUG','rawY='+rawY.toFixed(0)+' cTop='+canvasTop.current.toFixed(0)+'\npanY='+panY.current.toFixed(0)+' scale='+scaleRef.current.toFixed(2)+'\ny='+y.toFixed(0)+' oY='+oYRef.current.toFixed(0)+'\nstrandZ='+strandZeroYNow.toFixed(0)+' si='+si);
      const seg=segments.find(s=>{
        const pa=posts.find(p=>p.id===s.postA);
        const pb=posts.find(p=>p.id===s.postB);
        return (pa&&Math.abs(pa.x-nearPost.x)<5)||(pb&&Math.abs(pb.x-nearPost.x)<5);
      });
      const segId=seg?.id??segments[0]?.id??'';
      if(bridges.some(b=>b.segmentId===segId&&b.type===bt&&b.side===side&&b.strandIndex===si)){Alert.alert('Already placed');return;}
      setBridges(b=>[...b,{id:uid(),segmentId:segId,strandIndex:si,type:bt,side}]);
      return;
    }
    if(tool==='fault'&&segments.length>0){
      const si=Math.max(0,Math.min(n-1,Math.round((y-strandZeroY)/SG)));
      const sortedP=[...posts].sort((a,b)=>a.x-b.x);
      for(let i=0;i<sortedP.length-1;i++){
        if(x>=sortedP[i].x&&x<=sortedP[i+1].x){
          const seg=segments.find(s=>{const pa=posts.find(p=>p.id===s.postA);return pa&&Math.abs(pa.x-sortedP[i].x)<5;});
          if(seg){
            const fid=`strand-${seg.id}-${si}`;
            setFaults(prev=>prev.find(f=>f.id===fid)?prev.filter(f=>f.id!==fid):[...prev,{id:fid,kind:'strand'}]);
          }
          return;
        }
      }
      return;
    }
    if(tool==='gate'&&segments.length>0){
      const sortedP=[...posts].sort((a,b)=>a.x-b.x);
      for(let i=0;i<sortedP.length-1;i++){
        if(x>=sortedP[i].x&&x<=sortedP[i+1].x){
          const seg=segments.find(s=>{const pa=posts.find(p=>p.id===s.postA);return pa&&Math.abs(pa.x-sortedP[i].x)<5;});
          if(seg){
            const ex=gates.find(g=>g.segmentId===seg.id);
            if(ex)setGates(prev=>prev.map(g=>g.id===ex.id?{...g,open:!g.open}:g));
            else setGates(prev=>[...prev,{id:uid(),segmentId:seg.id,open:false}]);
          }
          return;
        }
      }
      return;
    }
    if(tool==='delete'&&posts.length>0){
      const near=posts.reduce((p,c)=>Math.hypot(c.x-x,c.y-y)<Math.hypot(p.x-x,p.y-y)?c:p);
      if(near&&Math.hypot(near.x-x,near.y-y)<60){
        const affSegs=segments.filter(s=>s.postA===near.id||s.postB===near.id);
        setPosts(p=>p.filter(pp=>pp.id!==near.id));
        setBridges(b=>b.filter(br=>!affSegs.some(s=>s.id===br.segmentId)));
        setGates(g=>g.filter(gg=>!affSegs.some(s=>s.id===gg.segmentId)));
      }
    }
  },[posts,segments,bridges,gates,n,oY,strandH]);
  const tapRef=useRef(tap);
  useEffect(()=>{tapRef.current=tap;},[tap]);

  const autoWire=()=>{
    if(!segments.length){Alert.alert('Place posts first');return;}
    setBridges(generateCorrectBridges(segments,n));
  };

  const clearSim=()=>{setActiveIds(new Set());setFaultHighlight(new Set());setSimDone(null);setSimStep(-1);};

  const startSim=()=>{
    if(!segments.length){Alert.alert('Draw the fence first');return;}
    if(simTimer.current)clearTimeout(simTimer.current);
    clearSim();
    const result=traceCircuit(posts,segments,bridges,faults,n);
    setSimRunning(true);
    let step=0;
    const active=new Set<string>();
    const run=()=>{
      if(step>=result.path.length){setSimRunning(false);setSimDone('ok');Alert.alert('✅ No Faults','Full circuit complete. Fence is correctly wired.');return;}
      const p=result.path[step];
      const isFault=result.faultStep!==null&&step>=result.faultStep;
      if(isFault){
        const fh=new Set<string>();fh.add(p.id);
        setFaultHighlight(fh);setSimRunning(false);setSimDone('fault');
        Alert.alert('⚡ FAULT DETECTED',`Circuit stopped at:\n\n${p.label}\n\nThis component is open or broken.`);
        return;
      }
      active.add(p.id);setActiveIds(new Set(active));setSimStep(step);step++;
      simTimer.current=setTimeout(run,150);
    };
    simTimer.current=setTimeout(run,400);
  };

  const simTimer=useRef<any>(null);
  const stopSim=()=>{if(simTimer.current)clearTimeout(simTimer.current);setSimRunning(false);};
  const clearAll=()=>{stopSim();clearSim();setPosts([]);setSegments([]);setBridges([]);setFaults([]);setGates([]);};

  const sorted=[...posts].sort((a,b)=>a.x-b.x);
  const faultSet=new Set(faults.map(f=>f.id));

  const sCol=(si:number,segId:string)=>{
    const id=`strand-${segId}-${si}`;
    if(faultHighlight.has(id))return C.fault;
    if(activeIds.has(id))return C.sim;
    if(faultSet.has(id))return C.fault;
    if(simDone&&!activeIds.has(id))return C.dead;
    return si%2===0?C.ht:C.earth;
  };
  const bCol=(b:Bridge)=>{
    if(faultHighlight.has(b.id))return C.fault;
    if(activeIds.has(b.id))return C.sim;
    if(faultSet.has(b.id))return C.fault;
    if(simDone&&!activeIds.has(b.id))return C.dead;
    return b.type==='ht'?C.ht:C.earth;
  };

  const correct=segments.length>0?generateCorrectBridges(segments,n):[];
  const placed=bridges.filter(b=>correct.some(c=>c.type===b.type&&c.side===b.side&&c.strandIndex===b.strandIndex)).length;
  const missing=correct.length-placed;

  // Energizer position
  const ex2=sorted.length>0?sorted[0].x-EW-18:120;
  const ey2=oY+sY(0)-EH/2;

  return(
    <View style={s.root}>
      <View style={s.topBar}>
        <View>
          <Text style={s.title}>✏ DRAW FENCE</Text>
          <Text style={s.sub}>{n} strands · {posts.length} posts · {bridges.length} bridges{missing>0?` · ⚠ ${missing} missing`:''}</Text>
        </View>
        <View style={s.topBtns}>
          <TouchableOpacity style={s.btn} onPress={autoWire}><Text style={s.btnTxt}>⚡ AUTO</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn,simRunning?{borderColor:C.fault}:{borderColor:C.sim}]} onPress={simRunning?stopSim:startSim}>
            <Text style={[s.btnTxt,{color:simRunning?C.fault:C.sim}]}>{simRunning?'■ STOP':'▶ SIM'}</Text>
          </TouchableOpacity>
          {simDone!==null&&<TouchableOpacity style={[s.btn,{borderColor:C.muted}]} onPress={clearSim}>
            <Text style={s.btnTxt}>✕ CLR</Text>
          </TouchableOpacity>}
          <TouchableOpacity style={s.btn} onPress={clearAll}><Text style={s.btnTxt}>🗑</Text></TouchableOpacity>
        </View>
      </View>

      <View style={s.strandRow}>
        <Text style={s.sLbl}>STRANDS:</Text>
        {[5,6,7,8,10,12,14,16,20,24,30].map(v=>(
          <TouchableOpacity key={v} style={[s.chip,n===v&&s.chipOn]} onPress={()=>setN(v)}>
            <Text style={[s.cTxt,n===v&&s.cOn]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.toolbar}>
        {([
          ['post','📍','Post'],
          ['ht_bridge','🔴','HT Br'],
          ['earth_bridge','🟢','E Br'],
          ['fault','⚠','Fault'],
          ['gate','🚪','Gate'],
          ['delete','✕','Del'],
        ] as [TM,string,string][]).map(([t,ic,lb])=>(
          <TouchableOpacity key={t} style={[s.tBtn,tool===t&&s.tBtnOn]} onPress={()=>{setTool(t);toolRef.current=t;}}>
            <Text style={s.tIc}>{ic}</Text>
            <Text style={[s.tLb,tool===t&&{color:C.energizer}]}>{lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.hintBar}>
        <Text style={[s.hintTxt,{flex:1}]}>
          {tool==='post'&&'📍 Tap canvas to place posts — strands auto-fill'}
          {tool==='ht_bridge'&&'🔴 Tap near a post end to snap an HT bridge clip'}
          {tool==='earth_bridge'&&'🟢 Tap near a post end to snap an Earth bridge clip'}
          {tool==='fault'&&'⚠ Tap a strand or bridge to mark/unmark as broken'}
          {tool==='gate'&&'🚪 Tap between posts to place gate — tap gate to toggle open/closed'}
          {tool==='delete'&&'✕ Tap a post to remove it'}
        </Text>
        <TouchableOpacity style={s.zBtn} onPress={()=>{scaleRef.current=Math.min(8,+(scaleRef.current+0.25).toFixed(2));setScale(scaleRef.current);setViewBox({x:-panX.current/scaleRef.current,y:-panY.current/scaleRef.current,w:SW/scaleRef.current,h:SH/scaleRef.current});}}>
          <Text style={s.zBtnTxt}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.zBtn} onPress={()=>{scaleRef.current=Math.max(0.1,+(scaleRef.current-0.25).toFixed(2));setScale(scaleRef.current);setViewBox({x:-panX.current/scaleRef.current,y:-panY.current/scaleRef.current,w:SW/scaleRef.current,h:SH/scaleRef.current});}}>
          <Text style={s.zBtnTxt}>－</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.zBtn} onPress={()=>{scaleRef.current=1;panX.current=0;panY.current=0;setScale(1);setViewBox({x:0,y:0,w:SW,h:SH});}}>
          <Text style={s.zBtnTxt}>⊙</Text>
        </TouchableOpacity>
      </View>

      <View style={{flex:1,overflow:'hidden'}} {...panResponder.panHandlers} onLayout={(e)=>{canvasTop.current=e.nativeEvent.layout.y;}}>
          <Svg width="100%" height="100%" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}>

            {/* Grid dots */}
            {Array.from({length:Math.floor(CW/90)+1},(_,xi)=>
              Array.from({length:Math.floor(CH/90)+1},(_,yi)=>(
                <Circle key={`g${xi}${yi}`} cx={xi*90} cy={yi*90} r={1.5} fill={C.border} opacity={0.5}/>
              ))
            )}

            {posts.length===0&&(
              <SvgText x={CW/3} y={CH/2} fill={C.muted} fontSize={14} textAnchor="middle">
                Tap here to place posts
              </SvgText>
            )}

            {/* Strands */}
            {segments.map((seg,segIdx)=>{
              const pA=posts.find(p=>p.id===seg.postA),pB=posts.find(p=>p.id===seg.postB);
              if(!pA||!pB)return null;
              return Array.from({length:n},(_,i)=>{
                const y=oY+sY(i);
                const id=`strand-${seg.id}-${i}`;
                const col=sCol(i,seg.id);
                const isF=faultSet.has(id);
                const isFirst=segIdx===0;
                const isLast=segIdx===segments.length-1;
                return(<G key={id} onPress={()=>{
                  if(tool==='fault')setFaults(prev=>prev.find(f=>f.id===id)?prev.filter(f=>f.id!==id):[...prev,{id,kind:'strand'}]);
                }}>
                  <Line x1={pA.x} y1={y} x2={pB.x} y2={y} stroke={col}
                    strokeWidth={activeIds.has(id)?3:2}
                    strokeDasharray={isF?'7,4':undefined} strokeLinecap="round"/>
                  {isF&&<Circle cx={(pA.x+pB.x)/2} cy={y} r={5} fill={C.fault} opacity={0.8}/>}
                  {isFirst&&<SvgText x={pA.x-6} y={y+4} fill={col} fontSize={8} textAnchor="end" opacity={0.75}>{i%2===0?'HT':'E'}</SvgText>}
                  {isLast&&<SvgText x={pB.x+6} y={y+4} fill={col} fontSize={9} fontWeight="bold" textAnchor="start" opacity={0.85}>{i+1}</SvgText>}
                </G>);
              });
            })}

            {/* Bridges */}
            {bridges.map(b=>{
              const postForSide=b.side==='left'?sorted[0]:sorted[sorted.length-1];
              if(!postForSide)return null;
              const seg2=segments.find(s=>s.id===b.segmentId);
              if(!seg2)return null;
              const pA2=posts.find(p=>p.id===seg2.postA);
              const pB2=posts.find(p=>p.id===seg2.postB);
              if(!pA2||!pB2)return null;
              const px=b.side==='left'?Math.min(pA2.x,pB2.x):Math.max(pA2.x,pB2.x);
              const dir=b.side==='left'?-1:1;
              const iB=b.strandIndex+2;
              if(iB>n||b.strandIndex<0)return null;
              const yA=oY+sY(b.strandIndex),yB=oY+sY(iB);
              const cx=px+dir*CLIP;
              const col=bCol(b);
              const sw=faultHighlight.has(b.id)||activeIds.has(b.id)?3:2;
              return(<G key={`br${b.id}`} onPress={()=>{
                if(tool==='fault')setFaults(prev=>prev.find(f=>f.id===b.id)?prev.filter(f=>f.id!==b.id):[...prev,{id:b.id,kind:'bridge'}]);
                if(tool==='delete')setBridges(prev=>prev.filter(br=>br.id!==b.id));
              }}>
                <Rect x={Math.min(px,cx)-5} y={yA-5} width={Math.abs(cx-px)+10} height={yB-yA+10} fill="transparent"/>
                <Line x1={px} y1={yA} x2={cx} y2={yA} stroke={col} strokeWidth={sw} strokeLinecap="round"/>
                <Line x1={cx} y1={yA} x2={cx} y2={yB} stroke={col} strokeWidth={sw} strokeLinecap="round"/>
                <Line x1={cx} y1={yB} x2={px} y2={yB} stroke={col} strokeWidth={sw} strokeLinecap="round"/>
                {faultHighlight.has(b.id)&&<Circle cx={cx} cy={(yA+yB)/2} r={6} fill={C.fault}/>}
              </G>);
            })}

            {/* Gate contact */}
            {gates.map(g=>{
              const seg=segments.find(s=>s.id===g.segmentId);
              if(!seg)return null;
              const pA=posts.find(p=>p.id===seg.postA),pB=posts.find(p=>p.id===seg.postB);
              if(!pA||!pB)return null;
              const gL=pA.x,gR=pB.x,topY=oY+pTop,botY=oY+pBot;
              const htS=Array.from({length:n},(_,i)=>i).filter(i=>i%2===0);
              const eS=Array.from({length:n},(_,i)=>i).filter(i=>i%2===1);
              const htCol=g.open?C.dead:C.ht;
              const eCol=g.open?C.dead:C.earth;
              const gCol=g.open?C.fault:'#a78bfa';
              const bW=72,bH=92,bX=gL-bW/2,bY=botY+24;
              const row1Y=bY+30,row2Y=bY+65;
              const sL=bX+10,sR=bX+bW-10;
              return(
                <G key={'gate-'+g.id} onPress={()=>{
                  if(tool==='gate'||tool==='fault')
                    setGates(prev=>prev.map(gg=>gg.id===g.id?{...gg,open:!gg.open}:gg));
                }}>
                  <Line x1={gL} y1={topY-12} x2={gL} y2={botY+8} stroke="#a78bfa" strokeWidth={11} strokeLinecap="round" opacity={0.85}/>
                  <Line x1={gR} y1={topY-12} x2={gR} y2={botY+8} stroke="#a78bfa" strokeWidth={11} strokeLinecap="round" opacity={0.85}/>
                  <SvgText x={gL} y={topY-24} fill="#a78bfa" fontSize={8} textAnchor="middle" fontWeight="bold">G-L</SvgText>
                  <SvgText x={gR} y={topY-24} fill="#a78bfa" fontSize={8} textAnchor="middle" fontWeight="bold">G-R</SvgText>
                  <Rect x={g.open?gL+(gR-gL)*0.3:gL+4} y={topY+2} width={(gR-gL)*0.63} height={botY-topY-4} fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="6,4" rx={2} opacity={0.5}/>
                  <SvgText x={g.open?gL+(gR-gL)*0.6:gL+(gR-gL)*0.35} y={(topY+botY)/2+4} fill="#a78bfa" fontSize={9} textAnchor="middle" fontWeight="bold" opacity={0.65}>{g.open?'OPEN':'GATE'}</SvgText>
                  {Array.from({length:n},(_,i)=>{
                    const sy=oY+sY(i);
                    return(<G key={'gcut'+i}>
                      <Rect x={gL-3} y={sy-4} width={9} height={8} fill={C.bg}/>
                      <Rect x={gR-6} y={sy-4} width={9} height={8} fill={C.bg}/>
                    </G>);
                  })}
                  {htS.map(si=>{
                    const sy=oY+sY(si);
                    return(<Line key={'hd'+si} x1={gL-4} y1={sy} x2={gL-4} y2={row1Y} stroke={htCol} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.7}/>);
                  })}
                  <Line x1={gL-4} y1={row1Y} x2={sL} y2={row1Y} stroke={htCol} strokeWidth={2}/>
                  {eS.map(si=>{
                    const sy=oY+sY(si);
                    return(<Line key={'ed'+si} x1={gL+4} y1={sy} x2={gL+4} y2={row2Y} stroke={eCol} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.7}/>);
                  })}
                  <Line x1={gL+4} y1={row2Y} x2={sL} y2={row2Y} stroke={eCol} strokeWidth={2}/>
                  <Rect x={bX} y={bY} width={bW} height={bH} fill="#111827" stroke={gCol} strokeWidth={2} rx={5}/>
                  <SvgText x={bX+bW/2} y={bY+12} fill={gCol} fontSize={8} textAnchor="middle" fontWeight="bold">GATE CONTACT</SvgText>
                  <Line x1={bX+4} y1={bY+16} x2={bX+bW-4} y2={bY+16} stroke={gCol} strokeWidth={0.5} opacity={0.4}/>
                  <Circle cx={sL} cy={row1Y} r={5} fill="#3d1010" stroke={C.ht} strokeWidth={1.5}/>
                  <Line x1={sL-3} y1={row1Y} x2={sL+3} y2={row1Y} stroke={C.ht} strokeWidth={1}/>
                  <Line x1={sL} y1={row1Y-3} x2={sL} y2={row1Y+3} stroke={C.ht} strokeWidth={1}/>
                  <SvgText x={sL} y={row1Y-9} fill={C.ht} fontSize={6} textAnchor="middle">L-IN</SvgText>
                  <Circle cx={sR} cy={row1Y} r={5} fill="#3d1010" stroke={C.ht} strokeWidth={1.5}/>
                  <Line x1={sR-3} y1={row1Y} x2={sR+3} y2={row1Y} stroke={C.ht} strokeWidth={1}/>
                  <Line x1={sR} y1={row1Y-3} x2={sR} y2={row1Y+3} stroke={C.ht} strokeWidth={1}/>
                  <SvgText x={sR} y={row1Y-9} fill={C.ht} fontSize={6} textAnchor="middle">L-OUT</SvgText>
                  {g.open
                    ?<G><Line x1={sL+6} y1={row1Y} x2={bX+bW/2-3} y2={row1Y} stroke={C.ht} strokeWidth={1.5}/><Line x1={bX+bW/2-3} y1={row1Y} x2={bX+bW/2+7} y2={row1Y-9} stroke={C.ht} strokeWidth={1.5}/><Circle cx={bX+bW/2-3} cy={row1Y} r={2} fill={C.ht}/><Circle cx={bX+bW/2+5} cy={row1Y} r={2} fill="none" stroke={C.ht} strokeWidth={1.5}/><Line x1={bX+bW/2+5} y1={row1Y} x2={sR-6} y2={row1Y} stroke={C.ht} strokeWidth={1.5}/></G>
                    :<G><Line x1={sL+6} y1={row1Y} x2={sR-6} y2={row1Y} stroke={C.ht} strokeWidth={2}/><Circle cx={bX+bW/2-3} cy={row1Y} r={2} fill={C.ht}/><Circle cx={bX+bW/2+3} cy={row1Y} r={2} fill={C.ht}/></G>
                  }
                  <Circle cx={sL} cy={row2Y} r={5} fill="#103d10" stroke={C.earth} strokeWidth={1.5}/>
                  <Line x1={sL-3} y1={row2Y} x2={sL+3} y2={row2Y} stroke={C.earth} strokeWidth={1}/>
                  <Line x1={sL} y1={row2Y-3} x2={sL} y2={row2Y+3} stroke={C.earth} strokeWidth={1}/>
                  <SvgText x={sL} y={row2Y-9} fill={C.earth} fontSize={6} textAnchor="middle">E-IN</SvgText>
                  <Line x1={sL+6} y1={row2Y} x2={sR-6} y2={row2Y} stroke={eCol} strokeWidth={2}/>
                  <Circle cx={sR} cy={row2Y} r={5} fill="#103d10" stroke={C.earth} strokeWidth={1.5}/>
                  <Line x1={sR-3} y1={row2Y} x2={sR+3} y2={row2Y} stroke={C.earth} strokeWidth={1}/>
                  <Line x1={sR} y1={row2Y-3} x2={sR} y2={row2Y+3} stroke={C.earth} strokeWidth={1}/>
                  <SvgText x={sR} y={row2Y-9} fill={C.earth} fontSize={6} textAnchor="middle">E-OUT</SvgText>
                  <SvgText x={bX+bW/2} y={bY+bH-5} fill={gCol} fontSize={7} textAnchor="middle" fontWeight="bold">{g.open?'ALARM - OPEN':'CLOSED - OK'}</SvgText>
                  <Line x1={sR} y1={row1Y} x2={gR} y2={row1Y} stroke={htCol} strokeWidth={2.5} strokeLinecap="round"/>
                  <SvgText x={(sR+gR)/2} y={row1Y-6} fill={htCol} fontSize={7} textAnchor="middle">HT</SvgText>
                  {htS.map(si=>{const sy=oY+sY(si);return(<Line key={'hr'+si} x1={gR} y1={row1Y} x2={gR} y2={sy} stroke={htCol} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.7}/>);})}
                  <Line x1={sR} y1={row2Y} x2={gR} y2={row2Y} stroke={eCol} strokeWidth={2.5} strokeLinecap="round"/>
                  <SvgText x={(sR+gR)/2} y={row2Y-6} fill={eCol} fontSize={7} textAnchor="middle">EARTH</SvgText>
                  {eS.map(si=>{const sy=oY+sY(si);return(<Line key={'er'+si} x1={gR} y1={row2Y} x2={gR} y2={sy} stroke={eCol} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.7}/>);})}
                  {Array.from({length:n},(_,i)=>{const sy=oY+sY(i);const col=i%2===0?htCol:eCol;return(<G key={'rd'+i}><Circle cx={gR+5} cy={sy} r={3} fill={col}/><Line x1={gR+5} y1={sy} x2={pB.x} y2={sy} stroke={col} strokeWidth={2}/></G>);})}
                </G>
              );
            })}
            {/* Posts */}
            {sorted.map((p,idx)=>{
              const isEnd=idx===0||idx===sorted.length-1;
              return(<G key={`post${p.id}`}>
                <Line x1={p.x} y1={oY+pTop-4} x2={p.x} y2={oY+pBot}
                  stroke={C.post} strokeWidth={isEnd?12:10} strokeLinecap="round" opacity={0.88}/>
                <Rect x={p.x-7} y={oY+pBot-4} width={14} height={8} fill={C.post} rx={2} opacity={0.7}/>
                <SvgText x={p.x} y={oY+pTop-11} fill={C.muted} fontSize={8} textAnchor="middle">
                  {idx===0?'END L':idx===sorted.length-1?'END R':`P${idx}`}
                </SvgText>
              </G>);
            })}

            {/* Energizer */}
            {sorted.length>0&&(()=>{
              const enA=activeIds.has('enrg_out');
              const htStrands=Array.from({length:n},(_,i)=>i).filter(i=>i%2===0);
              const lastHT=htStrands[htStrands.length-1]??0;
              const htCount=htStrands.length;
              const endsAtRight=htCount%2===1;
              const retY=oY+sY(lastHT);
              const enrgY=ey2+EH*0.72;
              return(<G key="enrg">
                <Rect x={ex2} y={ey2} width={EW} height={EH} fill="#1c1600" stroke={enA?C.sim:C.energizer} strokeWidth={2} rx={6}/>
                <SvgText x={ex2+EW/2} y={ey2+EH/2-1} fill={C.energizer} fontSize={14} textAnchor="middle">⚡</SvgText>
                <SvgText x={ex2+EW/2} y={ey2+EH/2+11} fill={C.energizer} fontSize={6} textAnchor="middle" fontWeight="bold">ENRGZR</SvgText>
                {/* + to strand 0 */}
                <SvgText x={ex2+EW+3} y={ey2+EH*0.28+4} fill={C.ht} fontSize={11} fontWeight="bold">+</SvgText>
                <Line x1={ex2+EW} y1={ey2+EH*0.28} x2={sorted[0].x} y2={oY+sY(0)} stroke={enA?C.sim:C.ht} strokeWidth={enA?2.5:1.5} strokeDasharray="4,3"/>
                {/* - return from last HT strand */}
                <SvgText x={ex2+EW+3} y={enrgY+4} fill={C.ht} fontSize={11} fontWeight="bold">–</SvgText>
                <Line x1={ex2+EW} y1={enrgY} x2={sorted[0].x} y2={enrgY} stroke={C.ht} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6}/>
                <Line x1={sorted[0].x} y1={enrgY} x2={sorted[0].x} y2={retY} stroke={C.ht} strokeWidth={1} strokeDasharray="3,4" opacity={0.4}/>
                {endsAtRight&&<Line x1={sorted[0].x} y1={retY} x2={sorted[sorted.length-1].x} y2={retY} stroke={C.ht} strokeWidth={1} strokeDasharray="3,4" opacity={0.35}/>}
                {/* Earth down to spikes */}
                <Line x1={ex2+EW/2} y1={ey2+EH} x2={ex2+EW/2} y2={oY+pBot+6} stroke={C.earth} strokeWidth={1.5}/>
                {[-14,0,14].map((off,i)=>{const sx=ex2+EW/2+off,sy=oY+pBot+6;return(<G key={i}>
                  <Line x1={sx} y1={sy} x2={sx} y2={sy+22} stroke={C.spike} strokeWidth={2.5} strokeLinecap="round"/>
                  <Line x1={sx-5} y1={sy+8} x2={sx+5} y2={sy+8} stroke={C.spike} strokeWidth={1.5}/>
                  <Line x1={sx-3} y1={sy+14} x2={sx+3} y2={sy+14} stroke={C.spike} strokeWidth={1.5}/>
                </G>);})}
              </G>);
            })()}
          </Svg>
      </View>

      <View style={s.statsRow}>
        {([
          ['POSTS',String(posts.length),false],
          ['BRIDGES',`${placed}/${correct.length}`,missing>0],
          ['FAULTS',String(faults.length),faults.length>0],
          ['SIM',simDone==='ok'?'✓ OK':simDone==='fault'?'✗ FAULT':'—',simDone==='fault'],
        ] as [string,string,boolean][]).map(([l,v,warn])=>(
          <View key={l} style={s.stat}>
            <Text style={[s.statV,{color:warn?C.fault:simDone==='ok'&&l==='SIM'?C.earth:C.energizer}]}>{v}</Text>
            <Text style={s.statL}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0d1219'},
  topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,paddingTop:10,paddingBottom:6,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  title:{color:'#f59e0b',fontSize:14,fontWeight:'900',letterSpacing:1.2},
  sub:{color:'#64748b',fontSize:9,marginTop:1},
  topBtns:{flexDirection:'row',gap:6,flexWrap:'wrap',justifyContent:'flex-end'},
  btn:{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#111827'},
  btnTxt:{color:'#e2e8f0',fontSize:10,fontWeight:'700'},
  strandRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:5,paddingHorizontal:12,paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  sLbl:{color:'#64748b',fontSize:9,fontWeight:'700'},
  chip:{paddingHorizontal:7,paddingVertical:3,borderRadius:5,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#0d1219'},
  chipOn:{borderColor:'#f59e0b',backgroundColor:'#1c1600'},
  cTxt:{color:'#64748b',fontSize:10,fontWeight:'600'},
  cOn:{color:'#f59e0b'},
  toolbar:{flexDirection:'row',paddingHorizontal:8,paddingVertical:6,gap:3,borderBottomWidth:1,borderBottomColor:'#1e293b',backgroundColor:'#111827'},
  tBtn:{flex:1,alignItems:'center',paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'#1e293b'},
  tBtnOn:{borderColor:'#f59e0b',backgroundColor:'#1c1600'},
  tIc:{fontSize:12},
  tLb:{color:'#64748b',fontSize:7,marginTop:1,fontWeight:'600'},
  hintBar:{backgroundColor:'#0a1a0f',paddingHorizontal:8,paddingVertical:4,borderBottomWidth:1,borderBottomColor:'#1e293b',flexDirection:'row',alignItems:'center',gap:4},  hint:{backgroundColor:'#0a1a0f',paddingHorizontal:12,paddingVertical:4,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  hintTxt:{color:'#22c55e',fontSize:9,fontWeight:'600'},
  statsRow:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#1e293b',backgroundColor:'#111827'},
  stat:{flex:1,alignItems:'center',paddingVertical:7},
  statV:{color:'#f59e0b',fontSize:13,fontWeight:'800'},
  statL:{color:'#64748b',fontSize:7,letterSpacing:0.5,marginTop:1},
  zBtn:{width:28,height:28,borderRadius:6,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#111827',alignItems:'center',justifyContent:'center'},
  zBtnTxt:{color:'#f59e0b',fontSize:16,fontWeight:'900',lineHeight:20},
});
