import React,{useState}from 'react';
import{View,Text,TouchableOpacity,StyleSheet,StatusBar,Platform}from 'react-native';
import FenceSchematic from './DesignScreen';
import DrawScreen from './DrawScreen';

export default function MainTabs(){
  const[tab,setTab]=useState<'schematic'|'draw'>('schematic');
  return(
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1219"/>
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab,tab==='schematic'&&s.tabOn]} onPress={()=>setTab('schematic')}>
          <Text style={[s.tabTxt,tab==='schematic'&&s.tabTxtOn]}>📐 SCHEMATIC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab,tab==='draw'&&s.tabOn]} onPress={()=>setTab('draw')}>
          <Text style={[s.tabTxt,tab==='draw'&&s.tabTxtOn]}>✏ DRAW & SIM</Text>
        </TouchableOpacity>
      </View>
      <View style={s.content}>
        {tab==='schematic'&&<FenceSchematic/>}
        {tab==='draw'&&<DrawScreen/>}
      </View>
    </View>
  );
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0d1219'},
  tabBar:{flexDirection:'row',backgroundColor:'#111827',borderBottomWidth:1,borderBottomColor:'#1e293b',paddingTop:Platform.OS==='android'?4:0},
  tab:{flex:1,paddingVertical:10,alignItems:'center'},
  tabOn:{borderBottomWidth:2,borderBottomColor:'#f59e0b'},
  tabTxt:{color:'#64748b',fontSize:11,fontWeight:'700',letterSpacing:0.8},
  tabTxtOn:{color:'#f59e0b'},
  content:{flex:1},
});
