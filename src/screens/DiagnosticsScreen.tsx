import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, StatusBar,
} from 'react-native';
import { FenceType, DiagnosticInput, DiagnosticResult } from '../types';
import { runDiagnostics } from '../engine/validator';
import { colors, spacing, radius } from '../theme';

const FAULT_LABELS: Record<string, string> = {
  low_voltage:'Low Voltage', open_circuit:'Open Circuit / Broken Wire',
  short_circuit:'Short Circuit', poor_earth:'Poor Earthing',
  vegetation_drain:'Vegetation Drain', gate_contact_fault:'Gate Contact Fault',
};
const FAULT_ICONS: Record<string, string> = {
  low_voltage:'📉', open_circuit:'🔌', short_circuit:'💥',
  poor_earth:'🌍', vegetation_drain:'🌿', gate_contact_fault:'🚪',
};
const SYMPTOMS = [
  {key:'no_voltage',   label:'No voltage on wire'},
  {key:'low_voltage',  label:'Low voltage reading'},
  {key:'clicking',     label:'Rapid clicking sound'},
  {key:'tripping',     label:'Energizer trips/shuts off'},
  {key:'intermittent', label:'Intermittent / comes and goes'},
  {key:'gate_area',    label:'Problem near a gate'},
  {key:'after_rain',   label:'Worse after rain'},
  {key:'dry_weather',  label:'Worse in dry weather'},
];
const SOIL = [
  {key:'dry',   label:'Dry / Sandy', color:'#f5a623'},
  {key:'normal',label:'Normal',      color:'#22c55e'},
  {key:'wet',   label:'Wet / Clay',  color:'#60a5fa'},
];
const FENCE_TYPES: {key:FenceType;label:string}[] = [
  {key:'agricultural',label:'Agricultural'},
  {key:'security',    label:'Security'},
  {key:'game',        label:'Game'},
  {key:'wildlife',    label:'Wildlife'},
];

export default function DiagnosticsScreen() {
  const [step, setStep]           = useState<1|2>(1);
  const [result, setResult]       = useState<DiagnosticResult|null>(null);
  const [fenceType, setFT]        = useState<FenceType>('agricultural');
  const [measuredKV, setMeasured] = useState('');
  const [energizerKV, setEnergy]  = useState('');
  const [lengthM, setLength]      = useState('');
  const [spikeCount, setSpikes]   = useState('3');
  const [soil, setSoil]           = useState<'dry'|'normal'|'wet'>('normal');
  const [symptoms, setSymptoms]   = useState<string[]>([]);

  const toggleSymptom = (key: string) =>
    setSymptoms(p => p.includes(key) ? p.filter(s=>s!==key) : [...p,key]);

  const diagnose = () => {
    const input: DiagnosticInput = {
      measuredVoltageKV: parseFloat(measuredKV)||0,
      energizerOutputKV: parseFloat(energizerKV)||8,
      fenceType, totalLengthM: parseFloat(lengthM)||100,
      earthSpikeCount: parseInt(spikeCount,10)||3,
      soilCondition: soil, symptoms,
    };
    setResult(runDiagnostics(input));
    setStep(2);
  };

  const confColor = result
    ? result.confidence>=80 ? colors.ok : result.confidence>=55 ? colors.warn : colors.textDim
    : colors.textDim;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgPanel}/>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 FENCE DIAGNOSTICS</Text>
        <Text style={styles.sub}>Offline fault-finding wizard</Text>
      </View>

      {step===1 && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.secLabel}>FENCE TYPE</Text>
          <View style={styles.row}>
            {FENCE_TYPES.map(ft=>(
              <TouchableOpacity key={ft.key}
                style={[styles.chip, fenceType===ft.key && styles.chipOn]}
                onPress={()=>setFT(ft.key)}>
                <Text style={[styles.chipTxt, fenceType===ft.key && {color:colors.amber}]}>{ft.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.secLabel}>VOLTAGE READINGS (kV)</Text>
          <View style={styles.row}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLbl}>Measured on fence</Text>
              <TextInput style={styles.input} value={measuredKV} onChangeText={setMeasured}
                keyboardType="decimal-pad" placeholder="e.g. 4.5" placeholderTextColor={colors.textDim}/>
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLbl}>Energizer rated output</Text>
              <TextInput style={styles.input} value={energizerKV} onChangeText={setEnergy}
                keyboardType="decimal-pad" placeholder="e.g. 9.0" placeholderTextColor={colors.textDim}/>
            </View>
          </View>

          <Text style={styles.secLabel}>FENCE DETAILS</Text>
          <View style={styles.row}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLbl}>Total length (m)</Text>
              <TextInput style={styles.input} value={lengthM} onChangeText={setLength}
                keyboardType="number-pad" placeholder="e.g. 500" placeholderTextColor={colors.textDim}/>
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLbl}>Earth spikes</Text>
              <TextInput style={styles.input} value={spikeCount} onChangeText={setSpikes}
                keyboardType="number-pad" placeholder="e.g. 3" placeholderTextColor={colors.textDim}/>
            </View>
          </View>

          <Text style={styles.secLabel}>SOIL CONDITION</Text>
          <View style={styles.row}>
            {SOIL.map(sc=>(
              <TouchableOpacity key={sc.key}
                style={[styles.chip, soil===sc.key && {borderColor:sc.color,backgroundColor:sc.color+'20'}]}
                onPress={()=>setSoil(sc.key as any)}>
                <Text style={[styles.chipTxt, soil===sc.key && {color:sc.color}]}>{sc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.secLabel}>SYMPTOMS (select all that apply)</Text>
          {SYMPTOMS.map(s=>{
            const on = symptoms.includes(s.key);
            return (
              <TouchableOpacity key={s.key}
                style={[styles.symptom, on && styles.symptomOn]}
                onPress={()=>toggleSymptom(s.key)}>
                <Text style={[styles.symptomTxt, on && {color:colors.amber}]}>{s.label}</Text>
                {on && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.diagnoseBtn} onPress={diagnose}>
            <Text style={styles.diagnoseTxt}>🔍 DIAGNOSE FAULT</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step===2 && result && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={[styles.faultCard,{borderColor:confColor}]}>
            <Text style={styles.faultIcon}>
              {result.likelyFault ? (FAULT_ICONS[result.likelyFault]||'⚠️') : 'ℹ️'}
            </Text>
            <View style={{flex:1}}>
              <Text style={styles.faultLabel}>
                {result.likelyFault ? (FAULT_LABELS[result.likelyFault]||result.likelyFault) : 'No Clear Fault'}
              </Text>
              <View style={styles.confBar}>
                <View style={[styles.confFill,{width:`${result.confidence}%` as any,backgroundColor:confColor}]}/>
              </View>
              <Text style={[styles.confTxt,{color:confColor}]}>{result.confidence}% confidence</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.secLabel}>▶ DIAGNOSIS</Text>
            <Text style={styles.explainTxt}>{result.explanation}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.secLabel}>▶ FAULT-FINDING STEPS</Text>
            {result.steps.map((s,i)=>(
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{i+1}</Text></View>
                <Text style={styles.stepTxt}>{s}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={()=>{setResult(null);setStep(1);setSymptoms([]);}}>
            <Text style={styles.resetTxt}>← New Diagnosis</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg},
  header:{backgroundColor:colors.bgPanel,borderBottomWidth:1,borderBottomColor:colors.border,
    padding:spacing.md,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||0)+spacing.sm:spacing.lg},
  title:{fontFamily:'monospace',fontSize:16,color:colors.amber,letterSpacing:2,fontWeight:'bold'},
  sub:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:2,marginTop:2},
  scroll:{flex:1},
  content:{padding:spacing.md,paddingBottom:40},
  secLabel:{fontFamily:'monospace',fontSize:9,color:colors.textDim,letterSpacing:3,
    marginTop:spacing.lg,marginBottom:spacing.sm},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8},
  chip:{paddingHorizontal:spacing.md,paddingVertical:8,borderRadius:radius.sm,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.bgCard},
  chipOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  chipTxt:{fontFamily:'monospace',fontSize:11,color:colors.textDim},
  inputWrap:{flex:1,minWidth:140},
  inputLbl:{fontFamily:'monospace',fontSize:9,color:colors.textDim,marginBottom:4},
  input:{backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.sm,paddingHorizontal:spacing.md,paddingVertical:10,
    fontFamily:'monospace',fontSize:16,color:colors.amber},
  symptom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.sm,paddingHorizontal:spacing.md,paddingVertical:10,marginBottom:6},
  symptomOn:{borderColor:colors.amber,backgroundColor:colors.amberDim},
  symptomTxt:{fontFamily:'monospace',fontSize:12,color:colors.textDim},
  check:{color:colors.amber,fontWeight:'bold'},
  diagnoseBtn:{marginTop:spacing.xl,backgroundColor:'rgba(255,68,68,0.1)',borderWidth:1,
    borderColor:colors.hot,borderRadius:radius.md,paddingVertical:14,alignItems:'center'},
  diagnoseTxt:{fontFamily:'monospace',fontSize:14,color:colors.hot,letterSpacing:2},
  faultCard:{flexDirection:'row',alignItems:'center',gap:spacing.md,backgroundColor:colors.bgCard,
    borderWidth:1,borderRadius:radius.lg,padding:spacing.lg,marginBottom:spacing.md},
  faultIcon:{fontSize:40},
  faultLabel:{fontFamily:'monospace',fontSize:16,color:colors.text,fontWeight:'bold',marginBottom:8},
  confBar:{height:4,backgroundColor:colors.border,borderRadius:2,marginBottom:4,overflow:'hidden'},
  confFill:{height:'100%',borderRadius:2},
  confTxt:{fontFamily:'monospace',fontSize:10,letterSpacing:1},
  card:{backgroundColor:colors.bgCard,borderRadius:radius.md,padding:spacing.md,
    marginBottom:spacing.md,borderWidth:1,borderColor:colors.border},
  explainTxt:{fontSize:13,color:colors.text,lineHeight:20},
  stepRow:{flexDirection:'row',gap:spacing.sm,marginBottom:spacing.sm,alignItems:'flex-start'},
  stepNum:{width:22,height:22,borderRadius:11,backgroundColor:colors.amber+'20',
    borderWidth:1,borderColor:colors.amber,alignItems:'center',justifyContent:'center',flexShrink:0},
  stepNumTxt:{fontFamily:'monospace',fontSize:10,color:colors.amber,fontWeight:'bold'},
  stepTxt:{flex:1,fontSize:13,color:colors.text,lineHeight:20},
  resetBtn:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    paddingVertical:12,alignItems:'center',backgroundColor:colors.bgCard},
  resetTxt:{fontFamily:'monospace',fontSize:12,color:colors.textDim},
});
