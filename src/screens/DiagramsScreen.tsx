import React,{useState}from 'react';
import{View,Text,TouchableOpacity,ScrollView,StyleSheet,Dimensions,useWindowDimensions}from 'react-native';
import RenderHtml from 'react-native-render-html';

const C={bg:'#0d1219',panel:'#111827',border:'#1e293b',energizer:'#f59e0b',text:'#e2e8f0',muted:'#64748b',card:'#1a2332'};

const DIAGRAMS=[
  {id:'serpentine',title:'Serpentine Wiring',icon:'〰️',desc:'Standard security fence. HT (live) and Earth strands alternate. Bridges at END-L connect HT pairs. Bridges at END-R connect Earth pairs forming a continuous serpentine loop. Intruder bridging HT to Earth triggers alarm.'},
  {id:'gate_series',title:'Gate Series Contact',icon:'🚪',desc:'HT wires continue under the gate in underground conduit. Series gate contact breaks the circuit when gate opens — triggering alarm. Gate MUST be closed for fence to function. Contact wire max 100m from energizer.'},
  {id:'gate_bypass',title:'Gate Bypass Loop',icon:'🔁',desc:'Bypass wires loop each strand over the gate opening between gate posts. Fence stays fully active even when gate is open. Optional gate contact can alert when gate opens without disabling fence.'},
  {id:'corner',title:'Corner Post Wiring',icon:'📐',desc:'At 90° corners all strands turn using bridge clips. HT bridges to HT, Earth bridges to Earth. Two stay braces support the corner post — one per direction. Use stay lugs and clamps, never weld.'},
  {id:'energizer',title:'Energizer & Earthing',icon:'⚡',desc:'Energizer mounted indoors in ventilated area. HT live and earth return in SEPARATE conduits. Lightning diverter at fence entry. Minimum 3 earth spikes at energizer: 1.2m deep, 3m apart. Additional spikes every 30m along fence. Per SANS 10222-3.'},
  {id:'multizone',title:'Two-Zone Fence',icon:'🔀',desc:'Single energizer with Smart I/O zone card drives two independent zones. Each zone monitored separately — alarm identifies exact breach location. Critical for large or L-shaped properties.'},
];

const getSvg=(id:string):string=>{
  const svgs:Record<string,string>={
    serpentine:`<svg viewBox="0 0 500 270" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="270" fill="#0a0f16" rx="8"/>
<rect x="8" y="75" width="58" height="120" rx="6" fill="#111827" stroke="#f59e0b" stroke-width="2"/>
<text x="37" y="98" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">ENERGIZER</text>
<circle cx="37" cy="120" r="10" fill="#1a2332" stroke="#ef4444" stroke-width="2"/><text x="37" y="124" text-anchor="middle" fill="#ef4444" font-size="7">HT</text>
<circle cx="37" cy="148" r="10" fill="#1a2332" stroke="#22c55e" stroke-width="2"/><text x="37" y="152" text-anchor="middle" fill="#22c55e" font-size="7">E</text>
${[100,185,270,355,440].map((x,i)=>`<rect x="${x-5}" y="52" width="10" height="180" rx="3" fill="#475569" stroke="#64748b" stroke-width="1"/><text x="${x}" y="43" text-anchor="middle" fill="#94a3b8" font-size="9">${i===0?'END-L':i===4?'END-R':'P'+i}</text>`).join('')}
${[0,1,2,3,4,5,6,7].map(si=>{const y=62+si*18;const col=si%2===0?'#ef4444':'#22c55e';return`<line x1="66" y1="${y}" x2="445" y2="${y}" stroke="${col}" stroke-width="2.5"/><text x="460" y="${y+4}" fill="${col}" font-size="8">${si%2===0?'HT':'E'}${Math.floor(si/2)+1}</text>`;}).join('')}
<path d="M95,62 Q78,71 78,80 Q78,89 95,98" stroke="#ef4444" stroke-width="2.5" fill="none"/>
<path d="M95,98 Q78,107 78,116 Q78,125 95,134" stroke="#ef4444" stroke-width="2.5" fill="none"/>
<path d="M95,134 Q78,143 78,152 Q78,161 95,170" stroke="#ef4444" stroke-width="2.5" fill="none"/>
<path d="M445,80 Q462,89 462,98 Q462,107 445,116" stroke="#22c55e" stroke-width="2.5" fill="none"/>
<path d="M445,116 Q462,125 462,134 Q462,143 445,152" stroke="#22c55e" stroke-width="2.5" fill="none"/>
<path d="M445,152 Q462,161 462,170 Q462,179 445,188" stroke="#22c55e" stroke-width="2.5" fill="none"/>
<text x="72" y="48" text-anchor="middle" fill="#ef4444" font-size="7" transform="rotate(-90,72,48)">HT BRIDGES</text>
<text x="468" y="160" text-anchor="middle" fill="#22c55e" font-size="7" transform="rotate(90,468,160)">EARTH BRIDGES</text>
${[20,33,46].map(x=>`<line x1="${x}" y1="200" x2="${x}" y2="228" stroke="#22c55e" stroke-width="2.5"/><line x1="${x-6}" y1="228" x2="${x+6}" y2="228" stroke="#22c55e" stroke-width="2"/><line x1="${x-3}" y1="234" x2="${x+3}" y2="234" stroke="#22c55e" stroke-width="1.5"/>`).join('')}
<text x="33" y="248" text-anchor="middle" fill="#22c55e" font-size="8">3x EARTH SPIKES (1.2m deep)</text>
<line x1="66" y1="120" x2="93" y2="62" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
<line x1="66" y1="148" x2="93" y2="80" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4,3"/>
</svg>`,

    gate_series:`<svg viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="280" fill="#0a0f16" rx="8"/>
${[60,168,308,440].map((x,i)=>`<rect x="${x-5}" y="45" width="10" height="185" rx="3" fill="${i===1||i===2?'#6d28d9':'#475569'}" stroke="${i===1||i===2?'#a78bfa':'#64748b'}" stroke-width="1.5"/><text x="${x}" y="36" text-anchor="middle" fill="${i===1||i===2?'#a78bfa':'#94a3b8'}" font-size="9">${i===0?'END-L':i===1?'GATE-L':i===2?'GATE-R':'END-R'}</text>`).join('')}
<rect x="173" y="45" width="130" height="185" fill="#1a0a2e" opacity="0.5"/>
<text x="238" y="145" text-anchor="middle" fill="#6d28d9" font-size="9" font-style="italic">GATE OPENING</text>
${[0,1,2,3,4,5].map(si=>{const y=60+si*24;const col=si%2===0?'#ef4444':'#22c55e';return`<line x1="65" y1="${y}" x2="163" y2="${y}" stroke="${col}" stroke-width="2.5"/><line x1="313" y1="${y}" x2="445" y2="${y}" stroke="${col}" stroke-width="2.5"/><circle cx="163" cy="${y}" r="4" fill="${col}"/><circle cx="313" cy="${y}" r="4" fill="${col}"/>`;}).join('')}
<rect x="173" y="242" width="130" height="12" rx="3" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
<text x="238" y="252" text-anchor="middle" fill="#94a3b8" font-size="7.5">HT CABLE IN CONDUIT (underground)</text>
${[0,2,4].map(si=>{const y=60+si*24;return`<line x1="168" y1="${y}" x2="168" y2="242" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="308" y1="${y}" x2="308" y2="242" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,3"/>`;}).join('')}
<rect x="205" y="95" width="66" height="52" rx="6" fill="#1a0a2e" stroke="#a78bfa" stroke-width="2"/>
<text x="238" y="114" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="bold">GATE</text>
<text x="238" y="127" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="bold">CONTACT</text>
<rect x="193" y="158" width="90" height="20" rx="4" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
<text x="238" y="172" text-anchor="middle" fill="#ef4444" font-size="8" font-weight="bold">OPEN = ALARM</text>
<path d="M55,60 Q40,72 40,84 Q40,96 55,108" stroke="#ef4444" stroke-width="2" fill="none"/>
<path d="M55,108 Q40,120 40,132 Q40,144 55,156" stroke="#ef4444" stroke-width="2" fill="none"/>
<path d="M445,84 Q460,96 460,108 Q460,120 445,132" stroke="#22c55e" stroke-width="2" fill="none"/>
<path d="M445,132 Q460,144 460,156 Q460,168 445,180" stroke="#22c55e" stroke-width="2" fill="none"/>
<text x="250" y="270" text-anchor="middle" fill="#64748b" font-size="7.5">Contact wire must NOT run parallel to HT cable</text>
</svg>`,

    gate_bypass:`<svg viewBox="0 0 500 270" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="270" fill="#0a0f16" rx="8"/>
${[60,163,318,440].map((x,i)=>`<rect x="${x-5}" y="55" width="10" height="175" rx="3" fill="${i===1||i===2?'#6d28d9':'#475569'}" stroke="${i===1||i===2?'#a78bfa':'#64748b'}" stroke-width="1.5"/><text x="${x}" y="45" text-anchor="middle" fill="${i===1||i===2?'#a78bfa':'#94a3b8'}" font-size="9">${i===0?'END-L':i===1?'GATE-L':i===2?'GATE-R':'END-R'}</text>`).join('')}
<rect x="168" y="55" width="145" height="175" fill="#0a1a0a" opacity="0.5"/>
<text x="240" y="155" text-anchor="middle" fill="#1a4a1a" font-size="10">GATE OPENING</text>
${[0,1,2,3,4,5].map(si=>{const y=68+si*24;const col=si%2===0?'#ef4444':'#22c55e';const lift=28+si*5;return`<line x1="65" y1="${y}" x2="158" y2="${y}" stroke="${col}" stroke-width="2.5"/><line x1="323" y1="${y}" x2="445" y2="${y}" stroke="${col}" stroke-width="2.5"/><path d="M158,${y} Q240,${y-lift} 323,${y}" stroke="${col}" stroke-width="2" fill="none" stroke-dasharray="5,3"/>`;}).join('')}
<rect x="178" y="18" width="124" height="16" rx="4" fill="#0a1a0a" stroke="#22c55e" stroke-width="1"/>
<text x="240" y="30" text-anchor="middle" fill="#22c55e" font-size="8">BYPASS LOOPS (over gate)</text>
<rect x="205" y="195" width="70" height="24" rx="5" fill="#111827" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="4,2"/>
<text x="240" y="206" text-anchor="middle" fill="#a78bfa" font-size="7.5">OPTIONAL</text>
<text x="240" y="216" text-anchor="middle" fill="#a78bfa" font-size="7.5">Gate Contact</text>
<path d="M55,68 Q40,80 40,92 Q40,104 55,116" stroke="#ef4444" stroke-width="2" fill="none"/>
<path d="M55,116 Q40,128 40,140 Q40,152 55,164" stroke="#ef4444" stroke-width="2" fill="none"/>
<path d="M445,92 Q460,104 460,116 Q460,128 445,140" stroke="#22c55e" stroke-width="2" fill="none"/>
<path d="M445,140 Q460,152 460,164 Q460,176 445,188" stroke="#22c55e" stroke-width="2" fill="none"/>
<text x="250" y="260" text-anchor="middle" fill="#64748b" font-size="7.5">Fence remains active and alarmed even when gate is open</text>
</svg>`,

    corner:`<svg viewBox="0 0 460 300" xmlns="http://www.w3.org/2000/svg">
<rect width="460" height="300" fill="#0a0f16" rx="8"/>
<rect x="200" y="105" width="18" height="18" rx="3" fill="#64748b" stroke="#94a3b8" stroke-width="2"/>
<text x="209" y="96" text-anchor="middle" fill="#e2e8f0" font-size="10" font-weight="bold">CORNER POST</text>
<line x1="209" y1="115" x2="125" y2="195" stroke="#475569" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
<text x="130" y="210" fill="#64748b" font-size="8">STAY BRACE</text>
<line x1="209" y1="115" x2="295" y2="195" stroke="#475569" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
<text x="280" y="210" fill="#64748b" font-size="8">STAY BRACE</text>
${[0,1,2,3,4,5].map(si=>{const y=62+si*22;const col=si%2===0?'#ef4444':'#22c55e';return`<line x1="18" y1="${y}" x2="200" y2="${y}" stroke="${col}" stroke-width="2.5"/><circle cx="18" cy="${y}" r="3" fill="${col}"/>`;}).join('')}
${[0,1,2,3,4,5].map(si=>{const x=242+si*22;const col=si%2===0?'#ef4444':'#22c55e';return`<line x1="${x}" y1="123" x2="${x}" y2="285" stroke="${col}" stroke-width="2.5"/><circle cx="${x}" cy="285" r="3" fill="${col}"/>`;}).join('')}
${[0,1,2,3,4,5].map(si=>{const y=62+si*22;const x=242+si*22;const col=si%2===0?'#ef4444':'#22c55e';return`<path d="M200,${y} Q${x},${y} ${x},123" stroke="${col}" stroke-width="2" fill="none" stroke-dasharray="4,2"/>`;}).join('')}
<text x="100" y="42" text-anchor="middle" fill="#94a3b8" font-size="9">FENCE SECTION A →</text>
<text x="370" y="200" text-anchor="middle" fill="#94a3b8" font-size="9" transform="rotate(90,370,200)">↓ FENCE SECTION B</text>
<rect x="218" y="60" width="36" height="14" rx="3" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
<text x="236" y="70" text-anchor="middle" fill="#ef4444" font-size="7">HT → HT</text>
<rect x="218" y="78" width="42" height="14" rx="3" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
<text x="239" y="88" text-anchor="middle" fill="#22c55e" font-size="7">EARTH → E</text>
<text x="230" y="292" text-anchor="middle" fill="#64748b" font-size="7.5">Stay lugs used — never weld stays to posts</text>
</svg>`,

    energizer:`<svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="320" fill="#0a0f16" rx="8"/>
<rect x="8" y="28" width="108" height="165" rx="6" fill="#111827" stroke="#1e293b" stroke-width="2"/>
<text x="62" y="46" text-anchor="middle" fill="#475569" font-size="8">BUILDING</text>
<rect x="18" y="55" width="88" height="98" rx="6" fill="#1a2332" stroke="#f59e0b" stroke-width="2.5"/>
<text x="62" y="74" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">ENERGIZER</text>
<rect x="26" y="80" width="72" height="16" rx="3" fill="#111827" stroke="#f59e0b" stroke-width="1"/>
<text x="62" y="92" text-anchor="middle" fill="#f59e0b" font-size="7">LCD DISPLAY</text>
<rect x="26" y="104" width="32" height="14" rx="2" fill="#7f1d1d" stroke="#ef4444" stroke-width="1.5"/>
<text x="42" y="115" text-anchor="middle" fill="#ef4444" font-size="7">FENCE+</text>
<rect x="62" y="104" width="32" height="14" rx="2" fill="#14532d" stroke="#22c55e" stroke-width="1.5"/>
<text x="78" y="115" text-anchor="middle" fill="#22c55e" font-size="7">EARTH</text>
<rect x="26" y="124" width="72" height="14" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
<text x="62" y="135" text-anchor="middle" fill="#64748b" font-size="7">220V MAINS</text>
<rect x="116" y="104" width="175" height="12" rx="3" fill="#2d1515" stroke="#ef4444" stroke-width="1.5"/>
<text x="203" y="114" text-anchor="middle" fill="#ef4444" font-size="7.5">HT LIVE — CONDUIT A</text>
<line x1="58" y1="111" x2="116" y2="110" stroke="#ef4444" stroke-width="2"/>
<rect x="116" y="122" width="175" height="12" rx="3" fill="#0d2d15" stroke="#22c55e" stroke-width="1.5"/>
<text x="203" y="132" text-anchor="middle" fill="#22c55e" font-size="7.5">EARTH RETURN — CONDUIT B</text>
<line x1="78" y1="118" x2="116" y2="128" stroke="#22c55e" stroke-width="2"/>
<rect x="128" y="140" width="152" height="14" rx="3" fill="#451a03" stroke="#f97316" stroke-width="1.5"/>
<text x="204" y="151" text-anchor="middle" fill="#f97316" font-size="7.5" font-weight="bold">NEVER IN SAME CONDUIT!</text>
<circle cx="318" cy="110" r="14" fill="#1a2332" stroke="#f59e0b" stroke-width="2"/>
<text x="318" y="107" text-anchor="middle" fill="#f59e0b" font-size="6.5" font-weight="bold">LGHT</text>
<text x="318" y="117" text-anchor="middle" fill="#f59e0b" font-size="6.5">DIV</text>
<line x1="291" y1="110" x2="304" y2="110" stroke="#ef4444" stroke-width="2"/>
<line x1="332" y1="110" x2="352" y2="110" stroke="#ef4444" stroke-width="2"/>
<rect x="352" y="55" width="12" height="210" rx="3" fill="#475569" stroke="#64748b" stroke-width="1.5"/>
<text x="358" y="46" text-anchor="middle" fill="#94a3b8" font-size="9">FENCE</text>
${[0,1,2,3,4,5].map(si=>{const y=68+si*22;const col=si%2===0?'#ef4444':'#22c55e';return`<line x1="364" y1="${y}" x2="490" y2="${y}" stroke="${col}" stroke-width="2"/>`;}).join('')}
<line x1="332" y1="110" x2="362" y2="75" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,2"/>
<line x1="291" y1="128" x2="362" y2="97" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="3,2"/>
${[22,46,70].map((x,i)=>`<line x1="${x}" y1="195" x2="${x}" y2="232" stroke="#22c55e" stroke-width="3"/><line x1="${x-7}" y1="232" x2="${x+7}" y2="232" stroke="#22c55e" stroke-width="2.5"/><line x1="${x-4}" y1="239" x2="${x+4}" y2="239" stroke="#22c55e" stroke-width="2"/><line x1="${x-2}" y1="245" x2="${x+2}" y2="245" stroke="#22c55e" stroke-width="1.5"/><text x="${x}" y="258" text-anchor="middle" fill="#22c55e" font-size="7">S${i+1}</text>`).join('')}
<line x1="78" y1="153" x2="46" y2="195" stroke="#22c55e" stroke-width="2"/>
<rect x="8" y="264" width="100" height="30" rx="4" fill="#0d2d15" stroke="#22c55e" stroke-width="1"/>
<text x="58" y="277" text-anchor="middle" fill="#22c55e" font-size="7">3 SPIKES MINIMUM</text>
<text x="58" y="288" text-anchor="middle" fill="#22c55e" font-size="7">1.2m DEEP • 3m APART</text>
${[420,460].map(x=>`<line x1="${x}" y1="272" x2="${x}" y2="295" stroke="#22c55e" stroke-width="2"/><line x1="${x-5}" y1="295" x2="${x+5}" y2="295" stroke="#22c55e" stroke-width="1.5"/><text x="${x}" y="308" text-anchor="middle" fill="#22c55e" font-size="7">30m</text>`).join('')}
<text x="440" y="265" text-anchor="middle" fill="#64748b" font-size="7">Spikes every 30m along fence</text>
<text x="250" y="315" text-anchor="middle" fill="#475569" font-size="7">SANS 10222-3 — COC required for all installations</text>
</svg>`,

    multizone:`<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="300" fill="#0a0f16" rx="8"/>
<rect x="10" y="110" width="78" height="80" rx="6" fill="#1a2332" stroke="#f59e0b" stroke-width="2.5"/>
<text x="49" y="132" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">ENERGIZER</text>
<rect x="18" y="138" width="62" height="12" rx="2" fill="#111827" stroke="#f59e0b" stroke-width="1"/>
<text x="49" y="148" text-anchor="middle" fill="#f59e0b" font-size="7">DRUID LCD</text>
<rect x="18" y="156" width="28" height="12" rx="2" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
<text x="32" y="165" text-anchor="middle" fill="#ef4444" font-size="6.5">Z1 OUT</text>
<rect x="50" y="156" width="28" height="12" rx="2" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1"/>
<text x="64" y="165" text-anchor="middle" fill="#60a5fa" font-size="6.5">Z2 OUT</text>
<rect x="108" y="100" width="72" height="100" rx="6" fill="#111827" stroke="#60a5fa" stroke-width="2"/>
<text x="144" y="120" text-anchor="middle" fill="#60a5fa" font-size="8" font-weight="bold">SMART I/O</text>
<text x="144" y="133" text-anchor="middle" fill="#60a5fa" font-size="8">ZONE CARD</text>
<line x1="88" y1="162" x2="108" y2="150" stroke="#f59e0b" stroke-width="2"/>
<circle cx="180" cy="138" r="5" fill="#ef4444"/><text x="190" y="142" fill="#ef4444" font-size="7">Z1 HT+</text>
<circle cx="180" cy="153" r="5" fill="#22c55e"/><text x="190" y="157" fill="#22c55e" font-size="7">Z1 EARTH</text>
<circle cx="180" cy="168" r="5" fill="#60a5fa"/><text x="190" y="172" fill="#60a5fa" font-size="7">Z2 HT+</text>
<circle cx="180" cy="183" r="5" fill="#a78bfa"/><text x="190" y="187" fill="#a78bfa" font-size="7">Z2 EARTH</text>
<rect x="6" y="14" width="488" height="10" rx="2" fill="#7f1d1d" opacity="0.3"/>
<text x="250" y="12" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">ZONE 1 — Front Perimeter</text>
${[22,34,46,58,70,82].map((y,si)=>`<line x1="220" y1="${y}" x2="490" y2="${y}" stroke="${si%2===0?'#ef4444':'#22c55e'}" stroke-width="2"/>`).join('')}
${[280,350,420].map(x=>`<rect x="${x-4}" y="14" width="8" height="75" rx="2" fill="#475569" opacity="0.8"/>`).join('')}
<line x1="185" y1="138" x2="220" y2="50" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
<line x1="185" y1="153" x2="220" y2="62" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4,3"/>
<rect x="220" y="14" width="65" height="13" rx="3" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
<text x="252" y="24" text-anchor="middle" fill="#ef4444" font-size="7">ZONE 1 ALARM</text>
<rect x="6" y="210" width="488" height="10" rx="2" fill="#1e3a5f" opacity="0.3"/>
<text x="250" y="208" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="bold">ZONE 2 — Rear / Side Perimeter</text>
${[222,234,246,258,270,282].map((y,si)=>`<line x1="220" y1="${y}" x2="490" y2="${y}" stroke="${si%2===0?'#60a5fa':'#a78bfa'}" stroke-width="2"/>`).join('')}
${[280,350,420].map(x=>`<rect x="${x-4}" y="214" width="8" height="75" rx="2" fill="#475569" opacity="0.8"/>`).join('')}
<line x1="185" y1="168" x2="220" y2="246" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="4,3"/>
<line x1="185" y1="183" x2="220" y2="258" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="4,3"/>
<rect x="220" y="210" width="65" height="13" rx="3" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1"/>
<text x="252" y="220" text-anchor="middle" fill="#60a5fa" font-size="7">ZONE 2 ALARM</text>
<text x="250" y="295" text-anchor="middle" fill="#64748b" font-size="7.5">Each zone independently monitored — alarm identifies exact breach location</text>
</svg>`,
  };
  return svgs[id]||'';
};

const LEGENDS:Record<string,string[][]>={
  serpentine:[['#ef4444','HT Live Wire'],['#22c55e','Earth Wire'],['#475569','Fence Post'],['#f59e0b','Energizer']],
  gate_series:[['#ef4444','HT Live'],['#22c55e','Earth'],['#a78bfa','Gate Post/Contact'],['#94a3b8','Conduit']],
  gate_bypass:[['#ef4444','HT Live'],['#22c55e','Earth'],['#a78bfa','Gate Posts'],['#60a5fa','Bypass Loop']],
  corner:[['#ef4444','HT Live'],['#22c55e','Earth'],['#475569','Stay Brace'],['#3b82f6','Bridge Clip']],
  energizer:[['#ef4444','HT Live (Conduit A)'],['#22c55e','Earth Return (Conduit B)'],['#f59e0b','Energizer/Diverter'],['#f97316','Safety Warning']],
  multizone:[['#ef4444','Zone 1 HT'],['#22c55e','Zone 1 Earth'],['#60a5fa','Zone 2 HT'],['#a78bfa','Zone 2 Earth']],
};

export default function DiagramsScreen(){
  const[sel,setSel]=useState('serpentine');
  const{width}=useWindowDimensions();
  const diag=DIAGRAMS.find(d=>d.id===sel)!;
  const svg=getSvg(sel);
  const legend=LEGENDS[sel]||[];
  const source={html:`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0f16;padding:8px;}svg{width:100%;height:auto;display:block;}</style></head><body>${svg}</body></html>`};
  return(
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>📐 DIAGRAMS</Text>
        <Text style={s.subtitle}>Electric Fence Wiring Reference</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={{paddingHorizontal:8,paddingVertical:8,gap:6}}>
        {DIAGRAMS.map(d=>(
          <TouchableOpacity key={d.id} style={[s.tab,sel===d.id&&s.tabOn]} onPress={()=>setSel(d.id)}>
            <Text style={s.tabIcon}>{d.icon}</Text>
            <Text style={[s.tabTxt,sel===d.id&&{color:C.energizer}]}>{d.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={s.body} contentContainerStyle={{padding:12,paddingBottom:40}}>
        <View style={s.diagCard}>
          <Text style={s.diagTitle}>{diag.icon}  {diag.title}</Text>
          <RenderHtml contentWidth={width-24} source={source} baseStyle={{backgroundColor:'#0a0f16'}}/>
          <View style={s.legend}>
            {legend.map(([col,lbl])=>(
              <View key={lbl} style={s.legendItem}>
                <View style={[s.legendDot,{backgroundColor:col}]}/>
                <Text style={s.legendTxt}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s.descCard}>
          <Text style={s.descTitle}>HOW IT WORKS</Text>
          <Text style={s.desc}>{diag.desc}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  header:{padding:16,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.panel},
  title:{fontSize:18,fontWeight:'bold',color:C.energizer,letterSpacing:2},
  subtitle:{fontSize:12,color:C.muted,marginTop:2},
  tabs:{flexGrow:0,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.panel},
  tab:{backgroundColor:C.card,borderRadius:8,paddingHorizontal:12,paddingVertical:8,alignItems:'center',minWidth:90,borderWidth:1,borderColor:C.border},
  tabOn:{borderColor:C.energizer,backgroundColor:'#1a1500'},
  tabIcon:{fontSize:16},
  tabTxt:{color:C.muted,fontSize:10,marginTop:2,textAlign:'center'},
  body:{flex:1},
  diagCard:{backgroundColor:C.card,borderRadius:12,padding:12,borderWidth:1,borderColor:C.border,marginBottom:12},
  diagTitle:{color:C.text,fontSize:15,fontWeight:'bold',marginBottom:10},
  legend:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:10},
  legendItem:{flexDirection:'row',alignItems:'center',gap:4},
  legendDot:{width:10,height:10,borderRadius:5},
  legendTxt:{color:C.muted,fontSize:11},
  descCard:{backgroundColor:C.card,borderRadius:12,padding:16,borderWidth:1,borderColor:C.border},
  descTitle:{color:C.energizer,fontSize:10,fontWeight:'bold',letterSpacing:2,marginBottom:8},
  desc:{color:C.text,fontSize:13,lineHeight:20},
});
