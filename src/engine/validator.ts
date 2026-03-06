import {
  FenceNode, FenceWire, FenceType,
  ValidationResult, ValidationIssue, FenceStats,
  IssueSeverity, DiagnosticInput, DiagnosticResult, FaultType,
} from '../types';

const SNAP = 24;
const NEAR = 40;
const GATE_BRIDGE_RADIUS = 160;

const JOULE_PER_100M: Record<FenceType, number> = {
  agricultural: 1.0,
  wildlife: 1.5,
  game: 2.0,
  security: 3.0,
};

const MIN_SPIKES: Record<FenceType, number> = {
  agricultural: 3,
  wildlife: 3,
  game: 4,
  security: 5,
};

function near(a: number, b: number, d = NEAR): boolean {
  return Math.abs(a - b) < d;
}

function nodeNear(wire: FenceWire, node: FenceNode): boolean {
  return (
    (near(wire.x1, node.x) && near(wire.y1, node.y)) ||
    (near(wire.x2, node.x) && near(wire.y2, node.y))
  );
}

function wireEndNear(wire: FenceWire, x: number, y: number, d = GATE_BRIDGE_RADIUS): boolean {
  const mx = (wire.x1 + wire.x2) / 2;
  const my = (wire.y1 + wire.y2) / 2;
  return (
    Math.hypot(wire.x1 - x, wire.y1 - y) < d ||
    Math.hypot(wire.x2 - x, wire.y2 - y) < d ||
    Math.hypot(mx - x, my - y) < d
  );
}

function midDist(a: FenceWire, b: FenceWire): number {
  return Math.hypot(
    (a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2,
    (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2,
  );
}

function wireLength(w: FenceWire): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / SNAP * 2;
}

function issue(
  code: string, severity: IssueSeverity, title: string,
  detail: string, suggestion?: string, affectedIds?: string[],
): ValidationIssue {
  return { id: code, code, severity, title, detail, suggestion, affectedIds };
}

export function validateFence(
  nodes: FenceNode[], wires: FenceWire[], fenceType: FenceType,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const energizers = nodes.filter(n => n.type === 'energizer');
  const spikes     = nodes.filter(n => n.type === 'earth_spike');
  const gates      = nodes.filter(n => n.type === 'gate');
  const htWires    = wires.filter(w => w.type === 'hot');
  const earthWires = wires.filter(w => w.type === 'earth');
  const bHT        = wires.filter(w => w.type === 'bridge_hot');
  const bEarth     = wires.filter(w => w.type === 'bridge_earth');
  const htLength   = htWires.reduce((s, w) => s + wireLength(w), 0);
  const earthLength= earthWires.reduce((s, w) => s + wireLength(w), 0);

  if (!energizers.length) {
    issues.push(issue('E001','error','No Energizer',
      'The fence has no power source.',
      'Place an Energizer and connect HT wire from its positive (+) terminal.'));
  } else if (energizers.length > 1) {
    issues.push(issue('W001','warn','Multiple Energizers',
      `${energizers.length} Energizers detected. Parallel energizers can cause phase conflict.`,
      'Use a single higher-joule energizer instead.',
      energizers.map(e => e.id)));
  }

  if (!htWires.length) {
    issues.push(issue('E002','error','No HT Wire',
      'No hot (live) wire drawn.',
      'Select HT Wire and draw the live conductor along your fence line.'));
  }

  if (!earthWires.length) {
    issues.push(issue('E003','error','No Earth Wire',
      'No earth wire drawn. Current cannot complete the circuit.',
      'Draw earth wire from the Energizer earth terminal to your earth spikes.'));
  }

  const minSpikes = MIN_SPIKES[fenceType];
  if (!spikes.length) {
    issues.push(issue('E004','error','No Earth Spikes',
      'No earth spikes placed. Fence will have extremely poor performance.',
      `Add at least ${minSpikes} earth spikes, 1.8m long, spaced 3m apart.`));
  } else if (spikes.length < minSpikes) {
    issues.push(issue('W002','warn','Insufficient Earth Spikes',
      `Only ${spikes.length} spike(s). Minimum for ${fenceType} is ${minSpikes}.`,
      `Add ${minSpikes - spikes.length} more earth spike(s).`,
      spikes.map(s => s.id)));
  } else {
    issues.push(issue('OK01','ok','Earth Spikes OK',
      `${spikes.length} earth spike(s) — meets minimum of ${minSpikes}. ✓`));
  }

  if (energizers.length && htWires.length) {
    const htConnected = htWires.some(w => energizers.some(e => nodeNear(w, e)));
    if (!htConnected) {
      issues.push(issue('E005','error','HT Not Connected to Energizer',
        'HT wire does not connect to any Energizer positive (+) terminal.',
        'Start your HT wire at the Energizer node.',
        energizers.map(e => e.id)));
    } else {
      issues.push(issue('OK02','ok','HT Connected to Energizer',
        'HT wire correctly connected to Energizer (+) terminal. ✓'));
    }
  }

  if (earthWires.length && spikes.length) {
    const earthConnected = spikes.some(s => earthWires.some(w => nodeNear(w, s)));
    if (!earthConnected) {
      issues.push(issue('E007','error','Earth Wire Not Connected to Spikes',
        'Earth wire does not connect to any earth spike.',
        'Draw earth wire so it ends at each earth spike node.',
        spikes.map(s => s.id)));
    } else {
      issues.push(issue('OK03','ok','Earth Continuity OK',
        'Earth wire connected to spike(s). Ground return path established. ✓'));
    }
  }

  if (gates.length) {
    let missingHT = 0, missingEarth = 0;
    const ungated: string[] = [];
    gates.forEach(gate => {
      const hasHT    = bHT.some(b => wireEndNear(b, gate.x, gate.y));
      const hasEarth = bEarth.some(b => wireEndNear(b, gate.x, gate.y));
      if (!hasHT)    { missingHT++;    ungated.push(gate.id); }
      if (!hasEarth) { missingEarth++; ungated.push(gate.id); }
    });
    if (missingHT) {
      issues.push(issue('E008','error',`Gate Missing HT Bridge (${missingHT})`,
        'Every gate needs an HT bridge to keep the live circuit continuous.',
        'Draw an HT Bridge wire from one side of the gate to the other.',
        ungated));
    }
    if (missingEarth) {
      issues.push(issue('E009','error',`Gate Missing Earth Bridge (${missingEarth})`,
        'Every gate needs an Earth bridge. Without it the return path is broken.',
        'Draw an Earth Bridge wire parallel to the HT bridge at every gate.',
        ungated));
    }
    if (!missingHT && !missingEarth) {
      issues.push(issue('OK04','ok','All Gate Bridges Correct',
        `Both HT and Earth bridges at all ${gates.length} gate(s). ✓`));
    }
  }

  bHT.forEach(h => {
    bEarth.forEach(e => {
      if (midDist(h, e) < 35) {
        issues.push(issue('E010','error','Bridge Short Circuit Risk',
          'HT and Earth bridge overlap — risk of short circuit.',
          'Separate HT and Earth bridges by at least 50mm.',
          [h.id, e.id]));
      }
    });
  });

  if (htLength > 0) {
    const joulesNeeded = (htLength / 100) * JOULE_PER_100M[fenceType];
    if (joulesNeeded > 5) {
      issues.push(issue('W003','warn','Check Energizer Joule Rating',
        `At ~${Math.round(htLength)}m you need ~${joulesNeeded.toFixed(1)}J output.`,
        `Use an energizer rated at least ${Math.ceil(joulesNeeded + 1)}J.`));
    }
  }

  if (fenceType === 'security' && spikes.length < 6) {
    issues.push(issue('W004','warn','Security Fence — More Earthing Needed',
      'Security fences need 6+ spikes to maintain 8kV+.',
      'Add more earth spikes and water them in dry weather.'));
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount  = issues.filter(i => i.severity === 'warn').length;
  let score = Math.max(0, Math.min(100, 100 - errorCount * 20 - warnCount * 5));

  const joulesNeeded = htLength > 0 ? (htLength / 100) * JOULE_PER_100M[fenceType] : 0;
  const stats: FenceStats = {
    energizerCount: energizers.length,
    earthSpikeCount: spikes.length,
    gateCount: gates.length,
    postCount: nodes.filter(n => n.type === 'post').length,
    htLengthM: Math.round(htLength),
    earthLengthM: Math.round(earthLength),
    bridgeCount: bHT.length + bEarth.length,
    estimatedJoulesNeeded: Math.round(joulesNeeded * 10) / 10,
  };

  const recommendations: string[] = [];
  if (errorCount) recommendations.push('⛔ Fix all critical errors before powering the fence.');
  if (spikes.length > 0 && spikes.length < 5) recommendations.push('💧 Water earth spike area during dry spells.');
  if (stats.htLengthM > 500) recommendations.push('🔀 For fences over 500m consider a zone selector switch.');
  if (gates.length) recommendations.push('🚪 Test gate contacts monthly — #1 cause of fence failure.');
  if (fenceType === 'security') recommendations.push('⚡ Security fences should maintain 8,000V+ under load.');
  if (stats.estimatedJoulesNeeded > 0) recommendations.push(`⚡ Estimated energizer output needed: ${stats.estimatedJoulesNeeded}J`);

  return { passed: errorCount === 0, score, issues, stats, recommendations };
}

export function runDiagnostics(input: DiagnosticInput): DiagnosticResult {
  const { measuredVoltageKV, energizerOutputKV, fenceType,
    totalLengthM, earthSpikeCount, soilCondition, symptoms } = input;
  const voltageRatio = measuredVoltageKV / Math.max(energizerOutputKV, 0.1);
  const results: Array<{ fault: FaultType; score: number; explanation: string; steps: string[] }> = [];

  if (voltageRatio < 0.4) {
    const isEarth = earthSpikeCount < 3 || soilCondition === 'dry';
    results.push({
      fault: isEarth ? 'poor_earth' : 'vegetation_drain',
      score: isEarth ? 0.85 : 0.7,
      explanation: isEarth
        ? `Voltage is ${Math.round(voltageRatio*100)}% of rated output. With ${earthSpikeCount} spike(s) in ${soilCondition} soil, poor earthing is the primary suspect.`
        : `Voltage is ${Math.round(voltageRatio*100)}% of rated output — consistent with heavy vegetation contact.`,
      steps: isEarth
        ? ['Disconnect all fence wires from energizer.',
           'Measure voltage at earth terminal alone.',
           'If still low, add more earth spikes (3m spacing).',
           'Pour water around earth spikes and retest.',
           'If improved, earthing was the issue.']
        : ['Walk the fence looking for grass or branches touching wire.',
           'Disconnect fence in sections to locate the drain zone.',
           'Test voltage in each isolated section.',
           'Clear vegetation and retest.',
           'Consider raising bottom wire height.'],
    });
  }

  if (symptoms.includes('no_voltage') || voltageRatio < 0.05) {
    results.push({
      fault: 'open_circuit', score: 0.9,
      explanation: 'Near-zero voltage means a complete break in HT wire or disconnected terminal.',
      steps: ['Check all terminal connections at the energizer.',
              'Walk the fence looking for broken wires or fallen insulators.',
              'Use a fence tester — voltage drops to zero past the break.',
              'Check gate handles and contact springs.',
              'Inspect joins and connectors for corrosion.'],
    });
  }

  if (symptoms.includes('clicking') || symptoms.includes('tripping')) {
    results.push({
      fault: 'short_circuit', score: 0.88,
      explanation: 'Rapid clicking or energizer tripping is classic short circuit behaviour.',
      steps: ['Disconnect fence and reconnect one section at a time.',
              'When clicking returns, the fault is in that section.',
              'Look for HT wire touching a post or the earth wire.',
              'Check bridge wires at gates for contact.',
              'Inspect insulators for cracks or damage.'],
    });
  }

  if (symptoms.includes('gate_area') || symptoms.includes('intermittent')) {
    results.push({
      fault: 'gate_contact_fault', score: 0.75,
      explanation: 'Intermittent faults near gates are almost always gate contact springs or bridge connections.',
      steps: ['Open and close each gate while watching the fence tester.',
              'Inspect gate handle contact spring — replace if corroded.',
              'Check HT bridge wire connections at both ends.',
              'Check Earth bridge wire — often disconnects at the crimp.',
              'Ensure bridge wires are tight and protected.'],
    });
  }

  if (!results.length) {
    return {
      likelyFault: null, confidence: 0,
      explanation: 'No clear fault pattern detected. Readings appear within normal range.',
      steps: ['Verify energizer is switched on and powered.',
              'Test energizer with no fence connected.',
              'Walk the fence line and visually inspect wire and insulators.'],
    };
  }

  results.sort((a, b) => b.score - a.score);
  const top = results[0];
  return {
    likelyFault: top.fault,
    confidence: Math.round(top.score * 100),
    explanation: top.explanation,
    steps: top.steps,
  };
}
