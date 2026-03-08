import React,{useEffect,useRef,useState}from'react';
import{View,Text,StyleSheet,Animated,Dimensions}from'react-native';
import Svg,{Line,Rect,Polygon,Circle,Defs,LinearGradient,Stop}from'react-native-svg';

const{width:SW,height:SH}=Dimensions.get('window');

const MSGS=['INITIALISING...','LOADING ENGINE...','CIRCUIT READY...','FENCE ONLINE ✓'];
const PCTS=[0,35,72,100];

export default function SplashScreen({onDone}:{onDone:()=>void}){
  const iconAnim=useRef(new Animated.Value(0)).current;
  const brandAnim=useRef(new Animated.Value(0)).current;
  const barAnim=useRef(new Animated.Value(0)).current;
  const boltScale=useRef(new Animated.Value(1)).current;
  const[msgIdx,setMsgIdx]=useState(0);
  const[pct,setPct]=useState(0);

  useEffect(()=>{
    Animated.sequence([
      Animated.timing(iconAnim,{toValue:1,duration:600,useNativeDriver:true}),
      Animated.timing(brandAnim,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(barAnim,{toValue:1,duration:2000,useNativeDriver:false}),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(boltScale,{toValue:1.15,duration:900,useNativeDriver:true}),
      Animated.timing(boltScale,{toValue:1,duration:900,useNativeDriver:true}),
    ])).start();

    let step=0;
    const cycle=()=>{
      if(step<MSGS.length){
        setMsgIdx(step);
        // animate pct
        const target=PCTS[step];
        let start=PCTS[Math.max(0,step-1)];
        const t0=Date.now();
        const dur=600;
        const tick=()=>{
          const p=Math.min((Date.now()-t0)/dur,1);
          setPct(Math.round(start+(target-start)*p));
          if(p<1)requestAnimationFrame(tick);
        };
        tick();
        step++;
        if(step<MSGS.length)setTimeout(cycle,700);
        else setTimeout(onDone,800);
      }
    };
    setTimeout(cycle,800);
  },[]);

  const iconTY=iconAnim.interpolate({inputRange:[0,1],outputRange:[-30,0]});
  const brandTY=brandAnim.interpolate({inputRange:[0,1],outputRange:[16,0]});
  const barW=barAnim.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
  const msg=MSGS[msgIdx];
  const isOk=msgIdx===3;

  return(
    <View style={st.root}>
      {/* Grid background */}
      <View style={st.grid}/>

      {/* Icon */}
      <Animated.View style={[st.iconWrap,{opacity:iconAnim,transform:[{translateY:iconTY}]}]}>
        <View style={st.iconBox}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Posts */}
            <Rect x="14" y="18" width="8" height="84" rx="3" fill="#2a3a4a" stroke="#3a5a6a" strokeWidth="1"/>
            <Rect x="98" y="18" width="8" height="84" rx="3" fill="#2a3a4a" stroke="#3a5a6a" strokeWidth="1"/>
            {/* HT wires */}
            {[28,42,56,70,84].filter((_,i)=>i%2===0).map((y,i)=>(
              <Line key={'ht'+i} x1="8" y1={y} x2="112" y2={y} stroke="#ef4444" strokeWidth="2.5" opacity={0.9}/>
            ))}
            {/* Earth wires */}
            {[35,49,63,77].map((y,i)=>(
              <Line key={'e'+i} x1="8" y1={y} x2="112" y2={y} stroke="#22c55e" strokeWidth="1.8" opacity={0.75}/>
            ))}
            {/* Energizer box */}
            <Rect x="44" y="44" width="32" height="32" rx="5" fill="#1a1200" stroke="#f59e0b" strokeWidth="2"/>
            {/* Bolt */}
            <Polygon points="64,50 56,62 62,62 52,76 68,58 62,58 70,50" fill="#f59e0b"/>
          </Svg>
        </View>
      </Animated.View>

      {/* Brand */}
      <Animated.View style={[st.brandWrap,{opacity:brandAnim,transform:[{translateY:brandTY}]}]}>
        <View style={st.brandRow}>
          <Text style={st.brandFence}>Fence</Text>
          <View style={st.dot}/>
          <Text style={st.brandSense}>Sense</Text>
        </View>
        <Text style={st.tagline}>ELECTRIC FENCE ANALYTICS</Text>
      </Animated.View>

      {/* Loader */}
      <Animated.View style={[st.loaderWrap,{opacity:brandAnim}]}>
        <View style={st.track}>
          <Animated.View style={[st.bar,{width:barW}]}/>
        </View>
        <View style={st.loaderRow}>
          <Text style={[st.statusTxt,isOk&&{color:'#22c55e'}]}>{msg}</Text>
          <Text style={st.pctTxt}>{pct}%</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const st=StyleSheet.create({
  root:{flex:1,backgroundColor:'#080d12',alignItems:'center',justifyContent:'center'},
  grid:{position:'absolute',inset:0,
    backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 47px,rgba(34,197,94,0.04) 48px),repeating-linear-gradient(90deg,transparent,transparent 47px,rgba(34,197,94,0.04) 48px)',
  } as any,
  iconWrap:{marginBottom:32},
  iconBox:{
    width:140,height:140,borderRadius:32,
    backgroundColor:'#0a0f1a',
    borderWidth:2,borderColor:'rgba(245,158,11,0.4)',
    alignItems:'center',justifyContent:'center',
    shadowColor:'#f59e0b',shadowOffset:{width:0,height:0},shadowRadius:24,shadowOpacity:0.3,
    elevation:12,
  },
  brandWrap:{alignItems:'center',gap:6},
  brandRow:{flexDirection:'row',alignItems:'center',gap:6},
  brandFence:{fontSize:48,fontWeight:'800',color:'#e2e8f0',letterSpacing:-1},
  brandSense:{fontSize:48,fontWeight:'800',color:'#f59e0b',letterSpacing:-1},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:'#ef4444'},
  tagline:{fontSize:11,color:'#475569',letterSpacing:3,fontFamily:'monospace',marginTop:4},
  loaderWrap:{marginTop:48,width:220,gap:8},
  track:{height:3,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden'},
  bar:{height:3,backgroundColor:'#f59e0b',borderRadius:2},
  loaderRow:{flexDirection:'row',justifyContent:'space-between'},
  statusTxt:{fontSize:10,color:'rgba(100,116,139,0.7)',fontFamily:'monospace',letterSpacing:1},
  pctTxt:{fontSize:10,color:'rgba(245,158,11,0.7)',fontFamily:'monospace'},
});
