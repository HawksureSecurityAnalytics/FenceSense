package com.fencecad.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.fencecad.model.FaultState
import com.fencecad.model.SchematicFault
import com.fencecad.model.SchematicFaultType
import com.fencecad.ui.theme.*
import kotlin.math.abs
import kotlin.math.hypot

data class SchematicConfig(
    val strandCount: Int = 8,
    val intermediatePosts: Int = 2,
    val lengthMeters: Int = 50,
    val hasGate: Boolean = false,
    val gateAtPost: Int = 1,
    val fenceType: String = "Security"
)

data class DiagnosticGuide(
    val id: String,
    val title: String,
    val steps: List<String>
)

val DIAGNOSTIC_GUIDES = listOf(
    DiagnosticGuide(
        id = "alarm_on",
        title = "Alarm sounding continuously",
        steps = listOf(
            "1. Check energizer display: is output voltage under 3.0kV?",
            "2. Low voltage indicates a short circuit. Walk all HT strands to check for foliage/vegetation contact.",
            "3. Disconnect fence zones one at a time using cut-out switches until the alarm stops to isolate the fault zone.",
            "4. In faulty zone: inspect post insulators for hairline cracks or moisture causing HT-to-Earth arcing.",
            "5. Check all HT bridge clips in that zone for loose connections or arcing burns.",
            "6. Use multimeter: measure resistance between HT and Earth terminal (<1MΩ indicates short circuit)."
        )
    ),
    DiagnosticGuide(
        id = "weak_shock",
        title = "Weak or no shock / Low voltage",
        steps = listOf(
            "1. Confirm energizer is powered and pulsing (green/red LED active).",
            "2. Measure voltage at energizer output terminals with fence tester (Normal = 6.0–9.5kV).",
            "3. If normal at energizer but low at far end: earth return circuit is broken or poor.",
            "4. Check all earth bridge clips from energizer end outward to locate the open circuit.",
            "5. Test earth spikes: measure resistance from energizer earth terminal to ground (<10Ω is compliant).",
            "6. Ensure earth spikes are at least 1.2m deep, soil is moist, and spikes are spaced 3m apart.",
            "7. Mark any open earth bridge on the schematic using FAULT mode."
        )
    ),
    DiagnosticGuide(
        id = "partial_dead",
        title = "Only part of fence is live",
        steps = listOf(
            "1. Use a digital fence tester at each post to identify where voltage drops to 0kV.",
            "2. The open circuit fault is strictly between the last live post and the first dead post.",
            "3. Check ALL bridge clips (HT live and Earth return) at the boundary post.",
            "4. Inspect the strand segment between those two posts for physical breaks or cut wire.",
            "5. If a gate is between those posts: inspect underground bypass cable connections.",
            "6. Mark the boundary post and dead strand on the schematic."
        )
    ),
    DiagnosticGuide(
        id = "energizer_fault",
        title = "Energizer fault light / Tripping",
        steps = listOf(
            "1. Disconnect fence feed wires from energizer terminals. Does the fault LED clear?",
            "2. If yes: the fault is on the fence line. Reconnect one zone at a time to isolate.",
            "3. When fault returns: that specific zone contains the short circuit.",
            "4. In that zone: test HT-to-Earth insulation resistance with a 1000V Megger (must exceed 1MΩ).",
            "5. Walk line looking for wire touching metal bracket, post stay wire, or wet fence mesh.",
            "6. Inspect earth system: verify minimum 3 spikes driven 1.2m deep into ground."
        )
    )
)

val SYMPTOM_EXPLANATIONS = mapOf(
    SchematicFaultType.HT_BRIDGE to "This HT bridge is open — the live series loop is broken here. Strands beyond this point carry 0V. Alarm zone will trigger continuously. TEST: Use multimeter continuity across this jumper clip.",
    SchematicFaultType.EARTH_BRIDGE to "Earth return path is broken here. Energizer output voltage drops drastically. Deterrent shock effectiveness reduced across entire installation. TEST: Test continuity across this earth clip.",
    SchematicFaultType.STRAND to "Open circuit or earth short on this strand. If HT: no voltage on this strand. If Earth: return path affected. TEST: Walk the strand looking for physical breaks, sag, or vegetation contact.",
    SchematicFaultType.POST to "Insulator breakdown at this post. Causes HT-to-Earth short (low voltage) or multiple open circuits. TEST: Visually inspect all bobbin insulators at this post for carbon tracking or cracks."
)

val FAULT_CAUSES = mapOf(
    SchematicFaultType.HT_BRIDGE to listOf("Corroded or loose clip", "Broken strain insulator", "Wire pulled out of crimp ferrule", "Tampering / Vandalism"),
    SchematicFaultType.EARTH_BRIDGE to listOf("Corroded clamp", "Wet or cracked insulator (short risk)", "Wire pulled from clip"),
    SchematicFaultType.STRAND to listOf("Vegetation/branches touching wire", "Animal impact / vehicle break", "Wire fatigue at join", "Corrosion"),
    SchematicFaultType.POST to listOf("Post knocked over / bent", "Lightning strike damage", "Insulators cracked", "Moisture ingress")
)

@Composable
fun InteractiveSchematic(
    modifier: Modifier = Modifier
) {
    var config by remember { mutableStateOf(SchematicConfig()) }
    var faults by remember { mutableStateOf<List<SchematicFault>>(emptyList()) }
    var faultModeActive by remember { mutableStateOf(false) }
    var showConfigDialog by remember { mutableStateOf(false) }
    var showSymptomsDialog by remember { mutableStateOf(false) }
    var showDiagnosisDialog by remember { mutableStateOf(false) }
    var activeGuide by remember { mutableStateOf<DiagnosticGuide?>(null) }

    val textMeasurer = rememberTextMeasurer()

    val totalPosts = config.intermediatePosts + 2
    val clipWidth = 14f
    val strandSpacing = 16f
    val pTop = 24f
    val strandH = (config.strandCount - 1) * strandSpacing
    val pBot = pTop + strandH + 24f
    val svgH = pBot + (if (config.hasGate) 60f else 28f) + 40f
    val marginL = 80f
    val marginR = 36f
    val postSpacing = 90f
    val totalWidth = marginL + (totalPosts - 1) * postSpacing + marginR

    fun getFault(pi: Int, si: Int, type: SchematicFaultType): FaultState {
        return faults.find { it.postIndex == pi && it.strandIndex == si && it.type == type }?.state ?: FaultState.OK
    }

    fun toggleFault(pi: Int, si: Int, type: SchematicFaultType) {
        if (!faultModeActive) return
        val existing = faults.find { it.postIndex == pi && it.strandIndex == si && it.type == type }
        faults = when (existing?.state) {
            null -> faults + SchematicFault(pi, si, type, FaultState.FAULTY)
            FaultState.FAULTY -> faults.map { if (it == existing) it.copy(state = FaultState.SUSPECT) else it }
            FaultState.SUSPECT -> faults.filter { it != existing }
            FaultState.OK -> faults.filter { it != existing }
        }
    }

    fun getElementColor(state: FaultState, defaultColor: Color): Color {
        return when (state) {
            FaultState.FAULTY -> FaultOrange
            FaultState.SUSPECT -> SuspectYellow
            FaultState.OK -> defaultColor
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // TOP CONTROLS BAR
        Surface(
            color = BgPanel,
            tonalElevation = 2.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Bolt,
                            contentDescription = null,
                            tint = AmberEnergizer,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "FENCESENSE",
                            style = MaterialTheme.typography.titleMedium,
                            color = AmberEnergizer
                        )
                    }
                    Text(
                        text = "${config.fenceType.uppercase()} · ${config.strandCount} STRANDS · ${config.lengthMeters}m",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // FAULT MODE TOGGLE
                    FilterChip(
                        selected = faultModeActive,
                        onClick = { faultModeActive = !faultModeActive },
                        label = {
                            Text(
                                "⚠ FAULT",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (faultModeActive) FaultOrange else TextPrimary
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0x33F97316),
                            selectedLabelColor = FaultOrange,
                            containerColor = BgCard
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = faultModeActive,
                            borderColor = if (faultModeActive) FaultOrange else BorderDark
                        )
                    )

                    // DIAGNOSE BUTTON
                    Button(
                        onClick = { showSymptomsDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = BgCard),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = TextPrimary,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("DIAGNOSE", style = MaterialTheme.typography.labelSmall, color = TextPrimary)
                    }

                    // CONFIG BUTTON
                    IconButton(
                        onClick = { showConfigDialog = true },
                        modifier = Modifier
                            .size(32.dp)
                            .background(BgCard, RoundedCornerShape(6.dp))
                            .border(1.dp, BorderDark, RoundedCornerShape(6.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Config",
                            tint = TextPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // LEGEND BAR
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgPanel)
                .padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            LegendItem(color = HtWireRed, label = "HT Live")
            LegendItem(color = EarthWireGreen, label = "Earth Return")
            LegendItem(color = BridgeHotBlue, label = "HT Bridge")
            LegendItem(color = FaultOrange, label = "Fault")
            LegendItem(color = SuspectYellow, label = "Suspect")
        }

        // FAULT MODE ACTIVE BANNER
        AnimatedVisibility(visible = faultModeActive) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF2D1010))
                    .border(1.dp, Color(0xFFF97316).copy(alpha = 0.5f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "⚠ TAP clip / strand / post → faulty → suspect → clear",
                    style = MaterialTheme.typography.labelSmall,
                    color = FaultOrange
                )
                if (faults.isNotEmpty()) {
                    Text(
                        text = "Clear all",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted,
                        modifier = Modifier.clickable { faults = emptyList() }
                    )
                }
            }
        }

        // SCHEMATIC DRAWING CANVAS (HORIZONTAL & VERTICAL SCROLL)
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .horizontalScroll(rememberScrollState())
                    .verticalScroll(rememberScrollState())
            ) {
                Canvas(
                    modifier = Modifier
                        .size(totalWidth.dp, svgH.dp)
                        .pointerInput(faultModeActive) {
                            detectTapGestures { offset ->
                                if (!faultModeActive) return@detectTapGestures
                                // Detect tap on strands, posts, or bridge clips
                                val px = offset.x
                                val py = offset.y

                                // 1. Check posts
                                for (p in 0 until totalPosts) {
                                    val postX = marginL + p * postSpacing
                                    if (abs(px - postX) < 14f && py in (pTop - 10f)..pBot) {
                                        toggleFault(p, 0, SchematicFaultType.POST)
                                        return@detectTapGestures
                                    }
                                }

                                // 2. Check strands
                                for (s in 0 until config.strandCount) {
                                    val sY = pTop + 12f + s * strandSpacing
                                    if (abs(py - sY) < 8f && px in marginL..(marginL + (totalPosts - 1) * postSpacing)) {
                                        toggleFault(99, s, SchematicFaultType.STRAND)
                                        return@detectTapGestures
                                    }
                                }

                                // 3. Check bridge clips
                                for (p in 0 until totalPosts) {
                                    val postX = marginL + p * postSpacing
                                    for (s in 0 until config.strandCount - 1) {
                                        val yA = pTop + 12f + s * strandSpacing
                                        val yB = pTop + 12f + (s + 1) * strandSpacing
                                        if (abs(px - postX) < 22f && py in yA..yB) {
                                            val isHT = s % 2 == 0
                                            toggleFault(p, s, if (isHT) SchematicFaultType.HT_BRIDGE else SchematicFaultType.EARTH_BRIDGE)
                                            return@detectTapGestures
                                        }
                                    }
                                }
                            }
                        }
                ) {
                    drawSchematic(
                        config = config,
                        faults = faults,
                        totalPosts = totalPosts,
                        marginL = marginL,
                        postSpacing = postSpacing,
                        strandSpacing = strandSpacing,
                        pTop = pTop,
                        pBot = pBot,
                        clipWidth = clipWidth,
                        textMeasurer = textMeasurer
                    )
                }
            }
        }

        // FAULTS SUMMARY PANEL
        if (faults.isNotEmpty()) {
            Surface(
                color = Color(0xFF1A0D0D),
                tonalElevation = 4.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val faultCount = faults.count { it.state == FaultState.FAULTY }
                    val suspectCount = faults.count { it.state == FaultState.SUSPECT }

                    Column {
                        if (faultCount > 0) {
                            Text(
                                "🔴 $faultCount FAULT${if (faultCount > 1) "S" else ""}",
                                style = MaterialTheme.typography.titleMedium,
                                color = FaultOrange
                            )
                        }
                        if (suspectCount > 0) {
                            Text(
                                "🟡 $suspectCount SUSPECT",
                                style = MaterialTheme.typography.labelSmall,
                                color = SuspectYellow
                            )
                        }
                    }

                    Button(
                        onClick = {
                            activeGuide = null
                            showDiagnosisDialog = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = FaultOrange),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("▶ DIAGNOSIS", style = MaterialTheme.typography.labelSmall, color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // STATS BAR
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgPanel)
                .border(1.dp, BorderDark)
                .padding(vertical = 8.dp, horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            StatItem(label = "STRANDS", value = "${config.strandCount}")
            StatItem(label = "POSTS", value = "$totalPosts")
            StatItem(label = "LENGTH", value = "${config.lengthMeters}m")
            StatItem(label = "TYPE", value = config.fenceType.take(4).uppercase())
            StatItem(label = "GATE", value = if (config.hasGate) "YES" else "NO")
        }
    }

    // SYMPTOMS SELECTOR DIALOG
    if (showSymptomsDialog) {
        Dialog(onDismissRequest = { showSymptomsDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = "🔍 What is the problem?",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer
                    )
                    Text(
                        text = "Select a symptom for step-by-step test procedure:",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )

                    for (guide in DIAGNOSTIC_GUIDES) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = BgCard),
                            border = BorderStroke(1.dp, BorderDark),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clickable {
                                    activeGuide = guide
                                    showSymptomsDialog = false
                                    showDiagnosisDialog = true
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "▶  ${guide.title}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextPrimary,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = {
                            showSymptomsDialog = false
                            faultModeActive = true
                        },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FaultOrange),
                        border = BorderStroke(1.dp, FaultOrange),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("⚠ I know the fault — Mark on diagram")
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    TextButton(
                        onClick = { showSymptomsDialog = false },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text("CANCEL", color = TextMuted)
                    }
                }
            }
        }
    }

    // DIAGNOSIS / STEP-BY-STEP DIALOG
    if (showDiagnosisDialog) {
        Dialog(onDismissRequest = { showDiagnosisDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (activeGuide != null) {
                        Text(
                            text = "🔍 ${activeGuide!!.title}",
                            style = MaterialTheme.typography.titleMedium,
                            color = AmberEnergizer
                        )
                        Text(
                            text = "Follow these testing steps in sequence with your fence voltmeter:",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )

                        for (step in activeGuide!!.steps) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .background(BgCard, RoundedCornerShape(6.dp))
                                    .border(1.dp, BorderDark, RoundedCornerShape(6.dp))
                                    .padding(10.dp)
                            ) {
                                Text(
                                    text = step,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextPrimary
                                )
                            }
                        }
                    } else {
                        Text(
                            text = "🔴 Marked Faults Analysis",
                            style = MaterialTheme.typography.titleMedium,
                            color = FaultOrange
                        )

                        if (faults.isEmpty()) {
                            Text(
                                text = "No faults tagged. Tap components on the schematic in ⚠ FAULT mode.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextMuted,
                                modifier = Modifier.padding(vertical = 8.dp)
                            )
                        } else {
                            for (f in faults) {
                                val loc = when (f.type) {
                                    SchematicFaultType.STRAND -> "Strand ${f.strandIndex + 1} (${if (f.strandIndex % 2 == 0) "HT Live" else "Earth"})"
                                    SchematicFaultType.POST -> "Post P${f.postIndex}"
                                    SchematicFaultType.HT_BRIDGE -> "HT Bridge @ Post P${f.postIndex} Strand ${f.strandIndex + 1}"
                                    SchematicFaultType.EARTH_BRIDGE -> "Earth Bridge @ Post P${f.postIndex} Strand ${f.strandIndex + 1}"
                                }

                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1A0D0D)),
                                    border = BorderStroke(1.dp, if (f.state == FaultState.FAULTY) FaultOrange else SuspectYellow),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                ) {
                                    Column(modifier = Modifier.padding(10.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(loc, style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                                            Text(
                                                "[${f.state.name}]",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = if (f.state == FaultState.FAULTY) FaultOrange else SuspectYellow
                                            )
                                        }
                                        Text(
                                            SYMPTOM_EXPLANATIONS[f.type] ?: "",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextMuted,
                                            modifier = Modifier.padding(top = 4.dp)
                                        )
                                        Text(
                                            "Likely causes:\n" + (FAULT_CAUSES[f.type]?.joinToString("\n") { " • $it" } ?: ""),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = SuspectYellow,
                                            modifier = Modifier.padding(top = 4.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            showDiagnosisDialog = false
                            activeGuide = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("✓ CLOSE", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // CONFIGURATION DIALOG
    if (showConfigDialog) {
        Dialog(onDismissRequest = { showConfigDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = "⚙ Fence Configuration",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                    Text("STRANDS", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf(5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30).forEach { count ->
                            ConfigChip(
                                label = "$count",
                                selected = config.strandCount == count,
                                onClick = { config = config.copy(strandCount = count) }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("INTERMEDIATE POSTS", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf(0, 1, 2, 3, 4, 5, 6, 8).forEach { count ->
                            ConfigChip(
                                label = "$count",
                                selected = config.intermediatePosts == count,
                                onClick = { config = config.copy(intermediatePosts = count) }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("FENCE LENGTH (m)", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf(10, 20, 30, 50, 75, 100, 150, 200).forEach { len ->
                            ConfigChip(
                                label = "${len}m",
                                selected = config.lengthMeters == len,
                                onClick = { config = config.copy(lengthMeters = len) }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("FENCE TYPE", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf("Security", "Agricultural", "Game", "Wildlife").forEach { type ->
                            ConfigChip(
                                label = type,
                                selected = config.fenceType == type,
                                onClick = { config = config.copy(fenceType = type) }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("GATE OPENING", style = MaterialTheme.typography.labelMedium, color = TextPrimary)
                        Switch(
                            checked = config.hasGate,
                            onCheckedChange = { config = config.copy(hasGate = it) },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = AmberEnergizer,
                                checkedTrackColor = AmberDim
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { showConfigDialog = false },
                        colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("✓ APPLY CONFIGURATION", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun ConfigChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .background(if (selected) AmberDim else BgCard, RoundedCornerShape(4.dp))
            .border(1.dp, if (selected) AmberEnergizer else BorderDark, RoundedCornerShape(4.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = if (selected) AmberEnergizer else TextMuted
        )
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(modifier = Modifier.size(6.dp).background(color, CircleShape))
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted)
    }
}

@Composable
private fun StatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleSmall, color = AmberEnergizer)
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted)
    }
}

private fun DrawScope.drawSchematic(
    config: SchematicConfig,
    faults: List<SchematicFault>,
    totalPosts: Int,
    marginL: Float,
    postSpacing: Float,
    strandSpacing: Float,
    pTop: Float,
    pBot: Float,
    clipWidth: Float,
    textMeasurer: TextMeasurer
) {
    fun pX(i: Int) = marginL + i * postSpacing
    fun sY(i: Int) = pTop + 12f + i * strandSpacing

    fun getFault(pi: Int, si: Int, type: SchematicFaultType): FaultState {
        return faults.find { it.postIndex == pi && it.strandIndex == si && it.type == type }?.state ?: FaultState.OK
    }

    fun getCol(state: FaultState, defaultColor: Color): Color {
        return when (state) {
            FaultState.FAULTY -> FaultOrange
            FaultState.SUSPECT -> SuspectYellow
            FaultState.OK -> defaultColor
        }
    }

    // 1. Draw Strands
    for (s in 0 until config.strandCount) {
        val y = sY(s)
        val isHT = s % 2 == 0
        val state = getFault(99, s, SchematicFaultType.STRAND)
        val col = getCol(state, if (isHT) HtWireRed else EarthWireGreen)
        val strokeW = if (state != FaultState.OK) 2.5f else 1.8f

        drawLine(
            color = col,
            start = Offset(pX(0), y),
            end = Offset(pX(totalPosts - 1), y),
            strokeWidth = strokeW,
            pathEffect = if (state == FaultState.FAULTY) PathEffect.dashPathEffect(floatArrayOf(8f, 4f)) else null
        )

        // Strand number & label
        drawText(
            textMeasurer = textMeasurer,
            text = "${s + 1}",
            topLeft = Offset(marginL - 16f, y - 6f),
            style = TextStyle(color = col, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        )
        drawText(
            textMeasurer = textMeasurer,
            text = if (isHT) "HT" else "E",
            topLeft = Offset(marginL - 32f, y - 6f),
            style = TextStyle(color = col.copy(alpha = 0.7f), fontSize = 8.sp)
        )
    }

    // 2. Draw Posts
    for (p in 0 until totalPosts) {
        val px = pX(p)
        val isEnd = p == 0 || p == totalPosts - 1
        val state = getFault(p, 0, SchematicFaultType.POST)
        val col = getCol(state, PostGray)

        drawLine(
            color = col.copy(alpha = 0.85f),
            start = Offset(px, pTop - 4f),
            end = Offset(px, pBot),
            strokeWidth = if (isEnd) 10f else 7f
        )
        // Post base
        drawRect(
            color = col.copy(alpha = 0.7f),
            topLeft = Offset(px - 6f, pBot - 2f),
            size = Size(12f, 6f)
        )

        // Post top label
        val label = if (p == 0) "END L" else if (p == totalPosts - 1) "END R" else "P$p"
        drawText(
            textMeasurer = textMeasurer,
            text = label,
            topLeft = Offset(px - 10f, pTop - 16f),
            style = TextStyle(color = col, fontSize = 8.sp)
        )

        if (state != FaultState.OK) {
            drawCircle(
                color = col,
                radius = 5f,
                center = Offset(px, pTop - 22f)
            )
        }
    }

    // 3. Draw Serpentine Jumper Clips
    fun renderClip(pxi: Int, iA: Int, iB: Int, isHT: Boolean, sideL: Boolean) {
        val px = pX(pxi)
        val yA = sY(iA)
        val yB = sY(iB)
        val ft = if (isHT) SchematicFaultType.HT_BRIDGE else SchematicFaultType.EARTH_BRIDGE
        val state = getFault(pxi, iA, ft)
        val col = getCol(state, if (isHT) BridgeHotBlue else BridgeEarthPurple)
        val sw = if (state != FaultState.OK) 3f else 1.8f
        val cx = px + (if (sideL) -1f else 1f) * clipWidth

        drawLine(col, Offset(px, yA), Offset(cx, yA), strokeWidth = sw)
        drawLine(col, Offset(cx, yA), Offset(cx, yB), strokeWidth = sw)
        drawLine(col, Offset(cx, yB), Offset(px, yB), strokeWidth = sw)

        if (state != FaultState.OK) {
            drawCircle(col, radius = 4f, center = Offset(cx, (yA + yB) / 2f))
        }
    }

    val htIndices = (0 until config.strandCount).filter { it % 2 == 0 }
    val eIndices = (0 until config.strandCount).filter { it % 2 == 1 }

    for (p in 0 until totalPosts) {
        val isL = p == 0
        val isR = p == totalPosts - 1

        htIndices.forEachIndexed { k, si ->
            if (k < htIndices.size - 1) {
                val sideL = k % 2 != 0
                if (isL && sideL) renderClip(p, si, htIndices[k + 1], true, true)
                else if (isR && !sideL) renderClip(p, si, htIndices[k + 1], true, false)
                else if (!isL && !isR) renderClip(p, si, htIndices[k + 1], true, sideL)
            }
        }

        eIndices.forEachIndexed { k, si ->
            if (k < eIndices.size - 1) {
                val sideL = k % 2 != 0
                if (isL && sideL) renderClip(p, si, eIndices[k + 1], false, true)
                else if (isR && !sideL) renderClip(p, si, eIndices[k + 1], false, false)
                else if (!isL && !isR) renderClip(p, si, eIndices[k + 1], false, sideL)
            }
        }
    }

    // 4. Draw Energizer Box & Earth Ground Spikes
    val eW = 46f
    val eH = 34f
    val ex = pX(0) - eW - 16f
    val ey = sY(0) - eH / 2f

    drawRoundRect(
        color = Color(0xFF1C1600),
        topLeft = Offset(ex, ey),
        size = Size(eW, eH),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
    )
    drawRoundRect(
        color = AmberEnergizer,
        topLeft = Offset(ex, ey),
        size = Size(eW, eH),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f),
        style = Stroke(width = 1.5f)
    )
    drawText(
        textMeasurer = textMeasurer,
        text = "⚡ ENRG",
        topLeft = Offset(ex + 4f, ey + 10f),
        style = TextStyle(color = AmberEnergizer, fontSize = 8.sp, fontWeight = FontWeight.Bold)
    )

    // Energizer HT Live wire feed
    val liveY = ey + eH * 0.28f
    drawLine(
        color = HtWireRed,
        start = Offset(ex + eW, liveY),
        end = Offset(pX(0), sY(0)),
        strokeWidth = 1.8f,
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 2f))
    )

    // Energizer Earth return feed
    val retY = ey + eH * 0.72f
    drawLine(
        color = EarthWireGreen,
        start = Offset(ex + eW, retY),
        end = Offset(pX(0), sY(config.strandCount - 1)),
        strokeWidth = 1.8f,
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 2f))
    )

    // Earth Spikes
    val gndLineX = ex + eW / 2f
    drawLine(EarthWireGreen, Offset(gndLineX, ey + eH), Offset(gndLineX, pBot + 6f), strokeWidth = 1.5f)
    listOf(-12f, 0f, 12f).forEach { off ->
        val sx = gndLineX + off
        val sy = pBot + 6f
        drawLine(SpikeGray, Offset(sx, sy), Offset(sx, sy + 20f), strokeWidth = 2.5f)
        drawLine(SpikeGray, Offset(sx - 4f, sy + 6f), Offset(sx + 4f, sy + 6f), strokeWidth = 1.5f)
        drawLine(SpikeGray, Offset(sx - 2f, sy + 12f), Offset(sx + 2f, sy + 12f), strokeWidth = 1.5f)
    }

    // 5. Draw Gate bypass if configured
    if (config.hasGate && config.gateAtPost < totalPosts - 1) {
        val gx1 = pX(config.gateAtPost)
        val gx2 = pX(config.gateAtPost + 1)
        val byY = pBot + 20f

        val htPath = Path().apply {
            moveTo(gx1, sY(0))
            lineTo(gx1, byY)
            lineTo(gx2, byY)
            lineTo(gx2, sY(0))
        }
        drawPath(htPath, HtWireRed, style = Stroke(width = 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 2f))))

        val ePath = Path().apply {
            moveTo(gx1, sY(config.strandCount - 1))
            lineTo(gx1, byY + 10f)
            lineTo(gx2, byY + 10f)
            lineTo(gx2, sY(config.strandCount - 1))
        }
        drawPath(ePath, EarthWireGreen, style = Stroke(width = 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 2f))))

        drawRoundRect(
            color = Color(0xFF1C1600),
            topLeft = Offset((gx1 + gx2) / 2f - 16f, byY - 6f),
            size = Size(32f, 12f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f)
        )
        drawRoundRect(
            color = AmberEnergizer,
            topLeft = Offset((gx1 + gx2) / 2f - 16f, byY - 6f),
            size = Size(32f, 12f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f, 2f),
            style = Stroke(width = 1f)
        )
        drawText(
            textMeasurer = textMeasurer,
            text = "GATE",
            topLeft = Offset((gx1 + gx2) / 2f - 10f, byY - 5f),
            style = TextStyle(color = AmberEnergizer, fontSize = 7.sp, fontWeight = FontWeight.Bold)
        )
    }

    // 6. Dimension Line
    val dimY = pBot + (if (config.hasGate) 46f else 12f)
    drawLine(TextMuted, Offset(pX(0), dimY), Offset(pX(totalPosts - 1), dimY), strokeWidth = 0.8f)
    drawLine(TextMuted, Offset(pX(0), dimY - 3f), Offset(pX(0), dimY + 3f), strokeWidth = 1f)
    drawLine(TextMuted, Offset(pX(totalPosts - 1), dimY - 3f), Offset(pX(totalPosts - 1), dimY + 3f), strokeWidth = 1f)
    drawText(
        textMeasurer = textMeasurer,
        text = "${config.lengthMeters}m",
        topLeft = Offset((pX(0) + pX(totalPosts - 1)) / 2f - 10f, dimY + 4f),
        style = TextStyle(color = TextMuted, fontSize = 8.sp)
    )
}
