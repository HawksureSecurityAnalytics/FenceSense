import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal, Switch } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText, G, Path } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');
const C = {
  bg:'#0d1219',panel:'#111827',border:'#1e293b',
  ht:'#ef4444',earth:'#22c55e',post:'#94a3b8',
  energizer:'#f59e0b',spike:'#78716c',gate:'#f59e0b',
  fault:'#ff6b00',warn:'#fbbf24',text:'#e2e8f0',muted:'#64748b',
};
const STRAND_GAP=14,POST_EXTRA_TOP=20,POST_EXTRA_BOT=24,BRIDGE_REACH=14,SPIKE_H=28,MARGIN_L=48,MARGIN_R=20;
const FAULT_SYMPTOMS={
  ht_bridge:'Alarm triggers beyond this bridge. Shock reduced on remaining strands. Check HT bridge clip and insulator.',
  earth_bridge:'Earth continuity broken. Energizer voltage drops significantly. Animals may not receive shock. Check earth bridge clip.',
  strand:'Loss of continuity on this strand. Zone alarm may trigger constantly. Check for broken wire, vegetation contact, or corrosion.',
  post:'All bridges on this post affected. Multiple zone faults likely. Check post insulators and all bridge clips at this post.',
};
const FAULT_CAUSES={
  ht_bridge:['Corroded clip','Broken insulator','Wire slipped off clip','Vandalism/tampering'],
  earth_bridge:['Corroded clip','Wet insulator (short circuit risk)','Wire slipped off clip'],
  strand:['Vegetation touching wire','Animal break','Wire fatigue crack','Corrosion at join point'],
  post:['Post knocked over','All insulators cracked','Lightning strike damage'],
};

type FaultState='ok'|'faulty'|'suspect';
type FaultType='ht_bridge'|'earth_bridge'|'strand'|'post';
interface Fault{postIdx:number;strandIdx:number;type:FaultType;state:FaultState;}
interface Config{strands:number;posts:number;lengthM:number;hasGate:boolean;gateAfter:number;fenceType:string;}

export default function FenceSchematic(){
  const[cfg,setCfg]=useState<Config>({strands:8,posts:2,lengthM:50,hasGate:false,gateAfter:1,fenceType:'Security'});
  const[faults,setFaults]=useState<Fault[]>([]);
  const[faultMode,setFaultMode]=useState(false);
  const[showCfg,setShowCfg]=useState(false);
  const[showDiag,setShowDiag]=useState(false);

  const totalPosts=cfg.posts+2;
  const usableW=SW-MARGIN_L-MARGIN_R-60;
  const postSpacing=usableW/(totalPosts-1);
  const strandAreaH=(cfg.strands-1)*STRAND_GAP;
  const postH=POST_EXTRA_TOP+strandAreaH+POST_EXTRA_BOT;
  const svgH=postH+SPIKE_H+70;
  const postTop=POST_EXTRA_TOP;
  const postBot=POST_EXTRA_TOP+strandAreaH+POST_EXTRA_BOT;
  const strandY=(i:number)=>POST_EXTRA_TOP+POST_EXTRA_BOT/2+i*STRAND_GAP;
  const postX=(i:number)=>MARGIN_L+i*postSpacing;

  const getFault=useCallback((pi:number,si:number,t:FaultType):FaultState=>{
    return faults.find(f=>f.postIdx===pi&&f.strandIdx===si&&f.type===t)?.state??'ok';
  },[faults]);

  const tap=(pi:number,si:number,t:FaultType)=>{
    if(!faultMode)return;
    setFaults(prev=>{
      const ex=prev.find(f=>f.postIdx===pi&&f.strandIdx===si&&f.type===t);
      if(!ex)return[...prev,{postIdx:pi,strandIdx:si,type:t,state:'faulty'}];
      if(ex.state==='faulty')return prev.map(f=>f===ex?{...f,state:'suspect'}:f);
      return prev.filter(f=>f!==ex);
    });
  };

  const fc=(state:FaultState,def:string)=>state==='faulty'?C.fault:state==='suspect'?C.warn:def;

  const renderBridge=(pxi:number,iA:number,iB:number,isHT:boolean,side:'L'|'R')=>{
    const px=postX(pxi);
    const yA=strandY(iA),yB=strandY(iB);
    const col=isHT?C.ht:C.earth;
    const t:FaultType=isHT?'ht_bridge':'earth_bridge';
    const reach=isHT?BRIDGE_REACH:BRIDGE_REACH+6;
    const dir=side==='L'?-1:1;
    const capX=px+dir*reach;
    const state=getFault(pxi,iA,t);
    const color=fc(state,col);
    const sw=state!=='ok'?3:2;
    return(
      <G key={"br"+pxi+iA+isHT} onPress={()=>tap(pxi,iA,t)}>
        <Rect x={Math.min(px,capX)-6} y={yA-6} width={Math.abs(capX-px)+12} height={yB-yA+12} fill="transparent"/>
        <Line x1={px} y1={yA} x2={capX} y2={yA} stroke={color} strokeWidth={sw} strokeLinecap="round"/>
        <Line x1={capX} y1={yA} x2={capX} y2={yB} stroke={color} strokeWidth={sw} strokeLinecap="round"/>
        <Line x1={capX} y1={yB} x2={px} y2={yB} stroke={color} strokeWidth={sw} strokeLinecap="round"/>
        {state!=='ok'&&<Circle cx={capX} cy={(yA+yB)/2} r={4} fill={color}/>}
      </G>
    );
  };

  const renderPostBridges=(pxi:number)=>{
    const htIdx=Array.from({length:cfg.strands},(_,i)=>i).filter(i=>i%2===0);
    const eIdx=Array.from({length:cfg.strands},(_,i)=>i).filter(i=>i%2===1);
    const isLeft=pxi===0,isRight=pxi===totalPosts-1;
    const els:any[]=[];
    const side=isLeft?'L':(isRight?'R':'L');
    for(let k=0;k<htIdx.length-1;k+=2)
      els.push(renderBridge(pxi,htIdx[k],htIdx[k+1],true,isLeft?'L':isRight?'R':'L'));
    if(!isLeft&&!isRight)
      for(let k=0;k<htIdx.length-1;k+=2)
        els.push(renderBridge(pxi,htIdx[k],htIdx[k+1],true,'R'));
    for(let k=0;k<eIdx.length-1;k+=2)
      els.push(renderBridge(pxi,eIdx[k],eIdx[k+1],false,isLeft?'L':isRight?'R':'R'));
    return els;
  };

  const els:any[]=[];

  // Strands
  for(let i=0;i<cfg.strands;i++){
    const y=strandY(i);
    const isHT=i%2===0;
    const col=isHT?C.ht:C.earth;
    const state=getFault(99,i,'strand');
    const color=fc(state,col);
    els.push(
      <G key={"s"+i} onPress={()=>tap(99,i,'strand')}>
        <Line x1={postX(0)} y1={y} x2={postX(totalPosts-1)} y2={y}
          stroke={color} strokeWidth={state!=='ok'?2.5:1.8}
          strokeDasharray={state==='faulty'?'6,4':undefined} strokeLinecap="round"/>
        <SvgText x={MARGIN_L-8} y={y+4} fill={color} fontSize={8} textAnchor="end" fontWeight="bold">{i+1}</SvgText>
        <SvgText x={MARGIN_L-22} y={y+4} fill={color} fontSize={7} textAnchor="end" opacity={0.6}>{isHT?'HT':'E'}</SvgText>
      </G>
    );
  }

  // Posts
  for(let p=0;p<totalPosts;p++){
    const px=postX(p);
    const isEnd=p===0||p===totalPosts-1;
    const state=getFault(p,0,'post');
    const color=fc(state,C.post);
    els.push(
      <G key={"p"+p} onPress={()=>tap(p,0,'post')}>
        <Line x1={px} y1={postTop} x2={px} y2={postBot}
          stroke={color} strokeWidth={isEnd?10:8} strokeLinecap="round" opacity={0.9}/>
        <Rect x={px-7} y={postBot-4} width={14} height={8} fill={color} rx={2} opacity={0.7}/>
        <SvgText x={px} y={postTop-6} fill={color} fontSize={7} textAnchor="middle" opacity={0.7}>
          {p===0?'END L':p===totalPosts-1?'END R':'P'+p}
        </SvgText>
        {state!=='ok'&&<Circle cx={px} cy={postTop-14} r={5} fill={color}/>}
      </G>
    );
  }

  // Bridges at all posts
  for(let p=0;p<totalPosts;p++)els.push(...renderPostBridges(p));

  // Energizer
  const eW=52,eH=40;
  const ex=postX(0)-eW-14;
  const ey=strandY(0)-eH/2;
  const liveY=ey+eH*0.3,retY=ey+eH*0.7;
  els.push(
    <G key="enrg">
      <Rect x={ex} y={ey} width={eW} height={eH} fill="#1a1200" stroke={C.energizer} strokeWidth={2} rx={5}/>
      <SvgText x={ex+eW/2} y={ey+eH/2-3} fill={C.energizer} fontSize={11} textAnchor="middle">⚡</SvgText>
      <SvgText x={ex+eW/2} y={ey+eH/2+9} fill={C.energizer} fontSize={6} textAnchor="middle" fontWeight="bold">ENRGZR</SvgText>
      <SvgText x={ex+eW+3} y={liveY+4} fill={C.ht} fontSize={10} fontWeight="bold">+</SvgText>
      <Line x1={ex+eW} y1={liveY} x2={postX(0)} y2={strandY(0)} stroke={C.ht} strokeWidth={1.5} strokeDasharray="4,3"/>
      <SvgText x={ex+eW+3} y={retY+4} fill={C.earth} fontSize={10} fontWeight="bold">–</SvgText>
      <Line x1={ex+eW} y1={retY} x2={postX(0)} y2={strandY(cfg.strands-1)} stroke={C.earth} strokeWidth={1.5} strokeDasharray="4,3"/>
      <Line x1={ex+eW/2} y1={ey+eH} x2={ex+eW/2} y2={postBot+8} stroke={C.earth} strokeWidth={1.5}/>
      {[-16,0,16].map((off,i)=>{
        const sx=ex+eW/2+off,sy=postBot+8;
        return(<G key={"sp"+i}>
          <Line x1={sx} y1={sy} x2={sx} y2={sy+SPIKE_H} stroke={C.spike} strokeWidth={2.5} strokeLinecap="round"/>
          <Line x1={sx-5} y1={sy+8} x2={sx+5} y2={sy+8} stroke={C.spike} strokeWidth={1.5}/>
          <Line x1={sx-3} y1={sy+15} x2={sx+3} y2={sy+15} stroke={C.spike} strokeWidth={1.5}/>
          <SvgText x={sx} y={sy+SPIKE_H+10} fill={C.muted} fontSize={6} textAnchor="middle">GND</SvgText>
        </G>);
      })}
    </G>
  );

  // Gate bypass
  if(cfg.hasGate&&cfg.gateAfter<totalPosts-1){
    const gp1=postX(cfg.gateAfter),gp2=postX(cfg.gateAfter+1);
    const byY=postBot+20;
    els.push(
      <G key="gate">
        <Path d={"M "+gp1+" "+strandY(0)+" L "+gp1+" "+byY+" L "+gp2+" "+byY+" L "+gp2+" "+strandY(0)}
          stroke={C.ht} strokeWidth={2} fill="none" strokeDasharray="5,3" strokeLinecap="round"/>
        <Path d={"M "+gp1+" "+strandY(cfg.strands-1)+" L "+gp1+" "+(byY+12)+" L "+gp2+" "+(byY+12)+" L "+gp2+" "+strandY(cfg.strands-1)}
          stroke={C.earth} strokeWidth={2} fill="none" strokeDasharray="5,3" strokeLinecap="round"/>
        <Rect x={(gp1+gp2)/2-16} y={byY-8} width={32} height={14} fill="#1a1200" stroke={C.gate} strokeWidth={1} rx={3}/>
        <SvgText x={(gp1+gp2)/2} y={byY+2} fill={C.gate} fontSize={7} textAnchor="middle" fontWeight="bold">GATE</SvgText>
      </G>
    );
  }

  // Dimension line
  const dimY=postBot+(cfg.hasGate?50:12);
  els.push(
    <G key="dim">
      <Line x1={postX(0)} y1={dimY} x2={postX(totalPosts-1)} y2={dimY} stroke={C.muted} strokeWidth={0.8}/>
      <Line x1={postX(0)} y1={dimY-4} x2={postX(0)} y2={dimY+4} stroke={C.muted} strokeWidth={1.2}/>
      <Line x1={postX(totalPosts-1)} y1={dimY-4} x2={postX(totalPosts-1)} y2={dimY+4} stroke={C.muted} strokeWidth={1.2}/>
      <SvgText x={(postX(0)+postX(totalPosts-1))/2} y={dimY+11} fill={C.muted} fontSize={8} textAnchor="middle">{cfg.lengthM}m</SvgText>
    </G>
  );

  const faultCount=faults.filter(f=>f.state==='faulty').length;
  const suspectCount=faults.filter(f=>f.state==='suspect').length;

  return(
    <View style={s.root}>
      <View style={s.topBar}>
        <View>
          <Text style={s.title}>⚡ FENCESENSE</Text>
          <Text style={s.sub}>{cfg.fenceType.toUpperCase()} · {cfg.strands} STRANDS · {cfg.lengthM}m</Text>
        </View>
        <View style={s.topBtns}>
          <TouchableOpacity style={[s.btn,faultMode&&s.btnFault]} onPress={()=>setFaultMode(v=>!v)}>
            <Text style={[s.btnTxt,faultMode&&{color:C.fault}]}>⚠ FAULT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={()=>setShowCfg(true)}>
            <Text style={s.btnTxt}>⚙ CONFIG</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.legend}>
        {[[C.ht,'HT'],[C.earth,'Earth'],[C.ht,'HT Bridge'],[C.earth,'E Bridge'],[C.fault,'Fault'],[C.warn,'Suspect']].map(([col,lbl])=>(
          <View key={lbl as string} style={s.legItem}>
            <View style={[s.legDot,{backgroundColor:col as string}]}/>
            <Text style={s.legTxt}>{lbl}</Text>
          </View>
        ))}
      </View>

      {faultMode&&(
        <View style={s.faultBar}>
          <Text style={s.faultBarTxt}>⚠ Tap any bridge, strand or post to mark faulty → suspect → clear</Text>
          {faults.length>0&&<TouchableOpacity onPress={()=>setFaults([])}><Text style={s.clearTxt}>Clear</Text></TouchableOpacity>}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Svg width={SW+60} height={svgH+10} style={{marginTop:6}}>{els}</Svg>
        </ScrollView>
      </ScrollView>

      {faultMode&&faults.length>0&&(
        <View style={s.faultPanel}>
          <Text style={s.faultPanelTitle}>
            {faultCount>0?'🔴 '+faultCount+' FAULT'+(faultCount>1?'S':''):''}{suspectCount>0?'  🟡 '+suspectCount+' SUSPECT':''}
          </Text>
          <TouchableOpacity style={s.diagBtn} onPress={()=>setShowDiag(true)}>
            <Text style={s.diagBtnTxt}>▶ VIEW DIAGNOSIS</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.statsRow}>
        {[['STRANDS',cfg.strands],['POSTS',totalPosts],['LENGTH',cfg.lengthM+'m'],['TYPE',cfg.fenceType.substring(0,4).toUpperCase()],['GATE',cfg.hasGate?'YES':'NO']].map(([l,v])=>(
          <View key={l as string} style={s.stat}>
            <Text style={s.statVal}>{v}</Text>
            <Text style={s.statLbl}>{l}</Text>
          </View>
        ))}
      </View>

      {/* CONFIG MODAL */}
      <Modal visible={showCfg} transparent animationType="slide">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox}>
            <Text style={s.modalTitle}>⚙ Fence Configuration</Text>
            {([
              ['Strands',[5,7,8,10,12,14,16,18,20,24,28,30],'strands'],
              ['Intermediate Posts',[0,1,2,3,4,5,6,8],'posts'],
              ['Length (m)',[10,20,30,50,75,100,150,200],'lengthM'],
            ] as [string,number[],keyof Config][]).map(([label,opts,key])=>(
              <View key={key} style={s.cfgRow}>
                <Text style={s.cfgLbl}>{label}</Text>
                <View style={s.chipRow}>
                  {opts.map(v=>(
                    <TouchableOpacity key={v} style={[s.chip,cfg[key]===v&&s.chipOn]}
                      onPress={()=>setCfg(c=>({...c,[key]:v}))}>
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
                  <TouchableOpacity key={t} style={[s.chip,cfg.fenceType===t&&s.chipOn]}
                    onPress={()=>setCfg(c=>({...c,fenceType:t}))}>
                    <Text style={[s.chipTxt,cfg.fenceType===t&&s.chipTxtOn]}>{t.substring(0,5)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.cfgRow}>
              <Text style={s.cfgLbl}>Gate</Text>
              <Switch value={cfg.hasGate} onValueChange={v=>setCfg(c=>({...c,hasGate:v}))}
                trackColor={{true:C.energizer,false:C.border}} thumbColor={cfg.hasGate?C.energizer:C.muted}/>
            </View>
            {cfg.hasGate&&cfg.posts>0&&(
              <View style={s.cfgRow}>
                <Text style={s.cfgLbl}>Gate position (after post #)</Text>
                <View style={s.chipRow}>
                  {Array.from({length:cfg.posts},(_,i)=>i+1).map(v=>(
                    <TouchableOpacity key={v} style={[s.chip,cfg.gateAfter===v&&s.chipOn]}
                      onPress={()=>setCfg(c=>({...c,gateAfter:v}))}>
                      <Text style={[s.chipTxt,cfg.gateAfter===v&&s.chipTxtOn]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity style={s.applyBtn} onPress={()=>setShowCfg(false)}>
              <Text style={s.applyBtnTxt}>✓ APPLY</Text>
            </TouchableOpacity>
            <View style={{height:30}}/>
          </ScrollView>
        </View>
      </Modal>

      {/* DIAGNOSIS MODAL */}
      <Modal visible={showDiag} transparent animationType="fade">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox}>
            <Text style={s.modalTitle}>🔴 Fault Diagnosis</Text>
            {faults.length===0
              ?<Text style={s.diagTxt}>No faults marked.</Text>
              :faults.map((f,i)=>{
                const loc=f.type==='strand'?'Strand '+(f.strandIdx+1)+' ('+(f.strandIdx%2===0?'HT':'Earth')+')'
                  :f.type==='post'?'Post P'+f.postIdx
                  :(f.type==='ht_bridge'?'HT':'Earth')+' Bridge @ Post P'+f.postIdx+' Str '+(f.strandIdx+1);
                return(
                  <View key={i} style={s.diagBlock}>
                    <Text style={s.diagHead}>{loc}  <Text style={{color:f.state==='faulty'?C.fault:C.warn}}>[{f.state.toUpperCase()}]</Text></Text>
                    <Text style={s.diagTxt}>📋 {FAULT_SYMPTOMS[f.type]}</Text>
                    <Text style={[s.diagTxt,{color:C.warn,marginTop:6}]}>
                      {'⚠ Likely causes:\n'+FAULT_CAUSES[f.type].map(c=>'  • '+c).join('\n')}
                    </Text>
                  </View>
                );
              })
            }
            <TouchableOpacity style={s.applyBtn} onPress={()=>setShowDiag(false)}>
              <Text style={s.applyBtnTxt}>✓ CLOSE</Text>
            </TouchableOpacity>
            <View style={{height:30}}/>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0d1219'},
  topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:14,paddingTop:10,paddingBottom:6,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  title:{color:'#f59e0b',fontSize:16,fontWeight:'900',letterSpacing:1.5},
  sub:{color:'#64748b',fontSize:9,letterSpacing:1},
  topBtns:{flexDirection:'row',gap:8},
  btn:{paddingHorizontal:10,paddingVertical:6,borderRadius:8,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#111827'},
  btnFault:{borderColor:'#ff6b00'},
  btnTxt:{color:'#e2e8f0',fontSize:10,fontWeight:'700'},
  legend:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:14,paddingVertical:6,borderBottomWidth:1,borderBottomColor:'#1e293b'},
  legItem:{flexDirection:'row',alignItems:'center',gap:4},
  legDot:{width:8,height:8,borderRadius:4},
  legTxt:{color:'#64748b',fontSize:9},
  faultBar:{backgroundColor:'#2d1010',borderBottomWidth:1,borderBottomColor:'#ff6b00',paddingHorizontal:14,paddingVertical:6,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  faultBarTxt:{color:'#ff6b00',fontSize:9,fontWeight:'700',flex:1},
  clearTxt:{color:'#64748b',fontSize:9,textDecorationLine:'underline'},
  faultPanel:{backgroundColor:'#1a0d0d',borderTopWidth:1,borderTopColor:'#ff6b00',padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  faultPanelTitle:{color:'#ff6b00',fontSize:12,fontWeight:'800'},
  diagBtn:{backgroundColor:'#ff6b00',borderRadius:6,paddingVertical:6,paddingHorizontal:14},
  diagBtnTxt:{color:'#fff',fontSize:10,fontWeight:'800'},
  statsRow:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#1e293b',backgroundColor:'#111827'},
  stat:{flex:1,alignItems:'center',paddingVertical:8},
  statVal:{color:'#f59e0b',fontSize:13,fontWeight:'800'},
  statLbl:{color:'#64748b',fontSize:7,letterSpacing:0.5,marginTop:1},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.88)',justifyContent:'flex-end'},
  modalBox:{backgroundColor:'#111827',borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,maxHeight:'88%'},
  modalTitle:{color:'#f59e0b',fontSize:14,fontWeight:'900',marginBottom:16,letterSpacing:1},
  cfgRow:{marginBottom:14},
  cfgLbl:{color:'#64748b',fontSize:10,letterSpacing:0.5,marginBottom:6,textTransform:'uppercase'},
  chipRow:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{paddingHorizontal:10,paddingVertical:5,borderRadius:6,borderWidth:1,borderColor:'#1e293b',backgroundColor:'#0d1219'},
  chipOn:{borderColor:'#f59e0b',backgroundColor:'#1a1200'},
  chipTxt:{color:'#64748b',fontSize:11,fontWeight:'600'},
  chipTxtOn:{color:'#f59e0b'},
  applyBtn:{marginTop:16,backgroundColor:'#f59e0b',borderRadius:8,paddingVertical:12,alignItems:'center'},
  applyBtnTxt:{color:'#000',fontSize:13,fontWeight:'900',letterSpacing:1},
  diagBlock:{marginBottom:14,padding:10,backgroundColor:'#1a0d0d',borderRadius:8,borderLeftWidth:3,borderLeftColor:'#ff6b00'},
  diagHead:{color:'#e2e8f0',fontSize:11,fontWeight:'800',marginBottom:4},
  diagTxt:{color:'#64748b',fontSize:10,lineHeight:15},
});
