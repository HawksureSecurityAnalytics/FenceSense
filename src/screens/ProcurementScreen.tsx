import React,{useState,useCallback}from 'react';
import{View,Text,TextInput,TouchableOpacity,ScrollView,StyleSheet,Alert,Share}from 'react-native';

const C={
  bg:'#0d1219',panel:'#111827',border:'#1e293b',
  ht:'#ef4444',earth:'#22c55e',post:'#94a3b8',
  energizer:'#f59e0b',text:'#e2e8f0',muted:'#64748b',
  accent:'#60a5fa',card:'#1a2332',
};

type InstallType='freestanding'|'walltop';

interface Results{
  poles:number;
  endPosts:number;
  tensioners:number;
  sHooks:number;
  gateContacts:number;
  earthSpikes:number;
  warningSigns:number;
  htWire:number;
  fenceWire:number;
  reqJoules:number;
  totalWireLength:number;
}

function requiredJoules(totalWireKm:number):number{
  // Industry standard: 1 Joule per 100m (0.1km) of total wire
  return Math.ceil(totalWireKm/0.1)*0.1;
}

export default function ProcurementScreen(){
  const[installType,setInstallType]=useState<InstallType>('freestanding');
  const[perimeter,setPerimeter]=useState('');
  const[gates,setGates]=useState('');
  const[gateWidth,setGateWidth]=useState('4');
  const[strands,setStrands]=useState('8');
  const[energizerDist,setEnergizerDist]=useState('5');
  const[results,setResults]=useState<Results|null>(null);

  const calc=useCallback(()=>{
    const P=parseFloat(perimeter);
    const G=parseInt(gates)||0;
    const GW=parseFloat(gateWidth)||4;
    const S=parseInt(strands)||8;
    const ED=parseFloat(energizerDist)||5;
    if(!P||P<=0){Alert.alert('Error','Please enter a valid perimeter distance.');return;}

    const poleSpacing=installType==='freestanding'?3:2;
    // Effective fence length (subtract gate openings)
    const fenceLen=P-(G*GW);
    // Number of intermediate poles
    const intermediatePoles=Math.ceil(fenceLen/poleSpacing);
    // End/corner posts: minimum 4 corners + 2 per gate (each side)
    const endPosts=4+(G*2);
    const totalPoles=intermediatePoles+endPosts;
    // Spring tensioners: 1 per strand per end/corner post
    const tensioners=endPosts*S;
    // S-hooks: 2 per strand per intermediate pole
    const sHooks=intermediatePoles*S; // 1 S-hook per strand per intermediate pole
    const ferrules=endPosts*S*2; // 2 ferrules per strand per end post
    // Gate contacts: 1 per gate
    const gateContacts=G;
    // Earth spikes: 3 minimum + 1 per 500m
    const earthSpikes=3+Math.ceil(P/30); // 3 at energizer + 1 per 30m fence
    // Warning signs: 1 per 10m (SANS 10222-3)
    const warningSignsRaw=Math.ceil(P/10);
    const warningSigns=Math.max(warningSignsRaw,4); // min 4
    // HT wire: energizer to fence (x2) + under each gate (gate width x strands x 1.2)
    const htWireRaw=(ED*2)+(G*GW*1.5);
    const htWire=Math.ceil(htWireRaw*1.1); // 10% extra
    // Fence wire: perimeter x strands x 1.1 (waste) - gates use HT not fence wire
    const fenceWireRaw=fenceLen*S;
    const fenceWire=Math.ceil(fenceWireRaw*1.1);
    // Total wire in km for energizer sizing
    const totalWireKm=(fenceWire+htWire)/1000;
    const reqJoules=Math.ceil(requiredJoules(totalWireKm)*10)/10;

    setResults({
      poles:totalPoles,
      endPosts,
      tensioners,
      sHooks,
      gateContacts,
      earthSpikes,
      warningSignsRaw:warningSigns,
      ferrules,
      htWire,
      fenceWire,
      reqJoules,
      totalWireLength:Math.round(totalWireKm*100)/100,
    } as any);
  },[installType,perimeter,gates,gateWidth,strands,energizerDist]);


  const shareReport=useCallback(async()=>{
    if(!results)return;
    const r=results as any;
    const lines=[
      '╔══════════════════════════════════╗',
      '║   FENCESENSE PROCUREMENT REPORT  ║',
      '╚══════════════════════════════════╝',
      '',
      `Install Type : ${installType==='freestanding'?'Freestanding (3m spacing)':'Wall-Top (2m spacing)'}`,
      `Perimeter    : ${perimeter} m`,
      `Gates        : ${gates||'0'} x ${gateWidth} m wide`,
      `Strands      : ${strands}`,
      `Energizer dist: ${energizerDist} m`,
      '',
      '── ENERGIZER ──────────────────────',
      `Min. Joules  : ${r.reqJoules} J (1J per 100m wire)`,
      `Wire Load    : ${r.totalWireLength} km`,
      '',
      '── STRUCTURAL ─────────────────────',
      `Fence Poles  : ${r.poles} total`,
      `  End/Corner : ${r.endPosts}`,
      `  Intermediate: ${r.poles-r.endPosts}`,
      `Earth Spikes : ${r.earthSpikes}`,
      '',
      '── HARDWARE ───────────────────────',
      `Spring Tensioners: ${r.tensioners}`,
      `Spring S-Hooks   : ${r.sHooks}`,
      `Ferrules (crimp) : ${r.ferrules}`,
      `Gate Contacts    : ${r.gateContacts}`,
      `Warning Signs    : ${r.warningSignsRaw}`,
      '',
      '── WIRE (incl. 10% waste) ─────────',
      `Fence Wire   : ${r.fenceWire} m`,
      `HT Cable     : ${r.htWire} m`,
      '',
      '── NOTES ──────────────────────────',
      '• Warning signs: SANS 10222-3 (1 per 10m min)',
      '• Earth spikes: 3 min, 1.2m deep, 3m apart',
      '• HT cable in conduit where underground',
      '• COC required - SANS 10222-3',
      '• 10% waste included on all wire',
      '',
      'Generated by FenceSense',
      `Date: ${new Date().toLocaleDateString('en-ZA')}`,
    ];
    try{
      await Share.share({message:lines.join('\n'),title:'FenceSense Procurement Report'});
    }catch(e){Alert.alert('Error','Could not share report');}
  },[results,installType,perimeter,gates,gateWidth,strands,energizerDist]);

  const Row=({label,value,unit,highlight}:{label:string;value:string|number;unit?:string;highlight?:boolean})=>(
    <View style={[s.row,highlight&&{backgroundColor:'#1e2d1e'}]}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>
        <Text style={[s.rowValue,highlight&&{color:C.earth}]}>{value}</Text>
        {unit&&<Text style={s.rowUnit}> {unit}</Text>}
      </View>
    </View>
  );

  return(
    <ScrollView style={s.root} contentContainerStyle={{paddingBottom:40}}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📋 PROCUREMENT</Text>
        <Text style={s.subtitle}>Electric Fence Material Calculator</Text>
      </View>

      {/* Install Type */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>INSTALLATION TYPE</Text>
        <View style={s.toggleRow}>
          {(['freestanding','walltop'] as InstallType[]).map(t=>(
            <TouchableOpacity key={t} style={[s.toggle,installType===t&&s.toggleOn]} onPress={()=>setInstallType(t)}>
              <Text style={[s.toggleTxt,installType===t&&{color:C.energizer}]}>
                {t==='freestanding'?'🏗 Freestanding':'🧱 Wall-Top'}
              </Text>
              <Text style={s.toggleSub}>{t==='freestanding'?'3m pole spacing':'2m pole spacing'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Inputs */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>FENCE PARAMETERS</Text>
        {[
          {label:'Perimeter Distance',val:perimeter,set:setPerimeter,unit:'m',placeholder:'e.g. 200'},
          {label:'Number of Gates',val:gates,set:setGates,unit:'gates',placeholder:'e.g. 2'},
          {label:'Gate Width (each)',val:gateWidth,set:setGateWidth,unit:'m',placeholder:'e.g. 4'},
          {label:'Number of Strands',val:strands,set:setStrands,unit:'strands',placeholder:'e.g. 8'},
          {label:'Energizer Distance from Fence',val:energizerDist,set:setEnergizerDist,unit:'m',placeholder:'e.g. 5'},
        ].map(({label,val,set,unit,placeholder})=>(
          <View key={label} style={s.inputRow}>
            <Text style={s.inputLabel}>{label}</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={val}
                onChangeText={set}
                keyboardType="numeric"
                placeholder={placeholder}
                placeholderTextColor={C.muted}
              />
              <Text style={s.inputUnit}>{unit}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Calculate Button */}
      <TouchableOpacity style={s.calcBtn} onPress={calc}>
        <Text style={s.calcBtnTxt}>⚡ CALCULATE PROCUREMENT</Text>
      </TouchableOpacity>

      {/* Results */}
      {results&&(
        <View style={s.section}>
          <Text style={s.sectionTitle}>MATERIAL LIST</Text>

          <View style={s.card}>
            <Text style={s.cardTitle}>⚡ ENERGIZER</Text>
            <Row label="Min. Energizer Output" value={(results as any).reqJoules} unit="Joules" highlight/>
            <Row label="Total Wire Load" value={results.totalWireLength} unit="km"/>
            <Row label="Rule of thumb" value="1J per 100m wire" />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>🏗 STRUCTURAL</Text>
            <Row label="Fence Poles (total)" value={results.poles}/>
            <Row label="  — End / Corner Posts" value={results.endPosts}/>
            <Row label="  — Intermediate Poles" value={results.poles-results.endPosts}/>
            <Row label="Earth Spikes" value={(results as any).earthSpikes}/>
            <Row label="  — At Energizer" value="3 (mandatory)"/>
            <Row label="  — Along Fence" value={Math.ceil(parseFloat(perimeter||'0')/30)} unit="@ 30m"/>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>🔗 HARDWARE</Text>
            <Row label="Spring Tensioners" value={results.tensioners}/>
            <Row label="Spring S-Hooks" value={results.sHooks}/>
            <Row label="Ferrules (crimp)" value={(results as any).ferrules}/>
            <Row label="Gate Contacts" value={results.gateContacts}/>
            <Row label="Warning Signs" value={(results as any).warningSignsRaw} highlight/>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>🔴 WIRE (incl. 10% waste)</Text>
            <Row label="Fence Wire" value={results.fenceWire} unit="m" highlight/>
            <Row label="HT Cable (energizer + gates)" value={results.htWire} unit="m"/>
          </View>

          <View style={[s.card,{borderColor:C.energizer,borderWidth:1}]}>
            <Text style={[s.cardTitle,{color:C.energizer}]}>📌 NOTES</Text>
            <Text style={s.note}>• Pole spacing: {installType==='freestanding'?'3m (freestanding)':'2m (wall-top)'}</Text>
            <Text style={s.note}>• Warning signs per SANS 10222-3: 1 per 10m min</Text>
            <Text style={s.note}>• Earth spikes: 3 minimum, driven 1.2m deep, 3m apart</Text>
            <Text style={s.note}>• HT cable run in conduit where underground</Text>
            <Text style={s.note}>• COC required for all installations (SANS 10222-3)</Text>
            <Text style={s.note}>• Quantities include 10% waste allowance on wire</Text>
          </View>

          <TouchableOpacity style={s.shareBtn} onPress={shareReport}>
            <Text style={s.shareBtnTxt}>📤 EXPORT / SHARE REPORT</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  header:{padding:16,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.panel},
  title:{fontSize:18,fontWeight:'bold',color:C.energizer,letterSpacing:2},
  subtitle:{fontSize:12,color:C.muted,marginTop:2},
  section:{padding:12,marginTop:8},
  sectionTitle:{fontSize:10,fontWeight:'bold',color:C.muted,letterSpacing:2,marginBottom:10},
  toggleRow:{flexDirection:'row',gap:8},
  toggle:{flex:1,backgroundColor:C.panel,borderRadius:8,padding:12,borderWidth:1,borderColor:C.border,alignItems:'center'},
  toggleOn:{borderColor:C.energizer,backgroundColor:'#1a1500'},
  toggleTxt:{color:C.muted,fontSize:13,fontWeight:'bold'},
  toggleSub:{color:C.muted,fontSize:10,marginTop:2},
  inputRow:{marginBottom:12},
  inputLabel:{color:C.muted,fontSize:11,marginBottom:4,letterSpacing:1},
  inputWrap:{flexDirection:'row',alignItems:'center',backgroundColor:C.panel,borderRadius:8,borderWidth:1,borderColor:C.border},
  input:{flex:1,color:C.text,fontSize:16,padding:12},
  inputUnit:{color:C.muted,fontSize:12,paddingRight:12},
  calcBtn:{margin:12,backgroundColor:C.energizer,borderRadius:10,padding:16,alignItems:'center'},
  calcBtnTxt:{color:'#000',fontWeight:'bold',fontSize:15,letterSpacing:1},
  card:{backgroundColor:C.card,borderRadius:10,padding:12,marginBottom:12,borderWidth:1,borderColor:C.border},
  cardTitle:{fontSize:11,fontWeight:'bold',color:C.accent,letterSpacing:2,marginBottom:10},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:7,borderBottomWidth:1,borderBottomColor:C.border},
  rowLabel:{color:C.muted,fontSize:13,flex:1},
  rowRight:{flexDirection:'row',alignItems:'baseline'},
  rowValue:{color:C.text,fontSize:15,fontWeight:'bold'},
  rowUnit:{color:C.muted,fontSize:11},
  note:{color:C.muted,fontSize:11,marginTop:5,lineHeight:17},
  shareBtn:{backgroundColor:C.accent,borderRadius:10,padding:16,alignItems:'center',marginTop:8},
  shareBtnTxt:{color:'#000',fontWeight:'bold',fontSize:15,letterSpacing:1},
});
