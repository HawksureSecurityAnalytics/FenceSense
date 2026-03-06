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

const FENCE_TYPES: {key:FenceType;label:string}[] = [
  {key:'agricultural',label:'Agri'},
  {key:'security',label:'Security'},
  {key:'game',label:'Game'},
  {key:'wildlife',label:'Wildlife'},
];

const WIRE_TYPES: {key:WireType;label:string;color:string;dashed?:boolean}[] = [
  {key:'hot',         label:'HT Wire',      color:colors.hot},
  {key:'earth',       label:'Earth Wire',   color:colors.earth},
  {key:'bridge_hot',  label:'HT Bridge',    color:colors.bridgeHot,   dashed:true},
  {key:'bridge_earth',label:'Earth Bridge', color:colors.bridgeEarth, dashed:true},
];

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
  const [nodes, setNodes]   = useState<FenceNode[]>(project.nodes);
  const [wires, setWires]   = useState<FenceWire[]>(project.wires);
  const [fenceType, setFT]  = useState<FenceType>(project.fenceType);
  const [canvasState, setCS] = useState<CanvasState>({
    tool:'select', wireMode:'hot', pendingComponent:null,
    selectedNodeId:null, selectedWireId:null, wireStart:null,
    pan:{x:20,y:40}, scale:1,
  });
  const [validationResult, setVR] = useState<any>(null);
  const [showValidation, setShowV] = useState(false);
  const [showComponents, setShowC] = useState(false);
  const [highlightIds, setHL] = useState<string[]>([]);
  const valAnim = useRef(new Animated.Value(0)).current;

  const sync = useCallback((n: FenceNode[], w: FenceWire[], ft: FenceType) => {
    const updated = {...project, nodes:n, wires:w, fenceType:ft, updatedAt:Date.now()};
    scheduleAutoSave(updated);
    onProjectUpdate(updated);
  }, [project, onProjectUpdate]);

  const handlePlaceNode = useCallback((type: ComponentType, x: number, y: number) => {
    const def = COMPONENTS.find(c=>c.key===type);
    const count = nodes.filter(n=>n.type===type).length+1;
    const node: FenceNode = {
      id:`n_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      type, x, y, label:`${def?.label||type} ${count}`,
    };
    const next = [...nodes, node];
    setNodes(next); sync(next, wires, fenceType);
  }, [nodes, wires, fenceType, sync]);

  const handleWirePoint = useCallback((x: number, y: number) => {
    setCS(prev => {
      if (!prev.wireStart) return {...prev, wireStart:{x,y}};
      const {wireStart, wireMode} = prev;
      if (Math.abs(x-wireStart.x)>4 || Math.abs(y-wireStart.y)>4) {
        const len = Math.round(Math.hypot(x-wireStart.x, y-wireStart.y)/SNAP*2);
        const wire: FenceWire = {
          id:`w_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          type:wireMode, x1:wireStart.x, y1:wireStart.y, x2:x, y2:y, lengthMeters:len,
        };
        const next = [...wires, wire];
        setWires(next); sync(nodes, next, fenceType);
      }
      return {...prev, wireStart:{x,y}};
    });
  }, [nodes, wires, fenceType, sync]);

  const handleMoveNode = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id===id ? {...n,x,y} : n);
      setWires(pw => {
        const node = prev.find(n=>n.id===id);
        if (!node) return pw;
        const near=(a:number,b:number)=>Math.abs(a-b)<40;
        return pw.map(w => {
          if (near(w.x1,node.x)&&near(w.y1,node.y)) return {...w,x1:x,y1:y};
          if (near(w.x2,node.x)&&near(w.y2,node.y)) return {...w,x2:x,y2:y};
          return w;
        });
      });
      return updated;
    });
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    const next = nodes.filter(n=>n.id!==id);
    setNodes(next); sync(next, wires, fenceType);
    setCS(p=>({...p,selectedNodeId:null}));
  }, [nodes, wires, fenceType, sync]);

  const handleDeleteWire = useCallback((id: string) => {
    const next = wires.filter(w=>w.id!==id);
    setWires(next); sync(nodes, next, fenceType);
    setCS(p=>({...p,selectedWireId:null}));
  }, [nodes, wires, fenceType, sync]);

  const handlePan = useCallback((dx:number,dy:number) => {
    setCS(p=>({...p,pan:{x:p.pan.x+dx,y:p.pan.y+dy}}));
  }, []);

  const handleZoom = useCallback((zd:number,cx:number,cy:number) => {
    setCS(p=>{
      const nz=Math.max(0.3,Math.min(4,p.scale*zd));
      return {...p,scale:nz,pan:{x:cx-(cx-p.pan.x)*(nz/p.scale),y:cy-(cy-p.pan.y)*(nz/p.scale)}};
    });
  }, []);

  const setTool = (tool: CanvasState['tool']) =>
    setCS(p=>({...p,tool,wireStart:null,pendingComponent:null}));

  const setWireMode = (wireMode: WireType) =>
    setCS(p=>({...p,wireMode,wireStart:null,tool:'wire'}));

  const pickComponent = (type: ComponentType) => {
    setCS(p=>({...p,pendingComponent:type,tool:'place',wireStart:null}));
    setShowC(false);
  };

  const runValidation = () => {
    const result = validateFence(nodes, wires, fenceType);
    setVR(result);
    setHL(result.issues.flatMap((i:any)=>i.affectedIds||[]));
    setShowV(true);
    Animated.spring(valAnim,{toValue:1,useNativeDriver:true,tension:80,friction:12}).start();
  };

  const closeValidation = () => {
    Animated.timing(valAnim,{toValue:0,duration:200,useNativeDriver:true}).start(()=>{
      setShowV(false); setHL([]);
    });
  };

  const clearAll = () => Alert.alert('Clear Canvas','Remove all components and wires?',[
    {text:'Cancel',style:'cancel'},
    {text:'Clear',style:'destructive',onPress:()=>{
      setNodes([]); setWires([]); setVR(null); sync([],[],fenceType);
    }},
  ]);

  const energizerCount = nodes.filter(n=>n.type==='energizer').length;
  const gateCount      = nodes.filter(n=>n.type==='gate').length;
  const spikeCount     = nodes.filter(n=>n.type==='earth_spike').length;
  const htLength       = wires.filter(w=>w.type==='hot').reduce((s,w)=>s+(w.lengthMeters||0),0);
  const scoreColor     = validationResult
    ? validationResult.score>=80 ? colors.ok : validationResult.score>=50 ? colors.warn : colors.danger
    : colors.textDim;

  const CANVAS_HEIGHT = SH - 56 - 110 - (Platform.OS==='android'?(StatusBar.currentHeight||0):0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPanel}/>

      <View style={styles.topBar}>
        <View>
          <Text style={styles.logo}>⚡ FENCESENSE</Text>
          <Text style={styles.logoSub}>SMART FENCE DESIGNER</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1,marginHorizontal:8}}>
          {FENCE_TYPES.map(ft=>(
            <TouchableOpacity key={ft.key}
              style={[styles.typeBtn, fenceType===ft.key && styles.typeBtnOn]}
              onPress={()=>{setFT(ft.key);sync(nodes,wires,ft.key);}}>
              <Text style={[styles.typeBtnTxt, fenceType===ft.key && {color:colors.amber}]}>{ft.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.valBtn} onPress={runValidation}>
          <Text style={styles.valBtnTxt}>VALIDATE</Text>
        </TouchableOpacity>
      </View>

      <View style={{position:'relative'}}>
        <FenceCanvas
          nodes={nodes} wires={wires} canvasState={canvasState}
          onPlaceNode={handlePlaceNode} onWirePoint={handleWirePoint}
          onSelectNode={id=>setCS(p=>({...p,selectedNodeId:id,selectedWireId:null}))}
          onSelectWire={id=>setCS(p=>({...p,selectedWireId:id,selectedNodeId:null}))}
          onMoveNode={handleMoveNode} onDeleteNode={handleDeleteNode}
          onDeleteWire={handleDeleteWire} onPan={handlePan} onZoom={handleZoom}
          highlightIds={highlightIds} canvasHeight={CANVAS_HEIGHT}
        />
        <View style={styles.modeBadge}>
          <Text style={styles.modeTxt}>
            {canvasState.tool==='wire'
              ? `WIRE: ${canvasState.wireMode.toUpperCase().replace('_',' ')}`
              : canvasState.tool==='place' && canvasState.pendingComponent
              ? `PLACING: ${canvasState.pendingComponent.toUpperCase().replace('_',' ')}`
              : canvasState.tool.toUpperCase()}
          </Text>
        </View>
        {validationResult && (
          <View style={[styles.scoreBadge,{borderColor:scoreColor}]}>
            <Text style={[styles.scoreNum,{color:scoreColor}]}>{validationResult.score}</Text>
            <Text style={styles.scoreLbl}>SCORE</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:6}}>
          {[{k:'select',i:'↖',l:'Select'},{k:'wire',i:'〰',l:'Wire'},
            {k:'pan',i:'✋',l:'Pan'},{k:'delete',i:'✕',l:'Delete'}].map(t=>(
            <TouchableOpacity key={t.k}
              style={[styles.toolBtn, canvasState.tool===t.k && styles.toolBtnOn]}
              onPress={()=>setTool(t.k as any)}>
              <Text style={[styles.toolIcon, canvasState.tool===t.k && {color:colors.amber}]}>{t.i}</Text>
              <Text style={[styles.toolLbl, canvasState.tool===t.k && {color:colors.amber}]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sep}/>
          {WIRE_TYPES.map(wt=>(
            <TouchableOpacity key={wt.key}
              style={[styles.wireDot,{borderColor:wt.color},
                canvasState.wireMode===wt.key&&canvasState.tool==='wire'&&{backgroundColor:wt.color+'30'}]}
              onPress={()=>setWireMode(wt.key)}>
              <View style={[styles.wireLine,{backgroundColor:wt.color}]}/>
              <Text style={[styles.toolLbl,{color:wt.color}]}>{wt.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sep}/>
          <TouchableOpacity style={styles.placeBtn} onPress={()=>setShowC(true)}>
            <Text style={styles.placeIcon}>⊕</Text>
            <Text style={[styles.toolLbl,{color:colors.amber}]}>Place</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={clearAll}>
            <Text style={styles.toolIcon}>🗑</Text>
            <Text style={styles.toolLbl}>Clear</Text>
          </TouchableOpacity>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            {l:'Energizer',v:energizerCount.toString()},
            {l:'HT Wire',  v:`${htLength}m`},
            {l:'Gates',    v:gateCount.toString()},
            {l:'Spikes',   v:spikeCount.toString()},
            ...(validationResult ? [{l:'Issues',v:validationResult.issues.filter((i:any)=>i.severity==='error'||i.severity==='warn').length.toString(),c:validationResult.passed?colors.ok:colors.danger}] : []),
          ].map((s,i)=>(
            <View key={i} style={styles.statChip}>
              <Text style={styles.statLbl}>{s.l}</Text>
              <Text style={[styles.statVal,s.c?{color:s.c}:{}]}>{s.v}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

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

      {showValidation && validationResult && (
        <Animated.View style={[styles.valPanel,{
          transform:[{translateY:valAnim.interpolate({inputRange:[0,1],outputRange:[SH,0]})}],
        }]}>
          <View style={styles.valHeader}>
            <View style={[styles.valStatus,{borderColor:validationResult.passed?colors.ok:colors.danger}]}>
              <Text style={styles.valIcon}>{validationResult.passed?'✅':'⛔'}</Text>
              <View>
                <Text style={[styles.valTitle,{color:validationResult.passed?colors.ok:colors.danger}]}>
                  {validationResult.passed?'Passed':`${validationResult.issues.filter((i:any)=>i.severity==='error').length} Error(s) Found`}
                </Text>
                <Text style={styles.valSub}>Health Score: {validationResult.score}/100</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={closeValidation}>
              <Text style={styles.closeTxt}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{flex:1}}>
            {validationResult.issues.map((issue:any)=>(
              <View key={issue.id} style={[styles.issueCard,
                issue.severity==='error'?styles.issueErr:issue.severity==='warn'?styles.issueWarn:styles.issueOk]}>
                <Text style={styles.issueIcon}>{issue.severity==='error'?'⛔':issue.severity==='warn'?'⚠️':'✅'}</Text>
                <View style={{flex:1}}>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <Text style={styles.issueDetail}>{issue.detail}</Text>
                  {issue.suggestion&&<Text style={styles.issueSug}>→ {issue.suggestion}</Text>}
                  <Text style={styles.issueCode}>{issue.code}</Text>
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
              <Text style={styles.recsTitle}>▶ FENCE STATS</Text>
              <View style={styles.statsGrid}>
                {[
                  {l:'HT Wire',    v:`${validationResult.stats.htLengthM}m`},
                  {l:'Earth Wire', v:`${validationResult.stats.earthLengthM}m`},
                  {l:'Energizers', v:validationResult.stats.energizerCount},
                  {l:'Spikes',     v:validationResult.stats.earthSpikeCount},
                  {l:'Gates',      v:validationResult.stats.gateCount},
                  {l:'Est. Joules',v:`${validationResult.stats.estimatedJoulesNeeded}J`},
                ].map((s,i)=>(
                  <View key={i} style={styles.statCard}>
                    <Text style={styles.statCardVal}>{s.v}</Text>
                    <Text style={styles.statCardLbl}>{s.l}</Text>
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
  topBar:{height:56,backgroundColor:colors.bgPanel,borderBottomWidth:1,borderBottomColor:colors.border,
    flexDirection:'row',alignItems:'center',paddingHorizontal:spacing.md,
    paddingTop:Platform.OS==='android'?StatusBar.currentHeight:0,gap:spacing.sm},
  logo:{fontFamily:'monospace',fontSize:15,fontWeight:'bold',color:colors.amber,letterSpacing:2},
  logoSub:{fontFamily:'monospace',fontSize:7,color:colors.textDim,letterSpacing:1},
  typeBtn:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.sm,
    borderWidth:1,borderColor:colors.border,marginRight:4},
  typeBtnOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  typeBtnTxt:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:1},
  valBtn:{backgroundColor:'rgba(255,68,68,0.1)',borderWidth:1,borderColor:colors.hot,
    borderRadius:radius.sm,paddingHorizontal:spacing.md,paddingVertical:6},
  valBtnTxt:{fontFamily:'monospace',fontSize:10,color:colors.hot,letterSpacing:1},
  modeBadge:{position:'absolute',top:10,alignSelf:'center',backgroundColor:'rgba(15,21,32,0.9)',
    borderWidth:1,borderColor:colors.amber,borderRadius:20,paddingHorizontal:14,paddingVertical:3},
  modeTxt:{fontFamily:'monospace',fontSize:9,color:colors.amber,letterSpacing:2},
  scoreBadge:{position:'absolute',top:10,right:12,borderWidth:1,borderRadius:radius.md,
    backgroundColor:colors.bgPanel,paddingHorizontal:10,paddingVertical:6,alignItems:'center'},
  scoreNum:{fontFamily:'monospace',fontSize:18,fontWeight:'bold'},
  scoreLbl:{fontFamily:'monospace',fontSize:7,color:colors.textDim,letterSpacing:2},
  bottomBar:{backgroundColor:colors.bgPanel,borderTopWidth:1,borderTopColor:colors.border,
    paddingHorizontal:spacing.sm,paddingTop:spacing.sm,paddingBottom:spacing.sm},
  toolBtn:{alignItems:'center',paddingHorizontal:8,paddingVertical:4,borderRadius:radius.sm,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.bgCard,marginRight:4},
  toolBtnOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  toolIcon:{fontSize:16,color:colors.textDim},
  toolLbl:{fontFamily:'monospace',fontSize:7,color:colors.textDim,letterSpacing:1,marginTop:1},
  sep:{width:1,height:36,backgroundColor:colors.border,marginHorizontal:4,alignSelf:'center'},
  wireDot:{alignItems:'center',paddingHorizontal:6,paddingVertical:4,borderRadius:radius.sm,
    borderWidth:1,marginRight:4,minWidth:50},
  wireLine:{width:20,height:4,borderRadius:2,marginBottom:2},
  placeBtn:{alignItems:'center',paddingHorizontal:10,paddingVertical:4,borderRadius:radius.sm,
    borderWidth:1,borderColor:colors.amber,backgroundColor:colors.amberDim,marginRight:4},
  placeIcon:{fontSize:18,color:colors.amber},
  statChip:{backgroundColor:colors.bgCard,borderRadius:radius.sm,paddingVertical:4,
    paddingHorizontal:8,borderWidth:1,borderColor:colors.border,alignItems:'center',marginRight:6},
  statLbl:{fontFamily:'monospace',fontSize:7,color:colors.textDim},
  statVal:{fontFamily:'monospace',fontSize:12,color:colors.amber,fontWeight:'bold'},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'},
  sheet:{backgroundColor:colors.bgPanel,borderTopLeftRadius:16,borderTopRightRadius:16,
    padding:spacing.lg,paddingBottom:32},
  sheetTitle:{fontFamily:'monospace',fontSize:10,color:colors.textDim,letterSpacing:3,marginBottom:spacing.md},
  compRow:{flexDirection:'row',alignItems:'center',gap:spacing.md,paddingVertical:12,
    borderBottomWidth:1,borderBottomColor:colors.border},
  compDot:{width:14,height:14,borderRadius:7},
  compLabel:{fontFamily:'monospace',fontSize:14,color:colors.text,fontWeight:'bold'},
  compSub:{fontFamily:'monospace',fontSize:9,color:colors.textDim},
  compArrow:{fontSize:20,color:colors.textDim},
  valPanel:{position:'absolute',bottom:0,left:0,right:0,height:SH*0.75,
    backgroundColor:colors.bgPanel,borderTopLeftRadius:16,borderTopRightRadius:16,
    borderTopWidth:1,borderTopColor:colors.border},
  valHeader:{padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.md,
    borderBottomWidth:1,borderBottomColor:colors.border},
  valStatus:{flex:1,flexDirection:'row',alignItems:'center',gap:spacing.sm,
    backgroundColor:colors.bgCard,borderRadius:radius.md,padding:spacing.sm,borderWidth:1},
  valIcon:{fontSize:22},
  valTitle:{fontFamily:'monospace',fontSize:14,fontWeight:'bold'},
  valSub:{fontFamily:'monospace',fontSize:9,color:colors.textDim,marginTop:2},
  closeBtn:{backgroundColor:colors.bgCard,borderRadius:radius.sm,padding:spacing.sm,
    borderWidth:1,borderColor:colors.border},
  closeTxt:{fontFamily:'monospace',fontSize:10,color:colors.textDim},
  issueCard:{flexDirection:'row',gap:spacing.sm,margin:spacing.sm,marginBottom:0,
    borderRadius:radius.md,padding:spacing.md,borderWidth:1},
  issueErr:{borderColor:'rgba(239,68,68,0.4)',backgroundColor:'rgba(239,68,68,0.05)'},
  issueWarn:{borderColor:'rgba(245,158,11,0.4)',backgroundColor:'rgba(245,158,11,0.05)'},
  issueOk:{borderColor:'rgba(34,197,94,0.4)',backgroundColor:'rgba(34,197,94,0.05)'},
  issueIcon:{fontSize:14,marginTop:2},
  issueTitle:{fontFamily:'monospace',fontSize:12,color:colors.text,fontWeight:'bold',marginBottom:3},
  issueDetail:{fontSize:11,color:colors.textDim,lineHeight:16,marginBottom:4},
  issueSug:{fontFamily:'monospace',fontSize:10,color:colors.amber,lineHeight:15},
  issueCode:{fontFamily:'monospace',fontSize:8,color:'#3a5070',marginTop:4},
  recsBox:{margin:spacing.md,padding:spacing.md,backgroundColor:colors.bgCard,
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border},
  recsTitle:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:3,marginBottom:spacing.sm},
  recItem:{fontFamily:'monospace',fontSize:11,color:colors.text,marginBottom:6,lineHeight:16},
  statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:spacing.sm},
  statCard:{width:'30%',backgroundColor:colors.bgPanel,borderRadius:radius.sm,padding:spacing.sm,
    alignItems:'center',borderWidth:1,borderColor:colors.border},
  statCardVal:{fontFamily:'monospace',fontSize:16,color:colors.amber,fontWeight:'bold'},
  statCardLbl:{fontFamily:'monospace',fontSize:8,color:colors.textDim,marginTop:2,textAlign:'center'},
});
