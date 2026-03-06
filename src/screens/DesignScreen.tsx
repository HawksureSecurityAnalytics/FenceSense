import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Animated, Dimensions, Alert, StatusBar, Platform,
} from 'react-native';
import { FenceNode, FenceWire, CanvasState, ComponentType, WireType, FenceType, FenceProject } from '../types';
import { colors, spacing, radius, WIRE_COLORS } from '../theme';
import { validateFence } from '../engine/validator';
import { scheduleAutoSave } from '../storage/projects';
import FenceCanvas from '../components/FenceCanvas';

const { height: SH } = Dimensions.get('window');
const SNAP = 24;
const STATUS_H = Platform.OS==='android' ? (StatusBar.currentHeight||0) : 0;
const TOP_BAR_H = 48;
const BOTTOM_BAR_H = 148;
const CANVAS_H = SH - STATUS_H - TOP_BAR_H - BOTTOM_BAR_H;

const FENCE_TYPES: {key:FenceType;label:string}[] = [
  {key:'agricultural',label:'Agri'},
  {key:'security',    label:'Sec'},
  {key:'game',        label:'Game'},
  {key:'wildlife',    label:'Wild'},
];

const WIRE_TYPES: {key:WireType;label:string;color:string}[] = [
  {key:'hot',          label:'HT',    color:colors.hot},
  {key:'earth',        label:'Earth', color:colors.earth},
  {key:'bridge_hot',   label:'HT Br', color:colors.bridgeHot},
  {key:'bridge_earth', label:'E Br',  color:colors.bridgeEarth},
];

const STRAND_OPTIONS = [1,3,5,7,12];

const COMPONENTS: {key:ComponentType;label:string;sub:string;color:string}[] = [
  {key:'energizer',   label:'Energizer',   sub:'Power source',  color:colors.amber},
  {key:'earth_spike', label:'Earth Spike', sub:'Ground rod',    color:'#78716c'},
  {key:'gate',        label:'Gate',        sub:'With contacts', color:colors.warn},
  {key:'post',        label:'Line Post',   sub:'Standard',      color:'#6b7280'},
  {key:'corner',      label:'Corner Post', sub:'Strainer',      color:'#94a3b8'},
];

interface Props {
  project: FenceProject;
  onProjectUpdate: (p: FenceProject) => void;
}

export default function DesignScreen({ project, onProjectUpdate }: Props) {
  const [nodes, setNodes] = useState<FenceNode[]>(project.nodes);
  const [wires, setWires] = useState<FenceWire[]>(project.wires);
  const [fenceType, setFT] = useState<FenceType>(project.fenceType);
  const [canvasState, setCS] = useState<CanvasState>({
    tool:'pan', wireMode:'hot', strandCount:3,
    pendingComponent:null, selectedNodeId:null, selectedWireId:null,
    wireStart:null, pan:{x:20,y:20}, scale:1,
  });
  const [validationResult, setVR] = useState<any>(null);
  const [showValidation, setShowV] = useState(false);
  const [showComponents, setShowC] = useState(false);
  const [highlightIds, setHL] = useState<string[]>([]);
  const valAnim = useRef(new Animated.Value(0)).current;
  const nodesRef = useRef(nodes);
  const wiresRef = useRef(wires);
  nodesRef.current = nodes;
  wiresRef.current = wires;

  const sync = useCallback((n:FenceNode[], w:FenceWire[], ft:FenceType) => {
    const updated = {...project,nodes:n,wires:w,fenceType:ft,updatedAt:Date.now()};
    scheduleAutoSave(updated);
    onProjectUpdate(updated);
  },[project,onProjectUpdate]);

  const handlePlaceNode = useCallback((type:ComponentType, x:number, y:number) => {
    const def = COMPONENTS.find(c=>c.key===type);
    const count = nodesRef.current.filter(n=>n.type===type).length+1;
    const node: FenceNode = {
      id:`n_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      type, x, y, label:`${def?.label||type} ${count}`,
    };
    const next = [...nodesRef.current, node];
    setNodes(next); sync(next, wiresRef.current, fenceType);
  },[fenceType,sync]);

  const handleWireDraw = useCallback((x1:number,y1:number,x2:number,y2:number) => {
    const {wireMode, strandCount} = canvasState;
    const len = Math.round(Math.hypot(x2-x1,y2-y1)/SNAP*2);
    const wire: FenceWire = {
      id:`w_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      type:wireMode, x1, y1, x2, y2,
      lengthMeters:len,
      strandCount: wireMode==='hot'||wireMode==='earth' ? strandCount : 1,
    };
    const next = [...wiresRef.current, wire];
    setWires(next); sync(nodesRef.current, next, fenceType);
  },[canvasState, fenceType, sync]);

  const handleMoveNode = useCallback((id:string,x:number,y:number) => {
    setNodes(prev=>{
      const node = prev.find(n=>n.id===id);
      const updated = prev.map(n=>n.id===id?{...n,x,y}:n);
      if (node) {
        setWires(pw=>pw.map(w=>{
          const near=(a:number,b:number)=>Math.abs(a-b)<40;
          if (near(w.x1,node.x)&&near(w.y1,node.y)) return {...w,x1:x,y1:y};
          if (near(w.x2,node.x)&&near(w.y2,node.y)) return {...w,x2:x,y2:y};
          return w;
        }));
      }
      return updated;
    });
  },[]);

  const handleDeleteNode = useCallback((id:string)=>{
    const next = nodesRef.current.filter(n=>n.id!==id);
    setNodes(next); sync(next,wiresRef.current,fenceType);
    setCS(p=>({...p,selectedNodeId:null}));
  },[fenceType,sync]);

  const handleDeleteWire = useCallback((id:string)=>{
    const next = wiresRef.current.filter(w=>w.id!==id);
    setWires(next); sync(nodesRef.current,next,fenceType);
    setCS(p=>({...p,selectedWireId:null}));
  },[fenceType,sync]);

  const handlePan = useCallback((dx:number,dy:number)=>{
    setCS(p=>({...p,pan:{x:p.pan.x+dx,y:p.pan.y+dy}}));
  },[]);

  const handleZoom = useCallback((zd:number,cx:number,cy:number)=>{
    setCS(p=>{
      const nz=Math.max(0.3,Math.min(4,p.scale*zd));
      return {...p,scale:nz,pan:{x:cx-(cx-p.pan.x)*(nz/p.scale),y:cy-(cy-p.pan.y)*(nz/p.scale)}};
    });
  },[]);

  const setTool = (tool:CanvasState['tool'])=>
    setCS(p=>({...p,tool,pendingComponent:null}));

  const setWireMode = (wireMode:WireType)=>
    setCS(p=>({...p,wireMode,tool:'wire'}));

  const setStrandCount = (strandCount:number)=>
    setCS(p=>({...p,strandCount,tool:'wire'}));

  const pickComponent = (type:ComponentType)=>{
    setCS(p=>({...p,pendingComponent:type,tool:'place'}));
    setShowC(false);
  };

  const runValidation = ()=>{
    const result = validateFence(nodes,wires,fenceType);
    setVR(result);
    setHL(result.issues.flatMap((i:any)=>i.affectedIds||[]));
    setShowV(true);
    Animated.spring(valAnim,{toValue:1,useNativeDriver:true,tension:80,friction:12}).start();
  };

  const closeValidation = ()=>{
    Animated.timing(valAnim,{toValue:0,duration:200,useNativeDriver:true}).start(()=>{
      setShowV(false); setHL([]);
    });
  };

  const clearAll = ()=>Alert.alert('Clear Canvas','Remove all?',[
    {text:'Cancel',style:'cancel'},
    {text:'Clear',style:'destructive',onPress:()=>{
      setNodes([]); setWires([]); setVR(null); sync([],[],fenceType);
    }},
  ]);

  const htLength = wires.filter(w=>w.type==='hot').reduce((s,w)=>s+(w.lengthMeters||0),0);
  const scoreColor = validationResult
    ? validationResult.score>=80?colors.ok:validationResult.score>=50?colors.warn:colors.danger
    : colors.textDim;

  const isWireTool = canvasState.tool==='wire';
  const activeWireColor = WIRE_COLORS[canvasState.wireMode];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPanel}/>

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>⚡ FENCESENSE</Text>
        <View style={styles.topRight}>
          {FENCE_TYPES.map(ft=>(
            <TouchableOpacity key={ft.key}
              style={[styles.typeBtn,fenceType===ft.key&&styles.typeBtnOn]}
              onPress={()=>{setFT(ft.key);sync(nodes,wires,ft.key);}}>
              <Text style={[styles.typeTxt,fenceType===ft.key&&{color:colors.amber}]}>{ft.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.valBtn} onPress={runValidation}>
            <Text style={styles.valTxt}>✓ VAL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CANVAS */}
      <View style={{position:'relative'}}>
        <FenceCanvas
          nodes={nodes} wires={wires} canvasState={canvasState}
          onPlaceNode={handlePlaceNode}
          onWireDraw={handleWireDraw}
          onSelectNode={id=>setCS(p=>({...p,selectedNodeId:id,selectedWireId:null}))}
          onSelectWire={id=>setCS(p=>({...p,selectedWireId:id,selectedNodeId:null}))}
          onMoveNode={handleMoveNode}
          onDeleteNode={handleDeleteNode}
          onDeleteWire={handleDeleteWire}
          onPan={handlePan} onZoom={handleZoom}
          highlightIds={highlightIds} canvasHeight={CANVAS_H}
        />
        {/* Mode pill */}
        <View style={[styles.modePill, isWireTool&&{borderColor:activeWireColor}]}>
          <Text style={[styles.modeTxt, isWireTool&&{color:activeWireColor}]}>
            {isWireTool
              ? `✏ ${canvasState.wireMode.replace('_',' ').toUpperCase()} · ${canvasState.strandCount}S`
              : canvasState.tool==='place'&&canvasState.pendingComponent
              ? `⊕ ${canvasState.pendingComponent.replace('_',' ').toUpperCase()}`
              : canvasState.tool.toUpperCase()}
          </Text>
        </View>
        {validationResult&&(
          <View style={[styles.scoreBadge,{borderColor:scoreColor}]}>
            <Text style={[styles.scoreNum,{color:scoreColor}]}>{validationResult.score}</Text>
            <Text style={styles.scoreLbl}>SCR</Text>
          </View>
        )}
      </View>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>

        {/* Row 1: Tools */}
        <View style={styles.row}>
          {[
            {k:'select',i:'↖',l:'Select'},
            {k:'pan',   i:'✋',l:'Pan'},
            {k:'delete',i:'✕', l:'Delete'},
          ].map(t=>(
            <TouchableOpacity key={t.k}
              style={[styles.toolBtn,canvasState.tool===t.k&&styles.toolBtnOn]}
              onPress={()=>setTool(t.k as any)}>
              <Text style={[styles.toolIcon,canvasState.tool===t.k&&{color:colors.amber}]}>{t.i}</Text>
              <Text style={[styles.toolLbl,canvasState.tool===t.k&&{color:colors.amber}]}>{t.l}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.div}/>

          {/* Wire type buttons */}
          {WIRE_TYPES.map(wt=>(
            <TouchableOpacity key={wt.key}
              style={[styles.wireTypeBtn,{borderColor:wt.color},
                canvasState.wireMode===wt.key&&isWireTool&&{backgroundColor:wt.color+'25'}]}
              onPress={()=>setWireMode(wt.key)}>
              <View style={[styles.wireSwatch,{backgroundColor:wt.color}]}/>
              <Text style={[styles.toolLbl,{color:wt.color}]}>{wt.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.div}/>

          {/* Place + Clear */}
          <TouchableOpacity style={styles.placeBtn} onPress={()=>setShowC(true)}>
            <Text style={styles.placeTxt}>⊕</Text>
            <Text style={[styles.toolLbl,{color:colors.amber}]}>Place</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={clearAll}>
            <Text style={styles.toolIcon}>🗑</Text>
            <Text style={styles.toolLbl}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Strand count (only when wire tool active) + Stats */}
        <View style={styles.row}>
          <Text style={styles.strandLabel}>STRANDS:</Text>
          {STRAND_OPTIONS.map(s=>(
            <TouchableOpacity key={s}
              style={[styles.strandBtn,
                canvasState.strandCount===s&&isWireTool&&{backgroundColor:activeWireColor+'30',borderColor:activeWireColor}]}
              onPress={()=>setStrandCount(s)}>
              <Text style={[styles.strandTxt,
                canvasState.strandCount===s&&isWireTool&&{color:activeWireColor}]}>{s}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.div}/>
          {/* Stats */}
          {[
            {l:'Enrgzr',v:nodes.filter(n=>n.type==='energizer').length},
            {l:'HT',    v:`${htLength}m`},
            {l:'Gates', v:nodes.filter(n=>n.type==='gate').length},
            {l:'Spikes',v:nodes.filter(n=>n.type==='earth_spike').length},
          ].map((s,i)=>(
            <View key={i} style={styles.stat}>
              <Text style={styles.statV}>{s.v}</Text>
              <Text style={styles.statL}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* COMPONENT PICKER */}
      <Modal transparent visible={showComponents} animationType="slide" onRequestClose={()=>setShowC(false)}>
        <TouchableOpacity style={styles.overlay} onPress={()=>setShowC(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>▶ PLACE COMPONENT</Text>
            {COMPONENTS.map(c=>(
              <TouchableOpacity key={c.key} style={styles.compRow} onPress={()=>pickComponent(c.key)}>
                <View style={[styles.compDot,{backgroundColor:c.color}]}/>
                <View style={{flex:1}}>
                  <Text style={styles.compLabel}>{c.label}</Text>
                  <Text style={styles.compSub}>{c.sub}</Text>
                </View>
                <Text style={styles.compArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* VALIDATION PANEL */}
      {showValidation&&validationResult&&(
        <Animated.View style={[styles.valPanel,{
          transform:[{translateY:valAnim.interpolate({inputRange:[0,1],outputRange:[SH,0]})}],
        }]}>
          <View style={styles.valHeader}>
            <View style={[styles.valStatus,{borderColor:validationResult.passed?colors.ok:colors.danger}]}>
              <Text style={styles.valIcon}>{validationResult.passed?'✅':'⛔'}</Text>
              <View style={{flex:1}}>
                <Text style={[styles.valTitle,{color:validationResult.passed?colors.ok:colors.danger}]}>
                  {validationResult.passed?'All Good!':`${validationResult.issues.filter((i:any)=>i.severity==='error').length} Error(s)`}
                </Text>
                <Text style={styles.valSub}>Score: {validationResult.score}/100</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={closeValidation}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:40}}>
            {validationResult.issues.map((issue:any)=>(
              <View key={issue.id} style={[styles.issueCard,
                issue.severity==='error'?styles.issueErr:issue.severity==='warn'?styles.issueWarn:styles.issueOk]}>
                <Text style={styles.issueIcon}>{issue.severity==='error'?'⛔':issue.severity==='warn'?'⚠️':'✅'}</Text>
                <View style={{flex:1}}>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <Text style={styles.issueDetail}>{issue.detail}</Text>
                  {issue.suggestion&&<Text style={styles.issueSug}>→ {issue.suggestion}</Text>}
                </View>
              </View>
            ))}
            {validationResult.recommendations.length>0&&(
              <View style={styles.recsBox}>
                <Text style={styles.recsTitle}>▶ RECOMMENDATIONS</Text>
                {validationResult.recommendations.map((r:string,i:number)=>(
                  <Text key={i} style={styles.recItem}>{r}</Text>
                ))}
              </View>
            )}
            <View style={styles.recsBox}>
              <Text style={styles.recsTitle}>▶ STATS</Text>
              <View style={styles.statsGrid}>
                {[
                  {l:'HT Wire',   v:`${validationResult.stats.htLengthM}m`},
                  {l:'Earth',     v:`${validationResult.stats.earthLengthM}m`},
                  {l:'Energizers',v:validationResult.stats.energizerCount},
                  {l:'Spikes',    v:validationResult.stats.earthSpikeCount},
                  {l:'Gates',     v:validationResult.stats.gateCount},
                  {l:'Est J',     v:`${validationResult.stats.estimatedJoulesNeeded}J`},
                ].map((s,i)=>(
                  <View key={i} style={styles.statCard}>
                    <Text style={styles.statCardV}>{s.v}</Text>
                    <Text style={styles.statCardL}>{s.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg},
  topBar:{height:TOP_BAR_H,backgroundColor:colors.bgPanel,borderBottomWidth:1,
    borderBottomColor:colors.border,flexDirection:'row',alignItems:'center',
    paddingHorizontal:8,marginTop:STATUS_H,justifyContent:'space-between'},
  logo:{fontFamily:'monospace',fontSize:13,fontWeight:'bold',color:colors.amber,letterSpacing:1},
  topRight:{flexDirection:'row',alignItems:'center',gap:4},
  typeBtn:{paddingHorizontal:6,paddingVertical:3,borderRadius:4,borderWidth:1,borderColor:colors.border},
  typeBtnOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  typeTxt:{fontFamily:'monospace',fontSize:9,color:colors.textDim},
  valBtn:{backgroundColor:'rgba(255,68,68,0.15)',borderWidth:1,borderColor:colors.hot,
    borderRadius:4,paddingHorizontal:8,paddingVertical:4},
  valTxt:{fontFamily:'monospace',fontSize:10,color:colors.hot},
  modePill:{position:'absolute',top:8,alignSelf:'center',backgroundColor:'rgba(15,21,32,0.92)',
    borderWidth:1,borderColor:colors.amber,borderRadius:20,paddingHorizontal:12,paddingVertical:3},
  modeTxt:{fontFamily:'monospace',fontSize:9,color:colors.amber,letterSpacing:1},
  scoreBadge:{position:'absolute',top:8,right:10,borderWidth:1,borderRadius:8,
    backgroundColor:colors.bgPanel,paddingHorizontal:8,paddingVertical:4,alignItems:'center'},
  scoreNum:{fontFamily:'monospace',fontSize:16,fontWeight:'bold'},
  scoreLbl:{fontFamily:'monospace',fontSize:6,color:colors.textDim},
  bottomBar:{height:BOTTOM_BAR_H, paddingBottom:12,backgroundColor:colors.bgPanel,borderTopWidth:1,
    borderTopColor:colors.border,paddingHorizontal:4,paddingTop:4,paddingBottom:4,gap:4},
  row:{flexDirection:'row',alignItems:'center',gap:3},
  toolBtn:{alignItems:'center',paddingHorizontal:7,paddingVertical:3,borderRadius:4,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.bgCard},
  toolBtnOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  toolIcon:{fontSize:13,color:colors.textDim},
  toolLbl:{fontFamily:'monospace',fontSize:7,color:colors.textDim,marginTop:1},
  div:{width:1,height:28,backgroundColor:colors.border,marginHorizontal:2},
  wireTypeBtn:{alignItems:'center',paddingHorizontal:6,paddingVertical:3,
    borderRadius:4,borderWidth:1,borderColor:colors.border},
  wireSwatch:{width:18,height:3,borderRadius:2,marginBottom:2},
  placeBtn:{alignItems:'center',paddingHorizontal:7,paddingVertical:3,borderRadius:4,
    borderWidth:1,borderColor:colors.amber,backgroundColor:colors.amberDim},
  placeTxt:{fontSize:14,color:colors.amber},
  strandLabel:{fontFamily:'monospace',fontSize:8,color:colors.textDim,marginRight:2},
  strandBtn:{paddingHorizontal:7,paddingVertical:4,borderRadius:4,borderWidth:1,
    borderColor:colors.border,backgroundColor:colors.bgCard},
  strandTxt:{fontFamily:'monospace',fontSize:11,color:colors.textDim,fontWeight:'bold'},
  stat:{flex:1,backgroundColor:colors.bgCard,borderRadius:4,paddingVertical:3,
    alignItems:'center',borderWidth:1,borderColor:colors.border},
  statV:{fontFamily:'monospace',fontSize:11,color:colors.amber,fontWeight:'bold'},
  statL:{fontFamily:'monospace',fontSize:6,color:colors.textDim},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'},
  sheet:{backgroundColor:colors.bgPanel,borderTopLeftRadius:16,borderTopRightRadius:16,
    padding:16,paddingBottom:32},
  sheetTitle:{fontFamily:'monospace',fontSize:10,color:colors.textDim,letterSpacing:3,marginBottom:12},
  compRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,
    borderBottomWidth:1,borderBottomColor:colors.border},
  compDot:{width:12,height:12,borderRadius:6},
  compLabel:{fontFamily:'monospace',fontSize:13,color:colors.text,fontWeight:'bold'},
  compSub:{fontFamily:'monospace',fontSize:9,color:colors.textDim},
  compArrow:{fontSize:20,color:colors.textDim},
  valPanel:{position:'absolute',bottom:0,left:0,right:0,height:SH*0.78,
    backgroundColor:colors.bgPanel,borderTopLeftRadius:16,borderTopRightRadius:16,
    borderTopWidth:1,borderTopColor:colors.border},
  valHeader:{padding:12,flexDirection:'row',alignItems:'center',gap:8,
    borderBottomWidth:1,borderBottomColor:colors.border},
  valStatus:{flex:1,flexDirection:'row',alignItems:'center',gap:8,
    backgroundColor:colors.bgCard,borderRadius:8,padding:8,borderWidth:1},
  valIcon:{fontSize:20},
  valTitle:{fontFamily:'monospace',fontSize:13,fontWeight:'bold'},
  valSub:{fontFamily:'monospace',fontSize:9,color:colors.textDim,marginTop:1},
  closeBtn:{backgroundColor:colors.bgCard,borderRadius:4,padding:10,
    borderWidth:1,borderColor:colors.border},
  closeTxt:{fontFamily:'monospace',fontSize:14,color:colors.textDim},
  issueCard:{flexDirection:'row',gap:8,margin:8,marginBottom:0,
    borderRadius:8,padding:10,borderWidth:1},
  issueErr:{borderColor:'rgba(239,68,68,0.4)',backgroundColor:'rgba(239,68,68,0.05)'},
  issueWarn:{borderColor:'rgba(245,158,11,0.4)',backgroundColor:'rgba(245,158,11,0.05)'},
  issueOk:{borderColor:'rgba(34,197,94,0.4)',backgroundColor:'rgba(34,197,94,0.05)'},
  issueIcon:{fontSize:14,marginTop:2},
  issueTitle:{fontFamily:'monospace',fontSize:11,color:colors.text,fontWeight:'bold',marginBottom:2},
  issueDetail:{fontSize:11,color:colors.textDim,lineHeight:15,marginBottom:3},
  issueSug:{fontFamily:'monospace',fontSize:10,color:colors.amber},
  recsBox:{margin:8,padding:10,backgroundColor:colors.bgCard,borderRadius:8,
    borderWidth:1,borderColor:colors.border},
  recsTitle:{fontFamily:'monospace',fontSize:8,color:colors.textDim,letterSpacing:3,marginBottom:6},
  recItem:{fontFamily:'monospace',fontSize:10,color:colors.text,marginBottom:4,lineHeight:15},
  statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6},
  statCard:{width:'30%',backgroundColor:colors.bgPanel,borderRadius:4,padding:6,
    alignItems:'center',borderWidth:1,borderColor:colors.border},
  statCardV:{fontFamily:'monospace',fontSize:14,color:colors.amber,fontWeight:'bold'},
  statCardL:{fontFamily:'monospace',fontSize:7,color:colors.textDim,marginTop:1,textAlign:'center'},
});
