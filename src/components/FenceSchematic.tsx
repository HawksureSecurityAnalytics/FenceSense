import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal, Switch } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText, G, Path } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');
const C = {
  bg:'#0d1219',panel:'#111827',border:'#1e293b',
  ht:'#ef4444',earth:'#22c55e',post:'#94a3b8',
  energizer:'#f59e0b',spike:'#6b7280',
  fault:'#f97316',suspect:'#fbbf24',text:'#e2e8f0',muted:'#64748b',
};
const CLIP=13,SG=13,PTOP=18,PBOT=18,MARGIN_L=62,MARGIN_R=28;

type FS='ok'|'faulty'|'suspect';
type FT='ht_bridge'|'earth_bridge'|'strand'|'post';
interface Fault{pi:number;si:number;type:FT;state:FS;}
interface Cfg{n:number;posts:number;len:number;gate:boolean;gateAt:number;ftype:string;}

const SYMPTOMS:Record<FT,string>={
  ht_bridge:'This HT bridge is open — the live circuit is broken here. Strands beyond this point carry NO voltage. Alarm zone will trigger constantly. TEST: Use multimeter continuity mode across this bridge clip.',
  earth_bridge:'Earth return path broken here. Energizer output voltage drops significantly. Shock effectiveness reduced on entire fence. TEST: Multimeter continuity across this earth bridge clip.',
  strand:'Open circuit or earth short on this strand. If HT: no voltage on this strand. If Earth: return path affected. TEST: Walk the strand looking for breaks, sag, or vegetation contact.',
  post:'Insulator failure at this post. May cause HT-to-Earth short (low voltage, no alarm) or multiple open circuits. TEST: Visually inspect all insulators here for cracks or moisture.',
};
const CAUSES:Record<FT,string[]>={
  ht_bridge:['Corroded or loose clip','Broken insulator','Wire pulled from clip','Vandalism'],
  earth_bridge:['Corroded clip','Wet insulator (short risk)','Wire pulled from clip'],
  strand:['Vegetation touching wire','Animal/vehicle break','Wire fatigue','Corrosion at join'],
  post:['Post knocked over','Lightning strike','Insulators cracked','Moisture ingress'],
};
const GUIDES:Record<string,{title:string;steps:string[]}>={
  alarm_on:{title:'Alarm going off constantly',steps:[
    '1. Check energizer — is output voltage LOW (under 3kV on display)?',
    '2. Low voltage = short circuit somewhere. Walk each HT strand for vegetation contact.',
    '3. Disconnect fence zones one at a time until alarm stops — that isolates the faulty zone.',
    '4. In faulty zone: check post insulators for cracks or moisture causing HT-to-Earth short.',
    '5. Check all HT bridge clips in that zone — arcing on corroded clips can trigger alarm.',
    '6. Use multimeter: measure resistance between HT and Earth terminal (<1MΩ = short circuit).',
  ]},
  weak_shock:{title:'Weak or no shock / low voltage',steps:[
    '1. Confirm energizer is powered and energized (green/red LED).',
    '2. Measure voltage at energizer output with fence tester. Normal = 6–10kV.',
    '3. If OK at energizer but low at far end: earth return path is broken.',
    '4. Check ALL earth bridge clips from energizer end outward — find the open one.',
    '5. Test earth spikes: measure resistance energizer earth terminal to spike head (<10Ω good).',
    '6. Ensure earth spikes are at least 1m deep, soil is moist, spaced 3m apart.',
    '7. Mark any open earth bridge on the schematic using ⚠ FAULT mode.',
  ]},
  partial:{title:'Only part of fence working',steps:[
    '1. Use a fence tester at each post — find where voltage drops to zero.',
    '2. The fault is between the last good reading post and the first dead post.',
    '3. Check ALL bridge clips (HT and Earth) at the boundary post.',
    '4. Inspect the strand between those two posts for breaks or shorts.',
    '5. If gate is between those posts: check gate bypass cables are connected.',
    '6. Mark the boundary post and dead strand on the schematic.',
  ]},
  energizer_fault:{title:'Energizer fault light / no output',steps:[
    '1. Disconnect fence wires from energizer terminals. Does fault clear?',
    '2. If yes — the short is on the fence. Reconnect one zone at a time.',
    '3. When fault returns: that zone has the problem.',
    '4. In that zone: measure HT-to-Earth resistance (must be >1MΩ).',
    '5. Walk zone looking for wire touching metal post, staple, or wet vegetation.',
    '6. Check earth system: minimum 3 spikes, 1m deep, 3m apart.',
  ]},
};

export default function FenceSchematic(){
  const[cfg,setCfg]=useState<Cfg>({n:8,posts:2,len:50,gate:false,gateAt:1,ftype:'Security'});
  const[faults,setFaults]=useState<Fault[]>([]);
  const[faultMode,setFaultMode]=useState(false);
  const[showCfg,setShowCfg]=useState(false);
  const[showDiag,setShowDiag]=useState(false);
  const[showSymptoms,setShowSymptoms]=useState(false);
  const[activeSymptom,setActiveSymptom]=useState<string|null>(null);

  const totalPosts=cfg.posts+2;
  const usableW=SW-MARGIN_L-MARGIN_R-10;
  const PS=usableW/(totalPosts-1);
  const strandH=(cfg.n-1)*SG;
  const svgH=PTOP+strandH+PBOT+60;
  const pTop=PTOP,pBot=PTOP+strandH+PBOT;
  const sY=(i:number)=>PTOP+PBOT/2+i*SG;
  const pX=(i:number)=>MARGIN_L+i*PS;

  const getFault=useCallback((pi:number,si:number,t:FT):FS=>{
    return faults.find(f=>f.pi===pi&&f.si===si&&f.type===t)?.state??'ok';
  },[faults]);

  const tap=(pi:number,si:number,t:FT)=>{
    if(!faultMode)return;
    setFaults(prev=>{
      const ex=prev.find(f=>f.pi===pi&&f.si===si&&f.type===t);
      if(!ex)return[...prev,{pi,si,type:t,state:'faulty'}];
      if(ex.state==='faulty')return prev.map(f=>f===ex?{...f,state:'suspect'}:f);
      return prev.filter(f=>f!==ex);
    });
  };
  const col=(state:FS,def:string)=>state==='faulty'?C.fault:state==='suspect'?C.suspect:def;

  const renderClip=(pxi:number,iA:number,iB:number,isHT:boolean,side:'L'|'R')=>{
    const px=pX(pxi),yA=sY(iA),yB=sY(iB);
    const ft:FT=isHT?'ht_bridge':'earth_bridge';
    const state=getFault(pxi,iA,ft);
    const c=col(state,isHT?C.ht:C.earth);
    const sw=state!=='ok'?3:2;
    const cx=px+(side==='L'?-1:1)*CLIP;
    return(
      <G key={"cl"+pxi+iA+isHT} onPress={()=>tap(pxi,iA,ft)}>
        <Rect x={Math.min(px,cx)-5} y={yA-5} width={Math.abs(cx-px)+10} height={yB-yA+10} fill="transparent"/>
        <Line x1={px} y1={yA} x2={cx} y2={yA} stroke={c} strokeWidth={sw} strokeLinecap="round"/>
        <Line x1={cx} y1={yA} x2={cx} y2={yB} stroke={c} strokeWidth={sw} strokeLinecap="round"/>
        <Line x1={cx} y1={yB} x2={px} y2={yB} stroke={c} strokeWidth={sw} strokeLinecap="round"/>
        {state!=='ok'&&<Circle cx={cx} cy={(yA+yB)/2} r={4} fill={c}/>}
      </G>
    );
  };

  const renderPostClips=(pxi:number)=>{
    const clips:any[]=[];
    const isL=pxi===0,isR=pxi===totalPosts-1;
    const htS=Array.from({length:cfg.n},(_,i)=>i).filter(i=>i%2===0);
    const eS=Array.from({length:cfg.n},(_,i)=>i).filter(i=>i%2===1);
    // Series snake: pair k connects on RIGHT if k is even, LEFT if k is odd
    htS.forEach((si,k)=>{
      if(k>=htS.length-1)return;
      const side=k%2===0?'R':'L';
      if(isL&&side==='L')clips.push(renderClip(pxi,si,htS[k+1],true,'L'));
      else if(isR&&side==='R')clips.push(renderClip(pxi,si,htS[k+1],true,'R'));
      else if(!isL&&!isR)clips.push(renderClip(pxi,si,htS[k+1],true,side));
    });
    eS.forEach((si,k)=>{
      if(k>=eS.length-1)return;
      const side=k%2===0?'R':'L';
      if(isL&&side==='L')clips.push(renderClip(pxi,si,eS[k+1],false,'L'));
      else if(isR&&side==='R')clips.push(renderClip(pxi,si,eS[k+1],false,'R'));
      else if(!isL&&!isR)clips.push(renderClip(pxi,si,eS[k+1],false,side));
    });
    return clips;
  };

  const els:any[]=[];
  for(let i=0;i<cfg.n;i++){
    const y=sY(i),isHT=i%2===0;
    const state=getFault(99,i,'strand');
    const c=col(state,isHT?C.ht:C.earth);
    els.push(<G key={"str"+i} onPress={()=>tap(99,i,'strand')}>
      <Line x1={pX(0)} y1={y} x2={pX(totalPosts-1)} y2={y} stroke={c}
        strokeWidth={state!=='ok'?2.5:1.8} strokeDasharray={state==='faulty'?'7,4':undefined} strokeLinecap="round"/>
      <SvgText x={MARGIN_L-10} y={y+4} fill={c} fontSize={8} textAnchor="end" fontWeight="bold">{i+1}</SvgText>
      <SvgText x={MARGIN_L-22} y={y+4} fill={c} fontSize={7} textAnchor="end" opacity={0.65}>{isHT?'HT':'E'}</SvgText>
    </G>);
  }
  for(let p=0;p<totalPosts;p++){
    const px=pX(p),isEnd=p===0||p===totalPosts-1;
    const state=getFault(p,0,'post');
    const c=col(state,C.post);
    els.push(<G key={"post"+p} onPress={()=>tap(p,0,'post')}>
      <Line x1={px} y1={pTop-4} x2={px} y2={pBot} stroke={c} strokeWidth={isEnd?11:9} strokeLinecap="round" opacity={0.85}/>
      <Rect x={px-7} y={pBot-3} width={14} height={7} fill={c} rx={2} opacity={0.7}/>
      <SvgText x={px} y={pTop-10} fill={c} fontSize={7} textAnchor="middle" opacity={0.8}>
        {p===0?'END L':p===totalPosts-1?'END R':'P'+p}
      </SvgText>
      {state!=='ok'&&<Circle cx={px} cy={pTop-18} r={5} fill={c}/>}
    </G>);
  }
  for(let p=0;p<totalPosts;p++)els.push(...renderPostClips(p));
  const eW=50,eH=38,ex=pX(0)-eW-12,ey=sY(0)-eH/2;
  const liveY=ey+eH*0.28,retY=ey+eH*0.72;
  els.push(<G key="enrg">
    <Rect x={ex} y={ey} width={eW} height={eH} fill="#1c1600" stroke={C.energizer} strokeWidth={2} rx={5}/>
    <SvgText x={ex+eW/2} y={ey+eH/2-2} fill={C.energizer} fontSize={12} textAnchor="middle">⚡</SvgText>
    <SvgText x={ex+eW/2} y={ey+eH/2+10} fill={C.energizer} fontSize={6} textAnchor="middle" fontWeight="bold">ENRGZR</SvgText>
    <SvgText x={ex+eW+2} y={liveY+4} fill={C.ht} fontSize={10} fontWeight="bold">+</SvgText>
    <Line x1={ex+eW} y1={liveY} x2={pX(0)} y2={sY(0)} stroke={C.ht} strokeWidth={1.5} strokeDasharray="4,3"/>
    <SvgText x={ex+eW+2} y={retY+4} fill={C.earth} fontSize={10} fontWeight="bold">–</SvgText>
    <Line x1={ex+eW} y1={retY} x2={pX(0)} y2={sY(cfg.n-1)} stroke={C.earth} strokeWidth={1.5} strokeDasharray="4,3"/>
    <Line x1={ex+eW/2} y1={ey+eH} x2={ex+eW/2} y2={pBot+6} stroke={C.earth} strokeWidth={1.5}/>
    {[-14,0,14].map((off,i)=>{const sx=ex+eW/2+off,sy=pBot+6;return(<G key={"gnd"+i}>
      <Line x1={sx} y1={sy} x2={sx} y2={sy+22} stroke={C.spike} strokeWidth={2.5} strokeLinecap="round"/>
      <Line x1={sx-5} y1={sy+7} x2={sx+5} y2={sy+7} stroke={C.spike} strokeWidth={1.5}/>
      <Line x1={sx-3} y1={sy+13} x2={sx+3} y2={sy+13} stroke={C.spike} strokeWidth={1.5}/>
      <SvgText x={sx} y={sy+32} fill={C.muted} fontSize={6} textAnchor="middle">GND</SvgText>
    </G>);})}
  </G>);
  if(cfg.gate&&cfg.gateAt<totalPosts-1){
    const gx1=pX(cfg.gateAt),gx2=pX(cfg.gateAt+1),byY=pBot+22;
    els.push(<G key="gate">
      <Path d={`M ${gx1} ${sY(0)} L ${gx1} ${byY} L ${gx2} ${byY} L ${gx2} ${sY(0)}`}
        stroke={C.ht} strokeWidth={2} fill="none" strokeDasharray="5,3" strokeLinecap="round"/>
      <Path d={`M ${gx1} ${sY(cfg.n-1)} L ${gx1} ${byY+12} L ${gx2} ${byY+12} L ${gx2} ${sY(cfg.n-1)}`}
        stroke={C.earth} strokeWidth={2} fill="none" strokeDasharray="5,3" strokeLinecap="round"/>
      <Rect x={(gx1+gx2)/2-16} y={byY-7} width={32} height={13} fill="#1c1600" stroke={C.energizer} strokeWidth={1} rx={3}/>
      <SvgText x={(gx1+gx2)/2} y={byY+2} fill={C.energizer} fontSize={7} textAnchor="middle" fontWeight="bold">GATE</SvgText>
    </G>);
  }
  const dimY=pBot+(cfg.gate?48:10);
  els.push(<G key="dim">
    <Line x1={pX(0)} y1={dimY} x2={pX(totalPosts-1)} y2={dimY} stroke={C.muted} strokeWidth={0.8}/>
    <Line x1={pX(0)} y1={dimY-4} x2={pX(0)} y2={dimY+4} stroke={C.muted} strokeWidth={1}/>
    <Line x1={pX(totalPosts-1)} y1={dimY-4} x2={pX(totalPosts-1)} y2={dimY+4} stroke={C.muted} strokeWidth={1}/>
    <SvgText x={(pX(0)+pX(totalPosts-1))/2} y={dimY+11} fill={C.muted} fontSize={8} textAnchor="middle">{cfg.len}m</SvgText>
  </G>);

  const faultCount=faults.filter(f=>f.state==='faulty').length;
  const suspectCount=faults.filter(f=>f.state==='suspect').length;

  return(
    <View style={s.root}>
      <View style={s.topBar}>
        <View>
          <Text style={s.title}>⚡ FENCESENSE</Text>
          <Text style={s.sub}>{cfg.ftype.toUpperCase()} · {cfg.n} STRANDS · {cfg.len}m</Text>
        </View>
        <View style={s.topBtns}>
          <TouchableOpacity style={[s.btn,faultMode&&s.btnFault]} onPress={()=>setFaultMode(v=>!v)}>
            <Text style={[s.btnTxt,faultMode&&{color:C.fault}]}>⚠ FAULT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={()=>setShowSymptoms(true)}>
            <Text style={s.btnTxt}>🔍 DIAGNOSE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={()=>setShowCfg(true)}>
            <Text style={s.btnTxt}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.legend}>
        {[[C.ht,'HT'],[C.earth,'Earth'],[C.ht,'HT Br'],[C.earth,'E Br'],[C.fault,'Fault'],[C.suspect,'Suspect']].map(([c,l])=>(
          <View key={l as string} style={s.legItem}>
            <View style={[s.legDot,{backgroundColor:c as string}]}/>
            <Text style={s.legTxt}>{l}</Text>
          </View>
        ))}
      </View>
      {faultMode&&(
        <View style={s.faultBar}>
          <Text style={s.faultBarTxt}>⚠ TAP bridge / strand / post → faulty → suspect → clear</Text>
          {faults.length>0&&<TouchableOpacity onPress={()=>setFaults([])}><Text style={s.clearTxt}>Clear all</Text></TouchableOpacity>}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:10}}>
          <Svg width={SW+80} height={svgH+10} style={{marginTop:6}}>{els}</Svg>
        </ScrollView>
      </ScrollView>
      {faults.length>0&&(
        <View style={s.faultPanel}>
          <View>
            {faultCount>0&&<Text style={s.faultTitle}>🔴 {faultCount} FAULT{faultCount>1?'S':''}</Text>}
            {suspectCount>0&&<Text style={s.suspectTitle}>🟡 {suspectCount} SUSPECT</Text>}
          </View>
          <TouchableOpacity style={s.diagBtn} onPress={()=>{setActiveSymptom(null);setShowDiag(true);}}>
            <Text style={s.diagBtnTxt}>▶ DIAGNOSIS</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={s.statsRow}>
        {[['STRANDS',cfg.n],['POSTS',totalPosts],['LENGTH',cfg.len+'m'],['TYPE',cfg.ftype.substring(0,4).toUpperCase()],['GATE',cfg.gate?'YES':'NO']].map(([l,v])=>(
          <View key={l as string} style={s.stat}>
            <Text style={s.statV}>{v}</Text>
            <Text style={s.statL}>{l}</Text>
          </View>
        ))}
      </View>

      <Modal visible={showSymptoms} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>🔍 What is the problem?</Text>
            <Text style={s.modalSub}>Select symptom for step-by-step test procedure:</Text>
            {Object.entries(GUIDES).map(([key,g])=>(
              <TouchableOpacity key={key} style={s.symptomBtn}
                onPress={()=>{setActiveSymptom(key);setShowSymptoms(false);setShowDiag(true);}}>
                <Text style={s.symptomTxt}>▶  {g.title}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.symptomBtn,{borderColor:C.fault,marginTop:4}]}
              onPress={()=>{setShowSymptoms(false);setFaultMode(true);}}>
              <Text style={[s.symptomTxt,{color:C.fault}]}>⚠  I know the fault — let me mark it on the diagram</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={()=>setShowSymptoms(false)}>
              <Text style={s.closeBtnTxt}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDiag} transparent animationType="slide">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox}>
            {activeSymptom&&GUIDES[activeSymptom]?(
              <View>
                <Text style={s.modalTitle}>🔍 {GUIDES[activeSymptom].title}</Text>
                <Text style={s.modalSub}>Follow these steps in order with your multimeter / fence tester:</Text>
                {GUIDES[activeSymptom].steps.map((step,i)=>(
                  <View key={i} style={s.stepBlock}>
                    <Text style={s.stepTxt}>{step}</Text>
                  </View>
                ))}
                <Text style={[s.modalSub,{marginTop:10}]}>Once you find the fault, close this and use ⚠ FAULT mode to mark it on the diagram.</Text>
              </View>
            ):(
              <View>
                <Text style={s.modalTitle}>🔴 Marked Faults</Text>
                {faults.length===0&&<Text style={s.diagTxt}>No faults marked. Use ⚠ FAULT mode to tap components on the diagram.</Text>}
                {faults.map((f,i)=>{
                  const loc=f.type==='strand'?`Strand ${f.si+1} (${f.si%2===0?'HT':'Earth'})`:f.type==='post'?`Post P${f.pi}`:`${f.type==='ht_bridge'?'HT':'Earth'} Bridge @ P${f.pi} S${f.si+1}`;
                  return(<View key={i} style={s.diagBlock}>
                    <Text style={s.diagHead}>{loc}{'  '}<Text style={{color:f.state==='faulty'?C.fault:C.suspect}}>[{f.state.toUpperCase()}]</Text></Text>
                    <Text style={s.diagTxt}>{SYMPTOMS[f.type]}</Text>
                    <Text style={[s.diagTxt,{color:C.suspect,marginTop:6}]}>{'Likely causes:\n'+CAUSES[f.type].map(c=>'  • '+c).join('\n')}</Text>
                  </View>);
                })}
              </View>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={()=>{setShowDiag(false);setActiveSymptom(null);}}>
              <Text style={s.closeBtnTxt}>✓ CLOSE</Text>
            </TouchableOpacity>
            <View style={{height:40}}/>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showCfg} transparent animationType="slide">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox}>
            <Text style={s.modalTitle}>⚙ Fence Configuration</Text>
            {([['Strands',[5,6,7,8,10,12,14,16,18,20,24,28,30],'n'],['Intermediate Posts',[0,1,2,3,4,5,6,8],'posts'],['Length (m)',[10,20,30,50,75,100,150,200],'len']] as [string,number[],keyof Cfg][]).map(([label,opts,key])=>(
              <View key={key} style={s.cfgRow}>
                <Text style={s.cfgLbl}>{label}</Text>
                <View style={s.chipRow}>
                  {opts.map(v=>(
                    <TouchableOpacity key={v} style={[s.chip,cfg[key]===v&&s.chipOn]} onPress={()=>setCfg(c=>({...c,[key]:v}))}>
                      <Text style={[s.chipTxt,cfg[key]===v&&s.chipTxtOn]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <View style={s.cfgRow}>
              <Text style={s.cfgLbl}>Fence Type</Text>
              <View style={s.chipRow}>
                {['Security','Agricultural','Game','Wildlife'].map(t=>(
                  <TouchableOpacity key={t} style={[s.chip,cfg.ftype===t&&s.chipOn]} onPress={()=>setCfg(c=>({...c,ftype:t}))}>
                    <Text style={[s.chipTxt,cfg.ftype===t&&s.chipTxtOn]}>{t.substring(0,5)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.cfgRow}>
              <Text style={s.cfgLbl}>Gate</Text>
              <Switch value={cfg.gate} onValueChange={v=>setCfg(c=>({...c,gate:v}))} trackColor={{true:C.energizer,false:C.border}} thumbColor={cfg.gate?C.energizer:C.muted}/>
            </View>
            {cfg.gate&&cfg.posts>0&&(
              <View style={s.cfgRow}>
                <Text style={s.cfgLbl}>Gate position (after post #)</Text>
                <View style={s.chipRow}>
                  {Array.from({length:cfg.posts},(_,i)=>i+1).map(v=>(
                    <TouchableOpacity key={v} style={[s.chip,cfg.gateAt===v&&s.chipOn]} onPress={()=>setCfg(c=>({...c,gateAt:v}))}>
                      <Text style={[s.chipTxt,cfg.gateAt===v&&s.chipTxtOn]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={()=>setShowCfg(false)}>
              <Text style={s.closeBtnTxt}>✓ APPLY</Text>
            </TouchableOpacity>
            <View style={{height:40}}/>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0d1219'},
  topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,paddingTop:10,paddingBottom:6,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  title:{color:'#f59e0b',fontSize:15,fontWeight:'900',letterSpacing:1.5},
  sub:{color:'#64748b',fontSize:9,letterSpacing:0.8},
  topBtns:{flexDirection:'row',gap:6},
  btn:{paddingHorizontal:8,paddingVertical:5,borderRadius:7,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#111827'},
  btnFault:{borderColor:'#f97316'},
  btnTxt:{color:'#e2e8f0',fontSize:9,fontWeight:'700'},
  legend:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:12,paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  legItem:{flexDirection:'row',alignItems:'center',gap:3},
  legDot:{width:7,height:7,borderRadius:3.5},
  legTxt:{color:'#64748b',fontSize:8},
  faultBar:{backgroundColor:'#2d1010',borderBottomWidth:1,borderBottomColor:'#f97316',paddingHorizontal:12,paddingVertical:5,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  faultBarTxt:{color:'#f97316',fontSize:9,fontWeight:'700',flex:1},
  clearTxt:{color:'#64748b',fontSize:9,textDecorationLine:'underline',marginLeft:8},
  faultPanel:{backgroundColor:'#1a0d0d',borderTopWidth:1,borderTopColor:'#f97316',padding:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  faultTitle:{color:'#f97316',fontSize:12,fontWeight:'800'},
  suspectTitle:{color:'#fbbf24',fontSize:11,fontWeight:'700'},
  diagBtn:{backgroundColor:'#f97316',borderRadius:6,paddingVertical:5,paddingHorizontal:12},
  diagBtnTxt:{color:'#fff',fontSize:10,fontWeight:'800'},
  statsRow:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#1e293b',backgroundColor:'#111827'},
  stat:{flex:1,alignItems:'center',paddingVertical:7},
  statV:{color:'#f59e0b',fontSize:12,fontWeight:'800'},
  statL:{color:'#64748b',fontSize:7,letterSpacing:0.5,marginTop:1},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.9)',justifyContent:'flex-end'},
  modalBox:{backgroundColor:'#111827',borderTopLeftRadius:18,borderTopRightRadius:18,padding:18,maxHeight:'88%'},
  modalTitle:{color:'#f59e0b',fontSize:14,fontWeight:'900',marginBottom:6,letterSpacing:0.8},
  modalSub:{color:'#64748b',fontSize:10,marginBottom:12,lineHeight:15},
  symptomBtn:{padding:14,borderRadius:10,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#0d1219',marginBottom:8},
  symptomTxt:{color:'#e2e8f0',fontSize:12,fontWeight:'700'},
  stepBlock:{backgroundColor:'#0d1219',borderRadius:8,borderLeftWidth:3,borderLeftColor:'#f59e0b',padding:10,marginBottom:8},
  stepTxt:{color:'#e2e8f0',fontSize:11,lineHeight:17},
  cfgRow:{marginBottom:12},
  cfgLbl:{color:'#64748b',fontSize:9,letterSpacing:0.5,marginBottom:5,textTransform:'uppercase'},
  chipRow:{flexDirection:'row',flexWrap:'wrap',gap:5},
  chip:{paddingHorizontal:9,paddingVertical:4,borderRadius:5,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#0d1219'},
  chipOn:{borderColor:'#f59e0b',backgroundColor:'#1c1600'},
  chipTxt:{color:'#64748b',fontSize:11,fontWeight:'600'},
  chipTxtOn:{color:'#f59e0b'},
  diagBlock:{marginBottom:12,padding:10,backgroundColor:'#1a0d0d',borderRadius:8,borderLeftWidth:3,borderLeftColor:'#f97316'},
  diagHead:{color:'#e2e8f0',fontSize:11,fontWeight:'800',marginBottom:4},
  diagTxt:{color:'#64748b',fontSize:10,lineHeight:15},
  closeBtn:{marginTop:14,backgroundColor:'#f59e0b',borderRadius:8,paddingVertical:11,alignItems:'center'},
  closeBtnTxt:{color:'#000',fontSize:13,fontWeight:'900',letterSpacing:0.8},
});
