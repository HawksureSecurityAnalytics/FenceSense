package com.fencecad.engine

import com.fencecad.model.*
import kotlin.math.*

object ValidatorEngine {

    /**
     * Validates an entire fence CAD design against SANS 10222-3 electrical safety standards.
     */
    fun validateFence(
        nodes: List<FenceNode>,
        wires: List<FenceWire>,
        fenceType: FenceType = FenceType.AGRICULTURAL
    ): ValidationResult {
        val issues = mutableListOf<ValidationIssue>()
        val recommendations = mutableListOf<String>()

        val energizers = nodes.filter { it.type == ComponentType.ENERGIZER }
        val earthSpikes = nodes.filter { it.type == ComponentType.EARTH_SPIKE }
        val posts = nodes.filter { it.type == ComponentType.POST || it.type == ComponentType.CORNER }
        val gates = nodes.filter { it.type == ComponentType.GATE }

        val htWires = wires.filter { it.type == WireType.HOT }
        val earthWires = wires.filter { it.type == WireType.EARTH }
        val bridgeWires = wires.filter { it.type == WireType.BRIDGE_HOT || it.type == WireType.BRIDGE_EARTH }

        val totalHtLen = htWires.sumOf { (it.lengthMeters * it.strandCount).toDouble() }
        val totalEarthLen = earthWires.sumOf { (it.lengthMeters * it.strandCount).toDouble() }
        val totalWireKm = (totalHtLen + totalEarthLen) / 1000.0

        // SANS 10222-3 Rule: 1 Joule per 100m wire
        val estJoules = max(0.5, ceil(totalWireKm / 0.1) * 0.1)

        // 1. Energizer checks
        if (energizers.isEmpty()) {
            issues.add(
                ValidationIssue(
                    id = "err_no_energizer",
                    severity = IssueSeverity.ERROR,
                    title = "Missing Energizer",
                    detail = "Fence has no power source. At least 1 Energizer must be placed.",
                    suggestion = "Place an Energizer component on the canvas and wire its HT output to the fence."
                )
            )
        } else if (energizers.size > 2) {
            issues.add(
                ValidationIssue(
                    id = "warn_multi_energizer",
                    severity = IssueSeverity.WARN,
                    title = "Multiple Energizers on Same Zone",
                    detail = "Connecting multiple energizers to the same wire loop violates SANS 10222-3.",
                    suggestion = "Ensure distinct fence zones have physical separation or independent loops."
                )
            )
        }

        // 2. Earthing checks
        if (earthSpikes.size < 3) {
            issues.add(
                ValidationIssue(
                    id = "err_earth_spikes",
                    severity = IssueSeverity.ERROR,
                    title = "Insufficient Earth Spikes (${earthSpikes.size}/3 min)",
                    detail = "SANS 10222-3 mandates a minimum of 3 earth spikes at the energizer, spaced 3m apart.",
                    suggestion = "Add at least ${3 - earthSpikes.size} more earth spikes near the energizer."
                )
            )
        }

        // 3. Post & Span checks
        if (posts.size < 2) {
            issues.add(
                ValidationIssue(
                    id = "warn_too_few_posts",
                    severity = IssueSeverity.WARN,
                    title = "Insufficient Fence Posts",
                    detail = "A complete fence span requires at least 2 corner/strainer posts.",
                    suggestion = "Add line posts with max 3m spacing (freestanding) or 2m (wall-top)."
                )
            )
        }

        // 4. Wire connectivity
        if (htWires.isEmpty()) {
            issues.add(
                ValidationIssue(
                    id = "err_no_ht_wire",
                    severity = IssueSeverity.ERROR,
                    title = "No Live HT Wires",
                    detail = "Fence has no live HT conductors to deliver deterrent shock voltage.",
                    suggestion = "Draw HT live wires between posts and connect to energizer output."
                )
            )
        }

        // 5. Gate Bypass Check
        if (gates.isNotEmpty()) {
            val hasUndergroundBypass = wires.any { it.lengthMeters > 3f && it.type == WireType.HOT }
            if (!hasUndergroundBypass) {
                issues.add(
                    ValidationIssue(
                        id = "warn_gate_bypass",
                        severity = IssueSeverity.WARN,
                        title = "Gate Bypass Conduit Recommended",
                        detail = "Ensure HT cable runs underground in conduit under gates to maintain loop continuity when open.",
                        suggestion = "Add high voltage insulated lead-out cable bypass under the gate opening."
                    )
                )
            }
        }

        // Recommendations
        if (fenceType == FenceType.SECURITY) {
            recommendations.add("• Install warning signs every 10 meters along the perimeter (SANS 10222-3).")
            recommendations.add("• Ensure bottom strand is at least 150mm above wall/ground to prevent false alarms.")
            recommendations.add("• Security standard: maintain min 6.0kV open circuit voltage at the far end.")
        } else {
            recommendations.add("• Agricultural standard: Maintain min 4.0kV for sheep/cattle, 5.5kV for bulls/wildlife.")
            recommendations.add("• Ensure vegetation under fence is trimmed regularly to minimize leakage drain.")
        }
        recommendations.add("• Earth resistance from energizer ground to soil should measure under 10 Ohms.")

        var score = 100
        for (issue in issues) {
            when (issue.severity) {
                IssueSeverity.ERROR -> score -= 30
                IssueSeverity.WARN -> score -= 12
                IssueSeverity.OK -> {}
            }
        }
        score = max(0, min(100, score))

        val stats = ValidationStats(
            totalNodes = nodes.size,
            totalWires = wires.size,
            htLengthM = (totalHtLen * 10).roundToInt() / 10.0,
            earthLengthM = (totalEarthLen * 10).roundToInt() / 10.0,
            energizerCount = energizers.size,
            earthSpikeCount = earthSpikes.size,
            gateCount = gates.size,
            estimatedJoulesNeeded = (estJoules * 10).roundToInt() / 10.0
        )

        return ValidationResult(
            passed = issues.none { it.severity == IssueSeverity.ERROR },
            score = score,
            issues = issues,
            recommendations = recommendations,
            stats = stats
        )
    }

    /**
     * Offline fault-finding expert diagnostic wizard.
     */
    fun runDiagnostics(input: DiagnosticInput): DiagnosticResult {
        val measured = input.measuredVoltageKV
        val rated = input.energizerOutputKV
        val symptoms = input.symptoms.toSet()
        val soil = input.soilCondition
        val spikes = input.earthSpikeCount

        // 1. Open Circuit / Broken Wire
        if (symptoms.contains("no_voltage") || (measured < 1.0 && rated >= 5.0)) {
            return DiagnosticResult(
                likelyFault = "Open Circuit / Broken Wire",
                confidence = 94,
                explanation = "Zero or near-zero voltage measured on fence while energizer is operational. This indicates a physical break in the live HT wire, a disconnected bridge clip, or an open gate contact.",
                steps = listOf(
                    "Check voltage directly at the energizer output terminals. If energizer reads normal (${rated}kV), the break is downstream.",
                    "Walk the fence line and visually inspect all HT bridge clips at corner and end posts for disconnected or corroded jumpers.",
                    "Inspect all gate contact plates. Ensure gate contacts align and close firmly without oxidization.",
                    "Use a fence directional fault finder or voltmeter to follow current flow: look for the post where voltage drops to zero."
                ),
                severity = "error"
            )
        }

        // 2. Short Circuit / Heavy Load
        if (symptoms.contains("tripping") || (measured <= 2.5 && rated >= 7.0) || symptoms.contains("clicking")) {
            return DiagnosticResult(
                likelyFault = "Short Circuit / HT Arcing",
                confidence = 88,
                explanation = "Severe voltage drop accompanied by energizer tripping or audible snapping/clicking. A live HT conductor is shorting directly to earth or touching a metal post/bracket.",
                steps = listOf(
                    "Listen for audible snapping or clicking sounds along the fence line, especially in low light or twilight conditions.",
                    "Inspect all plastic bobbin/strain insulators for hairline cracks, tracking carbon lines, or lightning burn marks.",
                    "Check if wire has sagged and is making direct physical contact with fence post brackets, stay wires, or wire mesh.",
                    "Disconnect fence zones one at a time at the energizer cut-out switches to isolate the exact section with the short."
                ),
                severity = "error"
            )
        }

        // 3. Poor Earthing / High Earth Resistance
        if (symptoms.contains("dry_weather") || spikes < 3 || (soil == "dry" && measured < 4.5)) {
            return DiagnosticResult(
                likelyFault = "Poor Earthing System",
                confidence = 82,
                explanation = "Shock is weak or voltage reading is low at the perimeter end despite energizer firing. Insufficient ground rods or dry/sandy soil prevent effective earth return current.",
                steps = listOf(
                    "Measure voltage between the energizer earth terminal and a test spike driven into ground 1m away. Reading should be <200V (if >500V, earthing is poor).",
                    "Add additional 1.2m copper-clad earth spikes spaced 3m apart and bond them together with 2.5mm HT lead-out cable.",
                    "In sandy or rocky terrain, consider bentonite soil conditioning or running a dedicated Earth Return wire strand throughout the fence.",
                    "Ensure earth clamp connections to rods are free of rust and tightened securely."
                ),
                severity = "warn"
            )
        }

        // 4. Vegetation Drain / Leakage
        if (symptoms.contains("after_rain") || (measured < 5.0 && symptoms.contains("low_voltage"))) {
            return DiagnosticResult(
                likelyFault = "Vegetation Leakage Drain",
                confidence = 85,
                explanation = "Moisture, grass, shrubs, or branches touching live wires create parallel resistance paths to earth, draining energizer pulse energy.",
                steps = listOf(
                    "Walk perimeter and clear all trees, weeds, overhanging foliage, and grass within 300mm of the bottom HT wire.",
                    "Check for spiderwebs, dirt accumulation, or damp moss on insulator surfaces causing surface tracking.",
                    "Inspect line post insulators after heavy rain to identify wet contact points.",
                    "Consider installing an energizer with higher Joule output or low-impedance cyclic wave technology for vegetation load."
                ),
                severity = "warn"
            )
        }

        // 5. Gate Contact Fault
        if (symptoms.contains("gate_area")) {
            return DiagnosticResult(
                likelyFault = "Gate Contact Alignment Fault",
                confidence = 86,
                explanation = "Intermittent power or alarm triggers centered around the gate opening. Misaligned gate contacts, worn brass springs, or damaged underground conduit cable.",
                steps = listOf(
                    "Inspect sliding/swing gate brass contact pins for alignment and tension when gate is locked.",
                    "Clean oxidized contact plates with wire brush and electrical contact cleaner.",
                    "Check underground bypass cable continuity with multimeter across the gate span.",
                    "Verify that gate loop bypasses the gate opening so the rest of the perimeter remains live even when gate is opened."
                ),
                severity = "warn"
            )
        }

        // Fallback Normal / Minor Drop
        return DiagnosticResult(
            likelyFault = "Normal Operation / Minor Impedance Drop",
            confidence = 75,
            explanation = "Measured voltage (${measured}kV) is within acceptable working limits for a standard ${input.fenceType.displayName.lowercase()} fence installation.",
            steps = listOf(
                "Perform routine monthly voltage checks at the furthest corner post.",
                "Inspect tension on all spring strainers to prevent winter/summer thermal sag.",
                "Ensure warning signs remain legible and securely fastened every 10 meters."
            ),
            severity = "ok"
        )
    }
}
