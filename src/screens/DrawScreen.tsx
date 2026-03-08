import React,{useState,useRef,useCallback,useEffect} from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Dimensions,ScrollView,Alert}from 'react-native';
import Svg,{Line,Rect,Circle,Text as SvgText,G}from 'react-native-svg';
import{Post,Segment,Bridge,FaultItem,BridgeType,BridgeSide}from '../engine/circuitTypes';
import{traceCircuit,generateCorrectBridges,PathStep}from '../engine/circuitEngine';

const{width:SW}=Dimensions.get('window');
const C={bg:'#0d1219',panel:'#111827',border:'#1e293b',ht:'#ef4444',earth:'#22c55e',post:'#94a3b8',energizer:'#f59e0b',spike:'#6b7280',fault:'#f97316',text:'#e2e8f0',muted:'#64748b',sim:'#60a5fa',dead:'#2d3748'};
const SG=14,PTOP=22,PBOT=22,CLIP=15,EW=54,EH=40,CW=SW*3,CH=520;
type TM='post'|'ht_bridge'|'earth_bridge'|'fault'|'delete';
function uid(){return 'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}

export default function DrawScreen(){
  const[posts,setPosts]=useState<Post[]>([]);
  const[segments,setSegments]=useState<Segment[]>([]);
  const[bridges,setBridges]=useState<Bridge[]>([]);
  const[faults,setFaults]=useState<FaultItem[]>([]);
  const[n,setN]=useState(8);
  const[tool,setTool]=useState<TM>('post');
  const[simRunning,setSimRunning]=useState(false);
  const[activeIds,setActiveIds]=useState<Set<string>>(new Set());
  const[faultHighlight,setFaultHighlight]=useState<Set<string>>(new Set());
  const[simDone,setSimDone]=useState<'ok'|'fault'|null>(null);
  const timer=useRef<any>(null);

  const strandH=(n-1)*SG;
  const pTop=PTOP,pBot=PTOP+strandH+PBOT;
  const sY=(i:number)=>PTOP+PBOT/2+i*SG;
  const centY=CH/2-( pTop+strandH/2);

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

  const tap=useCallback((x:number,y:number)=>{
    const offsetY=CH/2-(pTop+strandH/2);
    if(tool==='post'){
      const sx=Math.round(x/90)*90;
      if(sx<80)return;
      if(posts.some(p=>Math.abs(p.x-sx)<50))return;
      setPosts(p=>[...p,{id:uid(),x:sx,y:CH/2}]);
    }
    if((tool==='ht_bridge'||tool==='earth_bridge')&&posts.length>=2){
      const sorted=[...posts].sort((a,b)=>a.x-b.x);
      const nearPost=sorted.reduce((p,c)=>Math.abs(c.x-x)<Math.abs(p.x-x)?c:p);
      const isLeft=nearPost.id===sorted[0].id;
      const isRight=nearPost.id===sorted[sorted.length-1].id;
      const side:BridgeSide=isLeft?'left':isRight?'right':x<nearPost.x?'left':'right';
      const relY=y-offsetY-PBOT/2;
      let si=Math.max(0,Math.min(n-2,Math.round(relY/SG)));
      const bt:BridgeType=tool==='ht_bridge'?'ht':'earth';
      if(bt==='ht'&&si%2!==0)si=si>0?si-1:0;
      if(bt==='earth'&&si%2===0)si=si+1<n?si+1:si-1;
      if(si+2>n)return;
      if(bridges.some(b=>b.type===bt&&b.side===side&&b.strandIndex===si)){Alert.alert('Already placed');return;}
      setBridges(b=>[...b,{id:uid(),segmentId:segments[0]?.id??'',strandIndex:si,type:bt,side}]);
    }
    if(tool==='fault'&&segments.length>0){
      const offsetY2=CH/2-(pTop+strandH/2);
      const relY=y-offsetY2-PBOT/2;
      const si=Math.max(0,Math.min(n-1,Math.round(relY/SG)));
      const sorted=[...posts].sort((a,b)=>a.x-b.x);
      for(let i=0;i<sorted.length-1;i++){
        if(x>=sorted[i].x&&x<=sorted[i+1].x){
          const seg=segments.find(s=>{
            const pa=posts.find(p=>p.id===s.postA);
            return pa&&Math.abs(pa.x-sorted[i].x)<5;
          });
          if(seg){
            const fid=`strand-${seg.id}-${si}`;
            setFaults(prev=>prev.find(f=>f.id===fid)?prev.filter(f=>f.id!==fid):[...prev,{id:fid,kind:'strand'}]);
          }
          return;
        }
      }
    }
    if(tool==='delete'){
      const near=posts.reduce((p,c)=>Math.hypot(c.x-x,c.y-y)<Math.hypot(p.x-x,p.y-y)?c:p,posts[0]);
      if(near&&Math.hypot(near.x-x,near.y-y)<60){
        setPosts(p=>p.filter(pp=>pp.id!==near.id));
        setBridges(b=>b.filter(br=>{
          const aff=segments.filter(s=>s.postA===near.id||s.postB===near.id);
          return!aff.some(s=>s.id===br.segmentId);
        }));
      }
    }
  },[tool,posts,segments,bridges,n,strandH]);

  const autoWire=()=>{
    if(!segments.length){Alert.alert('Place posts first');return;}
    const correct=generateCorrectBridges(segments,n);
    setBridges(correct);
  };

  const startSim=()=>{
    if(!segments.length){Alert.alert('Draw the fence first');return;}
    stopSim();
    const result=traceCircuit(posts,segments,bridges,faults,n);
    setSimDone(null);
    setActiveIds(new Set());
    setFaultHighlight(new Set());
    setSimRunning(true);
    let step=0;
    const active=new Set<string>();
    const run=()=>{
      if(step>=result.path.length){
        setSimRunning(false);
        setSimDone('ok');
        Alert.alert('✅ No Faults','Current completed full circuit. Fence is correctly wired.');
        return;
      }
      const p=result.path[step];
      const isFault=result.faultStep!==null&&step>=result.faultStep;
      if(isFault){
        const fh=new Set<string>();fh.add(p.id);
        setFaultHighlight(fh);
        setSimRunning(false);
        setSimDone('fault');
        Alert.alert('⚡ FAULT DETECTED',`Circuit stopped at:\n\n${p.label}\n\nThis component is open or broken.\nCheck bridge clip or strand at this location.`);
        return;
      }
      active.add(p.id);
      setActiveIds(new Set(active));
      step++;
      timer.current=setTimeout(run,150);
    };
    timer.current=setTimeout(run,400);
  };

  const stopSim=()=>{
    if(timer.current)clearTimeout(timer.current);
    setSimRunning(false);setActiveIds(new Set());setFaultHighlight(new Set());setSimDone(null);
  };

  const clearAll=()=>{stopSim();setPosts([]);setSegments([]);setBridges([]);setFaults([]);};

  const sorted=[...posts].sort((a,b)=>a.x-b.x);
  const oY=CH/2-(pTop+strandH/2);
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
        {([['post','📍','Post'],['ht_bridge','🔴','HT Br'],['earth_bridge','🟢','E Br'],['fault','⚠','Fault'],['delete','✕','Delete']] as [TM,string,string][]).map(([t,ic,lb])=>(
          <TouchableOpacity key={t} style={[s.tBtn,tool===t&&s.tBtnOn]} onPress={()=>setTool(t)}>
            <Text style={s.tIc}>{ic}</Text>
            <Text style={[s.tLb,tool===t&&{color:C.energizer}]}>{lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.hint}>
        <Text style={s.hintTxt}>
          {tool==='post'&&'📍 Tap canvas to place posts — strands auto-fill between them'}
          {tool==='ht_bridge'&&'🔴 Tap near a post end to snap an HT bridge clip'}
          {tool==='earth_bridge'&&'🟢 Tap near a post end to snap an Earth bridge clip'}
          {tool==='fault'&&'⚠ Tap a strand to mark/unmark as broken'}
          {tool==='delete'&&'✕ Tap a post to remove it'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator style={{flex:1}}
        contentContainerStyle={{width:CW}}
        maximumZoomScale={4} minimumZoomScale={0.3}
        bouncesZoom={true} centerContent={true}>
        <ScrollView showsVerticalScrollIndicator contentContainerStyle={{width:CW,height:CH}}>
          <Svg width={CW} height={CH}
            onPress={(e)=>tap(e.nativeEvent.locationX,e.nativeEvent.locationY)}>
            {Array.from({length:Math.floor(CW/90)+1},(_,xi)=>
              Array.from({length:Math.floor(CH/90)+1},(_,yi)=>(
                <Circle key={`g${xi}${yi}`} cx={xi*90} cy={yi*90} r={1.5} fill={C.border} opacity={0.5}/>
              ))
            )}
            {posts.length===0&&(
              <SvgText x={CW/3} y={CH/2} fill={C.muted} fontSize={14} textAnchor="middle">
                {'Tap here to place posts →'}
              </SvgText>
            )}
            {segments.map(seg=>{
              const pA=posts.find(p=>p.id===seg.postA),pB=posts.find(p=>p.id===seg.postB);
              if(!pA||!pB)return null;
              return Array.from({length:n},(_,i)=>{
                const y=oY+sY(i);
                const id=`strand-${seg.id}-${i}`;
                const col=sCol(i,seg.id);
                const isF=faultSet.has(id);
                return(<G key={id} onPress={()=>{
                  if(tool==='fault')setFaults(prev=>prev.find(f=>f.id===id)?prev.filter(f=>f.id!==id):[...prev,{id,kind:'strand'}]);
                }}>
                  <Line x1={pA.x} y1={y} x2={pB.x} y2={y} stroke={col}
                    strokeWidth={activeIds.has(id)?3:2}
                    strokeDasharray={isF?'7,4':undefined} strokeLinecap="round"/>
                  {isF&&<Circle cx={(pA.x+pB.x)/2} cy={y} r={5} fill={C.fault} opacity={0.8}/>}
                </G>);
              });
            })}
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
            {bridges.map(b=>{
              const postForSide=b.side==='left'?sorted[0]:sorted[sorted.length-1];
              if(!postForSide)return null;
              const px=postForSide.x;
              const dir=b.side==='left'?-1:1;
              const iB=b.strandIndex+2;
              if(iB>=n)return null;
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
            {sorted.length>0&&(()=>{
              const ex=sorted[0].x-EW-18;
              const ey=oY+sY(0)-EH/2;
              const enA=activeIds.has('enrg_out');
              return(<G key="enrg">
                <Rect x={ex} y={ey} width={EW} height={EH} fill="#1c1600" stroke={enA?C.sim:C.energizer} strokeWidth={2} rx={6}/>
                <SvgText x={ex+EW/2} y={ey+EH/2-1} fill={C.energizer} fontSize={14} textAnchor="middle">⚡</SvgText>
                <SvgText x={ex+EW/2} y={ey+EH/2+11} fill={C.energizer} fontSize={6} textAnchor="middle" fontWeight="bold">ENRGZR</SvgText>
                <SvgText x={ex+EW+3} y={ey+EH*0.28+4} fill={C.ht} fontSize={11} fontWeight="bold">+</SvgText>
                <Line x1={ex+EW} y1={ey+EH*0.28} x2={sorted[0].x} y2={oY+sY(0)} stroke={enA?C.sim:C.ht} strokeWidth={enA?2.5:1.5} strokeDasharray="4,3"/>
                <SvgText x={ex+EW+3} y={ey+EH*0.72+4} fill={C.earth} fontSize={11} fontWeight="bold">–</SvgText>
                <Line x1={ex+EW} y1={ey+EH*0.72} x2={sorted[0].x} y2={oY+sY(n-1)} stroke={C.earth} strokeWidth={1.5} strokeDasharray="4,3"/>
                {/* Return path dotted lines showing circuit route */}
                {bridges.filter(b=>b.type==='ht').map((b,i)=>{
                  const postForSide=b.side==='left'?sorted[0]:sorted[sorted.length-1];
                  if(!postForSide||b.strandIndex+2>=n)return null;
                  const px=postForSide.x,dir=b.side==='left'?-1:1;
                  const yA=oY+sY(b.strandIndex),yB=oY+sY(b.strandIndex+2);
                  const cx=px+dir*CLIP;
                  return(<G key={"ret-ht"+i}>
                    <Line x1={px} y1={yA} x2={cx} y2={yA} stroke={C.ht} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
                    <Line x1={cx} y1={yA} x2={cx} y2={yB} stroke={C.ht} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
                    <Line x1={cx} y1={yB} x2={px} y2={yB} stroke={C.ht} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
                  </G>);
                })}
                {bridges.filter(b=>b.type==='earth').map((b,i)=>{
                  const postForSide=b.side==='left'?sorted[0]:sorted[sorted.length-1];
                  if(!postForSide||b.strandIndex+2>=n)return null;
                  const px=postForSide.x,dir=b.side==='left'?-1:1;
                  const yA=oY+sY(b.strandIndex),yB=oY+sY(b.strandIndex+2);
                  const cx=px+dir*CLIP;
                  return(<G key={"ret-e"+i}>
                    <Line x1={px} y1={yA} x2={cx} y2={yA} stroke={C.earth} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
                    <Line x1={cx} y1={yA} x2={cx} y2={yB} stroke={C.earth} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
                    <Line x1={cx} y1={yB} x2={px} y2={yB} stroke={C.earth} strokeWidth={1} strokeDasharray="3,3" opacity={0.4}/>
                  </G>);
                })}
                <Line x1={ex+EW/2} y1={ey+EH} x2={ex+EW/2} y2={oY+pBot+6} stroke={C.earth} strokeWidth={1.5}/>
                {[-14,0,14].map((off,i)=>{const sx=ex+EW/2+off,sy=oY+pBot+6;return(<G key={i}>
                  <Line x1={sx} y1={sy} x2={sx} y2={sy+22} stroke={C.spike} strokeWidth={2.5} strokeLinecap="round"/>
                  <Line x1={sx-5} y1={sy+8} x2={sx+5} y2={sy+8} stroke={C.spike} strokeWidth={1.5}/>
                  <Line x1={sx-3} y1={sy+14} x2={sx+3} y2={sy+14} stroke={C.spike} strokeWidth={1.5}/>
                </G>);})}
              </G>);
            })()}
          </Svg>
        </ScrollView>
      </ScrollView>

      <View style={s.statsRow}>
        {[['POSTS',posts.length],['BRIDGES',`${placed}/${correct.length}`],['FAULTS',faults.length],['SIM',simDone==='ok'?'✓ OK':simDone==='fault'?'✗ FAULT':'—']].map(([l,v])=>(
          <View key={l as string} style={s.stat}>
            <Text style={[s.statV,{color:l==='FAULTS'&&(v as number)>0?C.fault:l==='SIM'&&simDone==='fault'?C.fault:l==='SIM'&&simDone==='ok'?C.earth:C.energizer}]}>{v}</Text>
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
  topBtns:{flexDirection:'row',gap:6},
  btn:{paddingHorizontal:10,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#111827'},
  btnTxt:{color:'#e2e8f0',fontSize:10,fontWeight:'700'},
  strandRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:5,paddingHorizontal:12,paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  sLbl:{color:'#64748b',fontSize:9,fontWeight:'700'},
  chip:{paddingHorizontal:7,paddingVertical:3,borderRadius:5,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#0d1219'},
  chipOn:{borderColor:'#f59e0b',backgroundColor:'#1c1600'},
  cTxt:{color:'#64748b',fontSize:10,fontWeight:'600'},
  cOn:{color:'#f59e0b'},
  toolbar:{flexDirection:'row',paddingHorizontal:8,paddingVertical:6,gap:4,borderBottomWidth:1,borderBottomColor:'#1e293b',backgroundColor:'#111827'},
  tBtn:{flex:1,alignItems:'center',paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'#1e293b'},
  tBtnOn:{borderColor:'#f59e0b',backgroundColor:'#1c1600'},
  tIc:{fontSize:13},
  tLb:{color:'#64748b',fontSize:7,marginTop:1,fontWeight:'600'},
  hint:{backgroundColor:'#0a1a0f',paddingHorizontal:12,paddingVertical:4,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  hintTxt:{color:'#22c55e',fontSize:9,fontWeight:'600'},
  statsRow:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#1e293b',backgroundColor:'#111827'},
  stat:{flex:1,alignItems:'center',paddingVertical:7},
  statV:{color:'#f59e0b',fontSize:13,fontWeight:'800'},
  statL:{color:'#64748b',fontSize:7,letterSpacing:0.5,marginTop:1},
});
