import React,{useState}from 'react';
import{View,Text,TouchableOpacity,ScrollView,StyleSheet,Dimensions}from 'react-native';
import{WebView}from 'react-native-webview';

const SW=Dimensions.get('window').width;

const C={bg:'#0d1219',panel:'#111827',border:'#1e293b',energizer:'#f59e0b',text:'#e2e8f0',muted:'#64748b',card:'#1a2332'};

const DIAGRAMS=[
  {id:'serpentine',title:'Serpentine Wiring',icon:'〰️'},
  {id:'gate_series',title:'Gate Series Contact',icon:'🚪'},
  {id:'gate_bypass',title:'Gate Bypass Loop',icon:'🔁'},
  {id:'corner',title:'Corner Post',icon:'📐'},
  {id:'energizer',title:'Energizer & Earthing',icon:'⚡'},
  {id:'multizone',title:'Two-Zone Fence',icon:'🔀'},
];

const makeHtml=(id:string)=>`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0a0f16;font-family:'Courier New',monospace;color:#e2e8f0;padding:12px;}
svg{width:100%;height:auto;display:block;}
.title{color:#f59e0b;font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-transform:uppercase;}
.desc{color:#94a3b8;font-size:11px;line-height:1.6;margin-top:10px;padding:10px;background:#111827;border-radius:6px;border-left:3px solid #f59e0b;}
.legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;}
.leg{display:flex;align-items:center;gap:5px;font-size:10px;color:#94a3b8;}
.dot{width:10px;height:10px;border-radius:50%;}
</style>
</head>
<body>
${getDiagram(id)}
</body>
</html>`;

function getDiagram(id:string):string{
  switch(id){
    case 'serpentine': return serpentineHtml();
    case 'gate_series': return gateSeriesHtml();
    case 'gate_bypass': return gateBypassHtml();
    case 'corner': return cornerHtml();
    case 'energizer': return energizerHtml();
    case 'multizone': return multizoneHtml();
    default: return '';
  }
}

function serpentineHtml():string{return `
<div class="title">〰 Serpentine Wiring — Standard Security Fence</div>
<svg viewBox="0 0 500 280" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b"/>
    </marker>
  </defs>
  <!-- Background grid -->
  <rect width="500" height="280" fill="#0a0f16" rx="8"/>
  <line x1="0" y1="240" x2="500" y2="240" stroke="#1e293b" stroke-width="1"/>

  <!-- Energizer unit -->
  <rect x="8" y="80" width="58" height="120" rx="6" fill="#111827" stroke="#f59e0b" stroke-width="2"/>
  <rect x="14" y="86" width="46" height="32" rx="3" fill="#1a2332" stroke="#f59e0b" stroke-width="1"/>
  <text x="37" y="106" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="bold">ENERGIZER</text>
  <circle cx="37" cy="135" r="12" fill="#1a2332" stroke="#ef4444" stroke-width="2"/>
  <text x="37" y="139" text-anchor="middle" fill="#ef4444" font-size="7">HT</text>
  <circle cx="37" cy="165" r="12" fill="#1a2332" stroke="#22c55e" stroke-width="2"/>
  <text x="37" y="169" text-anchor="middle" fill="#22c55e" font-size="7">EARTH</text>

  <!-- Posts: END-L, P1, P2, P3, END-R -->
  ${[100,190,280,370,450].map((x,i)=>`
  <rect x="${x-6}" y="55" width="12" height="185" rx="3" fill="#475569" stroke="#64748b" stroke-width="1"/>
  <text x="${x}" y="46" text-anchor="middle" fill="#94a3b8" font-size="9">${i===0?'END-L':i===4?'END-R':'P'+(i)}</text>
  <rect x="${x-8}" y="228" width="16" height="8" rx="2" fill="#374151" stroke="#475569" stroke-width="1"/>
  `).join('')}

  <!-- 8 strands: HT=red(0,2,4,6) Earth=green(1,3,5,7) -->
  ${[0,1,2,3,4,5,6,7].map(si=>{
    const y=68+si*20;
    const col=si%2===0?'#ef4444':'#22c55e';
    const lbl=si%2===0?`HT${Math.floor(si/2)+1}`:`E${Math.floor(si/2)+1}`;
    return `
  <line x1="66" y1="${y}" x2="456" y2="${y}" stroke="${col}" stroke-width="2.5"/>
  <text x="470" y="${y+4}" fill="${col}" font-size="8">${lbl}</text>
  <circle cx="100" cy="${y}" r="3" fill="${col}"/>
  <circle cx="450" cy="${y}" r="3" fill="${col}"/>`;
  }).join('')}

  <!-- END-L bridges: connect HT pairs 0-2, 2-4, 4-6 (left side) -->
  <path d="M94,68 Q78,78 78,88 Q78,98 94,108" stroke="#ef4444" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M94,108 Q78,118 78,128 Q78,138 94,148" stroke="#ef4444" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M94,148 Q78,158 78,168 Q78,178 94,188" stroke="#ef4444" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <text x="62" y="135" text-anchor="middle" fill="#ef4444" font-size="8" transform="rotate(-90,62,135)">HT BRIDGES</text>

  <!-- END-R bridges: connect Earth pairs 1-3, 3-5, 5-7 (right side) -->
  <path d="M456,88 Q472,98 472,108 Q472,118 456,128" stroke="#22c55e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M456,128 Q472,138 472,148 Q472,158 456,168" stroke="#22c55e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M456,168 Q472,178 472,188 Q472,198 456,208" stroke="#22c55e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <text x="486" y="155" text-anchor="middle" fill="#22c55e" font-size="8" transform="rotate(90,486,155)">EARTH BRIDGES</text>

  <!-- Earth spikes at energizer -->
  ${[20,33,46].map((x,i)=>`
  <line x1="${x}" y1="208" x2="${x}" y2="236" stroke="#22c55e" stroke-width="2.5"/>
  <line x1="${x-6}" y1="236" x2="${x+6}" y2="236" stroke="#22c55e" stroke-width="2"/>
  <line x1="${x-4}" y1="241" x2="${x+4}" y2="241" stroke="#22c55e" stroke-width="1.5"/>
  <line x1="${x-2}" y1="246" x2="${x+2}" y2="246" stroke="#22c55e" stroke-width="1"/>
  `).join('')}
  <text x="33" y="258" text-anchor="middle" fill="#22c55e" font-size="8">3× EARTH SPIKES (1.2m)</text>

  <!-- Connection lines from energizer to fence -->
  <line x1="66" y1="135" x2="94" y2="68" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <line x1="66" y1="165" x2="94" y2="88" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4,3"/>
</svg>
<div class="legend">
  <div class="leg"><div class="dot" style="background:#ef4444"></div>HT Live Wire</div>
  <div class="leg"><div class="dot" style="background:#22c55e"></div>Earth Wire</div>
  <div class="leg"><div class="dot" style="background:#475569"></div>Fence Post</div>
  <div class="leg"><div class="dot" style="background:#f59e0b"></div>Energizer</div>
</div>
<div class="desc">Standard security fence wiring. HT (live) and Earth strands alternate. Bridges at END-L connect HT→HT pairs. Bridges at END-R connect Earth→Earth pairs forming a continuous serpentine loop. An intruder bridging any HT to Earth strand completes the circuit and triggers the alarm.</div>`;}

function gateSeriesHtml():string{return `
<div class="title">🚪 Gate — Series Contact Wiring</div>
<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="300" fill="#0a0f16" rx="8"/>

  <!-- Fence posts -->
  ${[60,170,310,430].map((x,i)=>`
  <rect x="${x-6}" y="50" width="12" height="185" rx="3" fill="${i===1||i===2?'#6d28d9':'#475569'}" stroke="${i===1||i===2?'#a78bfa':'#64748b'}" stroke-width="1.5"/>
  <text x="${x}" y="40" text-anchor="middle" fill="${i===1||i===2?'#a78bfa':'#94a3b8'}" font-size="9">${i===0?'END-L':i===1?'GATE-L':i===2?'GATE-R':'END-R'}</text>
  `).join('')}

  <!-- Gate opening indicator -->
  <rect x="176" y="50" width="128" height="185" fill="#1a0a2e" rx="0" opacity="0.5"/>
  <text x="240" y="145" text-anchor="middle" fill="#6d28d9" font-size="10" font-style="italic">GATE OPENING</text>
  <line x1="176" y1="50" x2="176" y2="235" stroke="#6d28d9" stroke-width="1" stroke-dasharray="4,3"/>
  <line x1="308" y1="50" x2="308" y2="235" stroke="#6d28d9" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Strands left and right of gate -->
  ${[0,1,2,3,4,5].map(si=>{
    const y=65+si*26;
    const col=si%2===0?'#ef4444':'#22c55e';
    return `
  <line x1="66" y1="${y}" x2="164" y2="${y}" stroke="${col}" stroke-width="2.5"/>
  <line x1="316" y1="${y}" x2="436" y2="${y}" stroke="${col}" stroke-width="2.5"/>
  <circle cx="164" cy="${y}" r="4" fill="${col}"/>
  <circle cx="316" cy="${y}" r="4" fill="${col}"/>`;
  }).join('')}

  <!-- HT cables under gate in conduit -->
  <rect x="176" y="248" width="132" height="14" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
  <text x="242" y="259" text-anchor="middle" fill="#94a3b8" font-size="8">HT CABLE IN CONDUIT (underground)</text>

  <!-- Vertical drops to conduit -->
  ${[0,2,4].map(si=>{
    const y=65+si*26;
    return `
  <line x1="170" y1="${y}" x2="170" y2="248" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,3"/>
  <line x1="314" y1="${y}" x2="314" y2="248" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,3"/>`;
  }).join('')}

  <!-- Gate contact unit -->
  <rect x="210" y="100" width="60" height="50" rx="6" fill="#1a0a2e" stroke="#a78bfa" stroke-width="2"/>
  <text x="240" y="120" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="bold">GATE</text>
  <text x="240" y="133" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="bold">CONTACT</text>
  <circle cx="218" cy="141" r="4" fill="none" stroke="#a78bfa" stroke-width="1.5"/>
  <circle cx="262" cy="141" r="4" fill="none" stroke="#a78bfa" stroke-width="1.5"/>
  <line x1="222" y1="141" x2="258" y2="141" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="3,2"/>

  <!-- Alarm indicator -->
  <rect x="195" y="165" width="90" height="22" rx="4" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
  <text x="240" y="180" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">⚠ OPEN = ALARM</text>

  <!-- Bridges at ends -->
  <path d="M54,65 Q40,78 40,91 Q40,104 54,117" stroke="#ef4444" stroke-width="2" fill="none"/>
  <path d="M54,117 Q40,130 40,143 Q40,156 54,169" stroke="#ef4444" stroke-width="2" fill="none"/>
  <path d="M436,91 Q450,104 450,117 Q450,130 436,143" stroke="#22c55e" stroke-width="2" fill="none"/>
  <path d="M436,143 Q450,156 450,169 Q450,182 436,195" stroke="#22c55e" stroke-width="2" fill="none"/>

  <text x="250" y="285" text-anchor="middle" fill="#64748b" font-size="8">Gate contact wire max 100m from energizer — run separate from HT wire</text>
</svg>
<div class="legend">
  <div class="leg"><div class="dot" style="background:#ef4444"></div>HT Live</div>
  <div class="leg"><div class="dot" style="background:#22c55e"></div>Earth</div>
  <div class="leg"><div class="dot" style="background:#a78bfa"></div>Gate Post / Contact</div>
  <div class="leg"><div class="dot" style="background:#94a3b8"></div>Conduit (underground)</div>
</div>
<div class="desc">HT wires continue under the gate in underground conduit. A series gate contact is wired into the fence circuit — when the gate opens the contact opens, breaking the circuit and triggering the alarm. The gate MUST be closed for the fence to function. Gate contact wire must not run parallel to HT cable.</div>`;}

function gateBypassHtml():string{return `
<div class="title">🔁 Gate — Bypass Loop Wiring</div>
<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="300" fill="#0a0f16" rx="8"/>

  ${[60,165,315,440].map((x,i)=>`
  <rect x="${x-6}" y="50" width="12" height="185" rx="3" fill="${i===1||i===2?'#6d28d9':'#475569'}" stroke="${i===1||i===2?'#a78bfa':'#64748b'}" stroke-width="1.5"/>
  <text x="${x}" y="40" text-anchor="middle" fill="${i===1||i===2?'#a78bfa':'#94a3b8'}" font-size="9">${i===0?'END-L':i===1?'GATE-L':i===2?'GATE-R':'END-R'}</text>
  `).join('')}

  <rect x="171" y="50" width="138" height="185" fill="#0a1a0a" rx="0" opacity="0.6"/>
  <text x="240" y="155" text-anchor="middle" fill="#22c55e" font-size="10" opacity="0.5">GATE OPENING</text>

  <!-- Strands each side -->
  ${[0,1,2,3,4,5].map(si=>{
    const y=65+si*26;
    const col=si%2===0?'#ef4444':'#22c55e';
    return `
  <line x1="66" y1="${y}" x2="159" y2="${y}" stroke="${col}" stroke-width="2.5"/>
  <line x1="321" y1="${y}" x2="446" y2="${y}" stroke="${col}" stroke-width="2.5"/>`;
  }).join('')}

  <!-- Bypass loops over gate (dashed arc) -->
  ${[0,1,2,3,4,5].map(si=>{
    const y=65+si*26;
    const col=si%2===0?'#ef4444':'#22c55e';
    const lift=30+si*4;
    return `<path d="M159,${y} Q240,${y-lift} 321,${y}" stroke="${col}" stroke-width="2" fill="none" stroke-dasharray="5,3"/>`;
  }).join('')}

  <!-- Bypass label -->
  <rect x="185" y="12" width="110" height="18" rx="4" fill="#0a1a0a" stroke="#22c55e" stroke-width="1"/>
  <text x="240" y="24" text-anchor="middle" fill="#22c55e" font-size="8">BYPASS LOOPS (over gate)</text>

  <!-- Arrows showing direction -->
  <text x="240" y="50" text-anchor="middle" fill="#64748b" font-size="14">↓</text>

  <!-- Optional conduit below -->
  <rect x="171" y="248" width="138" height="12" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1"/>
  <text x="240" y="258" text-anchor="middle" fill="#64748b" font-size="7">Optional HT conduit below</text>

  <!-- Optional gate contact -->
  <rect x="205" y="195" width="70" height="28" rx="5" fill="#111827" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="4,2"/>
  <text x="240" y="207" text-anchor="middle" fill="#a78bfa" font-size="8">OPTIONAL</text>
  <text x="240" y="218" text-anchor="middle" fill="#a78bfa" font-size="8">Gate Contact</text>

  <!-- End bridges -->
  <path d="M54,65 Q38,78 38,91 Q38,104 54,117" stroke="#ef4444" stroke-width="2" fill="none"/>
  <path d="M54,117 Q38,130 38,143 Q38,156 54,169" stroke="#ef4444" stroke-width="2" fill="none"/>
  <path d="M446,91 Q462,104 462,117 Q462,130 446,143" stroke="#22c55e" stroke-width="2" fill="none"/>
  <path d="M446,143 Q462,156 462,169 Q462,182 446,195" stroke="#22c55e" stroke-width="2" fill="none"/>

  <text x="250" y="285" text-anchor="middle" fill="#64748b" font-size="8">Fence remains active and alarmed even when gate is open</text>
</svg>
<div class="legend">
  <div class="leg"><div class="dot" style="background:#ef4444"></div>HT Live</div>
  <div class="leg"><div class="dot" style="background:#22c55e"></div>Earth</div>
  <div class="leg"><div class="dot" style="background:#a78bfa"></div>Gate Posts</div>
</div>
<div class="desc">Bypass wires loop each strand over the gate opening between the two gate posts. The fence circuit remains unbroken and fully active even when the gate is open. An optional gate contact can be added to alert when the gate opens without disabling the fence. Common on driveways and high-traffic entrances.</div>`;}

function cornerHtml():string{return `
<div class="title">📐 Corner Post Wiring</div>
<svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="320" fill="#0a0f16" rx="8"/>

  <!-- Corner post (large, central) -->
  <rect x="218" y="100" width="16" height="16" rx="3" fill="#64748b" stroke="#94a3b8" stroke-width="2"/>
  <text x="226" y="92" text-anchor="middle" fill="#e2e8f0" font-size="10" font-weight="bold">CORNER POST</text>

  <!-- Stay braces -->
  <line x1="226" y1="108" x2="140" y2="185" stroke="#475569" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
  <text x="148" y="198" fill="#64748b" font-size="8">STAY BRACE</text>
  <line x1="226" y1="108" x2="310" y2="185" stroke="#475569" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
  <text x="295" y="198" fill="#64748b" font-size="8">STAY BRACE</text>

  <!-- Horizontal fence (coming from left) -->
  ${[0,1,2,3,4,5].map(si=>{
    const y=68+si*22;
    const col=si%2===0?'#ef4444':'#22c55e';
    return `<line x1="20" y1="${y}" x2="218" y2="${y}" stroke="${col}" stroke-width="2.5"/>
    <circle cx="20" cy="${y}" r="3" fill="${col}"/>`;
  }).join('')}

  <!-- Vertical fence (going down) -->
  ${[0,1,2,3,4,5].map(si=>{
    const x=258+si*22;
    const col=si%2===0?'#ef4444':'#22c55e';
    return `<line x1="${x}" y1="116" x2="${x}" y2="295" stroke="${col}" stroke-width="2.5"/>
    <circle cx="${x}" cy="295" r="3" fill="${col}"/>`;
  }).join('')}

  <!-- Corner bridges (curved) connecting horizontal to vertical -->
  ${[0,1,2,3,4,5].map(si=>{
    const hy=68+si*22;
    const vx=258+si*22;
    const col=si%2===0?'#ef4444':'#22c55e';
    return `<path d="M218,${hy} Q${vx},${hy} ${vx},116" stroke="${col}" stroke-width="2" fill="none" stroke-dasharray="4,2"/>`;
  }).join('')}

  <!-- Labels -->
  <text x="110" y="55" text-anchor="middle" fill="#94a3b8" font-size="9">← FENCE SECTION A</text>
  <text x="370" y="205" text-anchor="middle" fill="#94a3b8" font-size="9" transform="rotate(90,370,205)">FENCE SECTION B ↓</text>

  <!-- Insulator symbols on posts -->
  ${[60,120,180].map(x=>`
  <rect x="${x-4}" y="100" width="8" height="8" rx="1" fill="#1e40af" stroke="#3b82f6" stroke-width="1"/>
  `).join('')}

  <!-- Bridge labels -->
  <rect x="228" y="68" width="28" height="14" rx="3" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
  <text x="242" y="78" text-anchor="middle" fill="#ef4444" font-size="7">HT→HT</text>
  <rect x="228" y="86" width="32" height="14" rx="3" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
  <text x="244" y="96" text-anchor="middle" fill="#22c55e" font-size="7">EARTH→E</text>

  <text x="250" y="308" text-anchor="middle" fill="#64748b" font-size="8">Stay lugs used — never weld stays to posts</text>
</svg>
<div class="legend">
  <div class="leg"><div class="dot" style="background:#ef4444"></div>HT Live</div>
  <div class="leg"><div class="dot" style="background:#22c55e"></div>Earth</div>
  <div class="leg"><div class="dot" style="background:#3b82f6"></div>Insulator</div>
  <div class="leg"><div class="dot" style="background:#475569"></div>Stay Brace</div>
</div>
<div class="desc">At 90° corners all strands turn using bridge clips. HT strands bridge to HT, Earth strands bridge to Earth. Two stay braces support the corner post — one per direction of pull. Use stay lugs and clamps — never weld stays. Tension springs fitted at corner posts.</div>`;}

function energizerHtml():string{return `
<div class="title">⚡ Energizer Installation & Earthing Layout</div>
<svg viewBox="0 0 500 340" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="340" fill="#0a0f16" rx="8"/>

  <!-- Building wall -->
  <rect x="8" y="30" width="110" height="170" rx="6" fill="#111827" stroke="#1e293b" stroke-width="2"/>
  <text x="63" y="48" text-anchor="middle" fill="#475569" font-size="9">BUILDING / WALL</text>
  <line x1="8" y1="52" x2="118" y2="52" stroke="#1e293b" stroke-width="1"/>

  <!-- Energizer box -->
  <rect x="20" y="60" width="86" height="100" rx="6" fill="#1a2332" stroke="#f59e0b" stroke-width="2.5"/>
  <text x="63" y="80" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">ENERGIZER</text>
  <rect x="28" y="85" width="70" height="18" rx="3" fill="#111827" stroke="#f59e0b" stroke-width="1"/>
  <text x="63" y="98" text-anchor="middle" fill="#f59e0b" font-size="7">LCD DISPLAY</text>
  <!-- Terminals -->
  <rect x="28" y="115" width="28" height="16" rx="2" fill="#7f1d1d" stroke="#ef4444" stroke-width="1.5"/>
  <text x="42" y="127" text-anchor="middle" fill="#ef4444" font-size="7">FENCE+</text>
  <rect x="60" y="115" width="28" height="16" rx="2" fill="#14532d" stroke="#22c55e" stroke-width="1.5"/>
  <text x="74" y="127" text-anchor="middle" fill="#22c55e" font-size="7">EARTH</text>
  <!-- Mains input -->
  <rect x="34" y="140" width="58" height="14" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
  <text x="63" y="151" text-anchor="middle" fill="#64748b" font-size="7">220V MAINS INPUT</text>

  <!-- Conduit A - HT Live (red) -->
  <rect x="118" y="115" width="185" height="12" rx="4" fill="#2d1515" stroke="#ef4444" stroke-width="1.5"/>
  <text x="210" y="125" text-anchor="middle" fill="#ef4444" font-size="8">HT LIVE — CONDUIT A</text>
  <line x1="56" y1="123" x2="118" y2="121" stroke="#ef4444" stroke-width="2"/>

  <!-- Conduit B - Earth return (green) -->
  <rect x="118" y="140" width="185" height="12" rx="4" fill="#0d2d15" stroke="#22c55e" stroke-width="1.5"/>
  <text x="210" y="150" text-anchor="middle" fill="#22c55e" font-size="8">EARTH RETURN — CONDUIT B</text>
  <line x1="88" y1="131" x2="118" y2="146" stroke="#22c55e" stroke-width="2"/>

  <!-- NEVER same conduit warning -->
  <rect x="130" y="158" width="162" height="16" rx="4" fill="#451a03" stroke="#f97316" stroke-width="1.5"/>
  <text x="211" y="170" text-anchor="middle" fill="#f97316" font-size="8" font-weight="bold">⚠ NEVER IN SAME CONDUIT</text>

  <!-- Lightning diverter -->
  <circle cx="330" cy="121" r="14" fill="#1a2332" stroke="#f59e0b" stroke-width="2"/>
  <text x="330" y="118" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="bold">LGHT</text>
  <text x="330" y="128" text-anchor="middle" fill="#f59e0b" font-size="7">DIV</text>
  <line x1="303" y1="121" x2="316" y2="121" stroke="#ef4444" stroke-width="2"/>
  <line x1="344" y1="121" x2="360" y2="121" stroke="#ef4444" stroke-width="2"/>
  <text x="330" y="145" text-anchor="middle" fill="#94a3b8" font-size="7">Lightning Diverter</text>

  <!-- Fence post -->
  <rect x="360" y="60" width="14" height="220" rx="3" fill="#475569" stroke="#64748b" stroke-width="1.5"/>
  <text x="367" y="52" text-anchor="middle" fill="#94a3b8" font-size="9">FENCE</text>
  <!-- Strands on fence -->
  ${[0,1,2,3,4,5].map(si=>{
    const y=75+si*22;
    const col=si%2===0?'#ef4444':'#22c55e';
    return `<line x1="374" y1="${y}" x2="490" y2="${y}" stroke="${col}" stroke-width="2"/>`;
  }).join('')}
  <line x1="344" y1="121" x2="374" y2="80" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3,2"/>
  <line x1="303" y1="146" x2="374" y2="97" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="3,2"/>

  <!-- Earth spikes at energizer (3 minimum) -->
  ${[25,50,75].map((x,i)=>`
  <line x1="${x}" y1="200" x2="${x}" y2="240" stroke="#22c55e" stroke-width="3"/>
  <line x1="${x-8}" y1="240" x2="${x+8}" y2="240" stroke="#22c55e" stroke-width="2.5"/>
  <line x1="${x-5}" y1="248" x2="${x+5}" y2="248" stroke="#22c55e" stroke-width="2"/>
  <line x1="${x-2}" y1="255" x2="${x+2}" y2="255" stroke="#22c55e" stroke-width="1.5"/>
  <text x="${x}" y="270" text-anchor="middle" fill="#22c55e" font-size="7">SPIKE ${i+1}</text>
  `).join('')}
  <line x1="88" y1="131" x2="50" y2="200" stroke="#22c55e" stroke-width="2"/>
  <rect x="8" y="278" width="102" height="30" rx="4" fill="#0d2d15" stroke="#22c55e" stroke-width="1"/>
  <text x="59" y="291" text-anchor="middle" fill="#22c55e" font-size="7">3× SPIKES MINIMUM</text>
  <text x="59" y="302" text-anchor="middle" fill="#22c55e" font-size="7">1.2m DEEP • 3m APART</text>

  <!-- Fence earth spikes (every 30m) -->
  ${[420,460].map((x,i)=>`
  <line x1="${x}" y1="285" x2="${x}" y2="310" stroke="#22c55e" stroke-width="2"/>
  <line x1="${x-6}" y1="310" x2="${x+6}" y2="310" stroke="#22c55e" stroke-width="1.5"/>
  <text x="${x}" y="322" text-anchor="middle" fill="#22c55e" font-size="7">30m</text>
  `).join('')}
  <text x="440" y="278" text-anchor="middle" fill="#64748b" font-size="7">Earth spikes along fence every 30m</text>

  <text x="250" y="335" text-anchor="middle" fill="#64748b" font-size="7">Per SANS 10222-3 — COC required for all installations</text>
</svg>
<div class="legend">
  <div class="leg"><div class="dot" style="background:#ef4444"></div>HT Live (Conduit A)</div>
  <div class="leg"><div class="dot" style="background:#22c55e"></div>Earth Return (Conduit B)</div>
  <div class="leg"><div class="dot" style="background:#f59e0b"></div>Energizer / Lightning Div</div>
  <div class="leg"><div class="dot" style="background:#f97316"></div>Warning / Safety</div>
</div>
<div class="desc">Energizer mounted indoors in ventilated area. HT live and earth return run in SEPARATE conduits — never together. Lightning diverter fitted at fence entry point. Minimum 3 earth spikes at energizer: 1.2m deep, 3m apart. Additional earth spikes every 30m along fence. Per SANS 10222-3.</div>`;}

function multizoneHtml():string{return `
<div class="title">🔀 Two-Zone Fence — Single Energizer</div>
<svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="320" fill="#0a0f16" rx="8"/>

  <!-- Energizer -->
  <rect x="10" y="120" width="80" height="80" rx="6" fill="#1a2332" stroke="#f59e0b" stroke-width="2.5"/>
  <text x="50" y="145" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">ENERGIZER</text>
  <rect x="18" y="152" width="64" height="12" rx="2" fill="#111827" stroke="#f59e0b" stroke-width="1"/>
  <text x="50" y="162" text-anchor="middle" fill="#f59e0b" font-size="7">LCD / DRUID</text>
  <rect x="18" y="170" width="28" height="14" rx="2" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
  <text x="32" y="181" text-anchor="middle" fill="#ef4444" font-size="6.5">ZONE 1</text>
  <rect x="50" y="170" width="28" height="14" rx="2" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1"/>
  <text x="64" y="181" text-anchor="middle" fill="#60a5fa" font-size="6.5">ZONE 2</text>

  <!-- Zone card -->
  <rect x="110" y="110" width="70" height="100" rx="6" fill="#111827" stroke="#60a5fa" stroke-width="2"/>
  <text x="145" y="130" text-anchor="middle" fill="#60a5fa" font-size="8" font-weight="bold">SMART I/O</text>
  <text x="145" y="143" text-anchor="middle" fill="#60a5fa" font-size="8">ZONE CARD</text>
  <line x1="90" y1="177" x2="110" y2="160" stroke="#f59e0b" stroke-width="2"/>
  <!-- Zone card outputs -->
  <circle cx="180" cy="145" r="5" fill="#ef4444" stroke="#ef4444" stroke-width="1"/>
  <text x="188" y="149" fill="#ef4444" font-size="7">Z1+</text>
  <circle cx="180" cy="160" r="5" fill="#22c55e" stroke="#22c55e" stroke-width="1"/>
  <text x="188" y="164" fill="#22c55e" font-size="7">Z1 E</text>
  <circle cx="180" cy="178" r="5" fill="#60a5fa" stroke="#60a5fa" stroke-width="1"/>
  <text x="188" y="182" fill="#60a5fa" font-size="7">Z2+</text>
  <circle cx="180" cy="193" r="5" fill="#a78bfa" stroke="#a78bfa" stroke-width="1"/>
  <text x="188" y="197" fill="#a78bfa" font-size="7">Z2 E</text>

  <!-- Zone 1 fence (top) -->
  <rect x="8" y="18" width="484" height="12" rx="2" fill="#7f1d1d" opacity="0.3"/>
  <text x="250" y="15" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">ZONE 1 — Front Perimeter</text>
  ${[30,40,50,60,70,80].map((y,si)=>`
  <line x1="210" y1="${y}" x2="490" y2="${y}" stroke="${si%2===0?'#ef4444':'#22c55e'}" stroke-width="2"/>
  `).join('')}
  ${[250,330,410].map(x=>`<rect x="${x-4}" y="22" width="8" height="65" rx="2" fill="#475569" opacity="0.8"/>`).join('')}
  <line x1="186" y1="145" x2="210" y2="56" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <line x1="186" y1="160" x2="210" y2="65" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4,3"/>
  <rect x="210" y="18" width="60" height="14" rx="3" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
  <text x="240" y="29" text-anchor="middle" fill="#ef4444" font-size="7">ZONE 1 ALARM</text>

  <!-- Zone 2 fence (bottom) -->
  <rect x="8" y="225" width="484" height="12" rx="2" fill="#1e3a5f" opacity="0.3"/>
  <text x="250" y="222" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="bold">ZONE 2 — Rear / Side Perimeter</text>
  ${[240,252,264,276,288,300].map((y,si)=>`
  <line x1="210" y1="${y}" x2="490" y2="${y}" stroke="${si%2===0?'#60a5fa':'#a78bfa'}" stroke-width="2"/>
  `).join('')}
  ${[250,330,410].map(x=>`<rect x="${x-4}" y="233" width="8" height="75" rx="2" fill="#475569" opacity="0.8"/>`).join('')}
  <line x1="186" y1="178" x2="210" y2="264" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="4,3"/>
  <line x1="186" y1="193" x2="210" y2="276" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="4,3"/>
  <rect x="210" y="225" width="60" height="14" rx="3" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1"/>
  <text x="240" y="236" text-anchor="middle" fill="#60a5fa" font-size="7">ZONE 2 ALARM</text>

  <!-- Alarm panel -->
  <rect x="10" y="220" width="80" height="60" rx="6" fill="#111827" stroke="#64748b" stroke-width="1.5"/>
  <text x="50" y="238" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="bold">ALARM</text>
  <text x="50" y="250" text-anchor="middle" fill="#94a3b8" font-size="8">PANEL</text>
  <rect x="18" y="256" width="28" height="10" rx="2" fill="#7f1d1d" stroke="#ef4444" stroke-width="1"/>
  <text x="32" y="264" text-anchor="middle" fill="#ef4444" font-size="6">Z1 ⚠</text>
  <rect x="52" y="256" width="28" height="10" rx="2" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1"/>
  <text x="66" y="264" text-anchor="middle" fill="#60a5fa" font-size="6">Z2 ⚠</text>
  <line x1="50" y1="200" x2="50" y2="220" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3,2"/>

  <text x="250" y="312" text-anchor="middle" fill="#64748b" font-size="7">Each zone independently monitored — alarm identifies exact breach location</text>
</svg>
<div class="legend">
  <div class="leg"><div class="dot" style="background:#ef4444"></div>Zone 1 HT</div>
  <div class="leg"><div class="dot" style="background:#22c55e"></div>Zone 1 Earth</div>
  <div class="leg"><div class="dot" style="background:#60a5fa"></div>Zone 2 HT</div>
  <div class="leg"><div class="dot" style="background:#a78bfa"></div>Zone 2 Earth</div>
</div>
<div class="desc">A single energizer with a Smart I/O zone card drives two fully independent fence zones. Each zone has its own HT and earth circuit monitored separately. When triggered the alarm panel identifies exactly which zone was breached — critical for large or L-shaped properties where knowing the breach location matters.</div>`;}

export default function DiagramsScreen(){
  const[sel,setSel]=useState('serpentine');
  const diag=DIAGRAMS.find(d=>d.id===sel)!;
  const html=makeHtml(sel);
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
      <WebView
        key={sel}
        source={{html}}
        style={s.webview}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        backgroundColor="#0a0f16"
      />
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
  webview:{flex:1,backgroundColor:'#0a0f16'},
});
