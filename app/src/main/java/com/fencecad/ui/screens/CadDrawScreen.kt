package com.fencecad.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.fencecad.engine.AutoWireEngine
import com.fencecad.engine.SimulationEngine
import com.fencecad.engine.ValidatorEngine
import com.fencecad.model.*
import com.fencecad.ui.components.CadCanvasView
import com.fencecad.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CadDrawScreen(
    currentProject: FenceProject,
    onProjectUpdated: (FenceProject) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    var nodes by remember(currentProject.id) { mutableStateOf(currentProject.nodes) }
    var wires by remember(currentProject.id) { mutableStateOf(currentProject.wires) }
    var fenceType by remember(currentProject.id) { mutableStateOf(currentProject.fenceType) }
    var zones by remember(currentProject.id) { mutableStateOf(currentProject.zones) }
    var activeZoneId by remember { mutableStateOf("zone_1") }

    // Undo / Redo history state
    var history by remember { mutableStateOf(listOf(Pair(nodes, wires))) }
    var historyIndex by remember { mutableStateOf(0) }

    var canvasState by remember { mutableStateOf(CanvasState()) }
    var simulationResult by remember { mutableStateOf<SimulationResult?>(null) }
    var validationResult by remember { mutableStateOf<ValidationResult?>(null) }

    var showComponentPicker by remember { mutableStateOf(false) }
    var showBlueprintDialog by remember { mutableStateOf(false) }
    var showZoneDialog by remember { mutableStateOf(false) }
    var showPresetsDialog by remember { mutableStateOf(false) }
    var showSimulationSheet by remember { mutableStateOf(false) }
    var showValidationSheet by remember { mutableStateOf(false) }
    var showClearConfirm by remember { mutableStateOf(false) }

    fun pushHistory(newNodes: List<FenceNode>, newWires: List<FenceWire>) {
        val trimmed = history.take(historyIndex + 1)
        history = trimmed + listOf(Pair(newNodes, newWires))
        historyIndex = history.size - 1
    }

    fun syncProject(newNodes: List<FenceNode>, newWires: List<FenceWire>, newType: FenceType = fenceType, newZones: List<FenceZone> = zones, recordHistory: Boolean = true) {
        nodes = newNodes
        wires = newWires
        fenceType = newType
        zones = newZones
        if (recordHistory) {
            pushHistory(newNodes, newWires)
        }
        val updated = currentProject.copy(
            nodes = newNodes,
            wires = newWires,
            fenceType = newType,
            zones = newZones,
            updatedAt = System.currentTimeMillis()
        )
        onProjectUpdated(updated)
    }

    fun handleUndo() {
        if (historyIndex > 0) {
            historyIndex--
            val (hNodes, hWires) = history[historyIndex]
            syncProject(hNodes, hWires, fenceType, zones, recordHistory = false)
            Toast.makeText(context, "Undo", Toast.LENGTH_SHORT).show()
        }
    }

    fun handleRedo() {
        if (historyIndex < history.size - 1) {
            historyIndex++
            val (hNodes, hWires) = history[historyIndex]
            syncProject(hNodes, hWires, fenceType, zones, recordHistory = false)
            Toast.makeText(context, "Redo", Toast.LENGTH_SHORT).show()
        }
    }

    fun handlePlaceNode(type: ComponentType, x: Float, y: Float) {
        val count = nodes.count { it.type == type } + 1
        val newNode = FenceNode(
            id = "node_${System.currentTimeMillis()}_${(100..999).random()}",
            type = type,
            x = x,
            y = y,
            label = "${type.displayName} $count",
            zoneId = activeZoneId
        )
        val nextNodes = nodes + newNode
        syncProject(nextNodes, wires, fenceType)
    }

    fun handleWireDrawn(x1: Float, y1: Float, x2: Float, y2: Float) {
        val len = kotlin.math.max(1f, kotlin.math.round(kotlin.math.hypot(x2 - x1, y2 - y1) / 20f * 2f))
        val newWire = FenceWire(
            id = "wire_${System.currentTimeMillis()}_${(100..999).random()}",
            type = canvasState.wireMode,
            x1 = x1,
            y1 = y1,
            x2 = x2,
            y2 = y2,
            lengthMeters = len,
            strandCount = if (canvasState.wireMode == WireType.HOT || canvasState.wireMode == WireType.EARTH) canvasState.strandCount else 1,
            zoneId = activeZoneId
        )
        val nextWires = wires + newWire
        syncProject(nodes, nextWires, fenceType)
    }

    fun handleNodeMove(id: String, newX: Float, newY: Float) {
        val oldNode = nodes.find { it.id == id } ?: return
        val updatedNodes = nodes.map { if (it.id == id) it.copy(x = newX, y = newY) else it }

        val updatedWires = wires.map { wire ->
            val near1 = kotlin.math.abs(wire.x1 - oldNode.x) < 30f && kotlin.math.abs(wire.y1 - oldNode.y) < 30f
            val near2 = kotlin.math.abs(wire.x2 - oldNode.x) < 30f && kotlin.math.abs(wire.y2 - oldNode.y) < 30f
            when {
                near1 && near2 -> wire.copy(x1 = newX, y1 = newY, x2 = newX, y2 = newY)
                near1 -> wire.copy(x1 = newX, y1 = newY)
                near2 -> wire.copy(x2 = newX, y2 = newY)
                else -> wire
            }
        }
        syncProject(updatedNodes, updatedWires, fenceType, recordHistory = false)
    }

    fun handleDeleteNode(id: String) {
        val nextNodes = nodes.filter { it.id != id }
        syncProject(nextNodes, wires, fenceType)
        canvasState = canvasState.copy(selectedNodeId = null)
        Toast.makeText(context, "Component deleted", Toast.LENGTH_SHORT).show()
    }

    fun handleDeleteWire(id: String) {
        val nextWires = wires.filter { it.id != id }
        syncProject(nodes, nextWires, fenceType)
        canvasState = canvasState.copy(selectedWireId = null)
        Toast.makeText(context, "Wire segment deleted", Toast.LENGTH_SHORT).show()
    }

    fun runNodalSimulation() {
        val network = SimulationEngine.buildCircuitFromProject(currentProject)
        val result = SimulationEngine.runSimulation(
            network = network,
            weather = currentProject.weatherCondition,
            vegetation = currentProject.vegetationCondition
        )
        simulationResult = result
        showSimulationSheet = true
    }

    fun runValidation() {
        val result = ValidatorEngine.validateFence(nodes, wires, fenceType)
        validationResult = result
        showValidationSheet = true
    }

    fun handleAutoWire() {
        val result = AutoWireEngine.autoWireFence(nodes, wires, canvasState.strandCount)
        val nextNodes = nodes + result.nodesToAdd
        val nextWires = wires + result.wiresToAdd
        syncProject(nextNodes, nextWires, fenceType)
        Toast.makeText(context, "Auto-Wire generated ${result.wiresToAdd.size} wires", Toast.LENGTH_SHORT).show()
    }

    fun loadPreset(presetName: String) {
        when (presetName) {
            "Residential Villa (4-Corner)" -> {
                val pNodes = listOf(
                    FenceNode("p1", ComponentType.ENERGIZER, 40f, 40f, "Energizer 1", "zone_1"),
                    FenceNode("p2", ComponentType.EARTH_SPIKE, 40f, 60f, "Earth Spike 1", "zone_1"),
                    FenceNode("p3", ComponentType.CORNER, 40f, 220f, "Corner Post A", "zone_1"),
                    FenceNode("p4", ComponentType.CORNER, 280f, 220f, "Corner Post B", "zone_2"),
                    FenceNode("p5", ComponentType.GATE, 280f, 130f, "Sliding Gate", "zone_2"),
                    FenceNode("p6", ComponentType.CORNER, 280f, 40f, "Corner Post C", "zone_2")
                )
                val pWires = listOf(
                    FenceWire("w1", WireType.HOT, 40f, 40f, 40f, 220f, 18.0f, 8, "zone_1"),
                    FenceWire("w2", WireType.HOT, 40f, 220f, 280f, 220f, 24.0f, 8, "zone_1"),
                    FenceWire("w3", WireType.HOT, 280f, 220f, 280f, 130f, 9.0f, 8, "zone_2"),
                    FenceWire("w4", WireType.HOT, 280f, 130f, 280f, 40f, 9.0f, 8, "zone_2"),
                    FenceWire("w5", WireType.HOT, 280f, 40f, 40f, 40f, 24.0f, 8, "zone_2")
                )
                syncProject(pNodes, pWires, FenceType.SECURITY)
                canvasState = canvasState.copy(blueprintType = BlueprintType.RESIDENTIAL_VILLA)
            }
            "Commercial Warehouse" -> {
                val pNodes = listOf(
                    FenceNode("cw1", ComponentType.ENERGIZER, 30f, 30f, "Main Energizer", "zone_1"),
                    FenceNode("cw2", ComponentType.EARTH_SPIKE, 30f, 60f, "Earth Array 1", "zone_1"),
                    FenceNode("cw3", ComponentType.CORNER, 30f, 250f, "SW Corner", "zone_1"),
                    FenceNode("cw4", ComponentType.GATE, 180f, 250f, "Truck Main Gate", "zone_1"),
                    FenceNode("cw5", ComponentType.CORNER, 330f, 250f, "SE Corner", "zone_2"),
                    FenceNode("cw6", ComponentType.CORNER, 330f, 30f, "NE Corner", "zone_2")
                )
                val pWires = listOf(
                    FenceWire("cww1", WireType.HOT, 30f, 30f, 30f, 250f, 22.0f, 12, "zone_1"),
                    FenceWire("cww2", WireType.HOT, 30f, 250f, 180f, 250f, 15.0f, 12, "zone_1"),
                    FenceWire("cww3", WireType.HOT, 180f, 250f, 330f, 250f, 15.0f, 12, "zone_2"),
                    FenceWire("cww4", WireType.HOT, 330f, 250f, 330f, 30f, 22.0f, 12, "zone_2"),
                    FenceWire("cww5", WireType.HOT, 330f, 30f, 30f, 30f, 30.0f, 12, "zone_2")
                )
                syncProject(pNodes, pWires, FenceType.SECURITY)
                canvasState = canvasState.copy(blueprintType = BlueprintType.COMMERCIAL_WAREHOUSE)
            }
        }
        showPresetsDialog = false
        Toast.makeText(context, "Loaded $presetName Preset", Toast.LENGTH_SHORT).show()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // TOP CAD ACTIONS HEADER
        Surface(
            color = BgPanel,
            tonalElevation = 3.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Project Title & Undo/Redo
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text(
                                text = currentProject.name,
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                            Text(
                                text = "${nodes.size} nodes · ${wires.size} spans · ${zones.size} zones",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextMuted
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        // Undo
                        IconButton(
                            onClick = { handleUndo() },
                            enabled = historyIndex > 0,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(Icons.Default.Undo, contentDescription = "Undo", tint = if (historyIndex > 0) AmberEnergizer else TextMuted, modifier = Modifier.size(18.dp))
                        }

                        // Redo
                        IconButton(
                            onClick = { handleRedo() },
                            enabled = historyIndex < history.size - 1,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(Icons.Default.Redo, contentDescription = "Redo", tint = if (historyIndex < history.size - 1) AmberEnergizer else TextMuted, modifier = Modifier.size(18.dp))
                        }
                    }

                    // Action Buttons
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        // Presets
                        IconButton(
                            onClick = { showPresetsDialog = true },
                            modifier = Modifier
                                .size(30.dp)
                                .background(BgCard, RoundedCornerShape(6.dp))
                                .border(1.dp, BorderDark, RoundedCornerShape(6.dp))
                        ) {
                            Icon(Icons.Default.AutoFixHigh, contentDescription = "Presets", tint = AmberEnergizer, modifier = Modifier.size(16.dp))
                        }

                        // Blueprints
                        IconButton(
                            onClick = { showBlueprintDialog = true },
                            modifier = Modifier
                                .size(30.dp)
                                .background(if (canvasState.blueprintType != BlueprintType.NONE) CyanLaser.copy(alpha = 0.2f) else BgCard, RoundedCornerShape(6.dp))
                                .border(1.dp, if (canvasState.blueprintType != BlueprintType.NONE) CyanLaser else BorderDark, RoundedCornerShape(6.dp))
                        ) {
                            Icon(Icons.Default.Map, contentDescription = "Blueprints", tint = if (canvasState.blueprintType != BlueprintType.NONE) CyanLaser else TextMuted, modifier = Modifier.size(16.dp))
                        }

                        // Auto-Wire
                        Button(
                            onClick = { handleAutoWire() },
                            colors = ButtonDefaults.buttonColors(containerColor = AmberDim),
                            border = BorderStroke(1.dp, AmberEnergizer),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("⚡ AUTO", style = MaterialTheme.typography.labelSmall, color = AmberEnergizer, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                        }

                        // SIMULATE
                        Button(
                            onClick = { runNodalSimulation() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0x3360A5FA)),
                            border = BorderStroke(1.dp, BridgeHotBlue),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("▶ SIM", style = MaterialTheme.typography.labelSmall, color = BridgeHotBlue, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                        }

                        // Clear
                        IconButton(
                            onClick = { showClearConfirm = true },
                            modifier = Modifier
                                .size(30.dp)
                                .background(BgCard, RoundedCornerShape(6.dp))
                                .border(1.dp, BorderDark, RoundedCornerShape(6.dp))
                        ) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Clear", tint = TextMuted, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                // SECONDARY QUICK TOGGLES ROW (ORTHO, SNAP, DIMENSIONS, ZONES)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Ortho Lock Toggle
                    Surface(
                        color = if (canvasState.isOrthoEnabled) AmberDim else BgCard,
                        border = BorderStroke(1.dp, if (canvasState.isOrthoEnabled) AmberEnergizer else BorderDark),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.clickable {
                            canvasState = canvasState.copy(isOrthoEnabled = !canvasState.isOrthoEnabled)
                        }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Straighten, contentDescription = null, tint = if (canvasState.isOrthoEnabled) AmberEnergizer else TextMuted, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("ORTHO ${if (canvasState.isOrthoEnabled) "ON" else "OFF"}", style = MaterialTheme.typography.labelSmall, color = if (canvasState.isOrthoEnabled) AmberEnergizer else TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Snap Grid Toggle
                    Surface(
                        color = if (canvasState.isSnapGrid) AmberDim else BgCard,
                        border = BorderStroke(1.dp, if (canvasState.isSnapGrid) AmberEnergizer else BorderDark),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.clickable {
                            canvasState = canvasState.copy(isSnapGrid = !canvasState.isSnapGrid)
                        }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.GridOn, contentDescription = null, tint = if (canvasState.isSnapGrid) AmberEnergizer else TextMuted, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("SNAP GRID", style = MaterialTheme.typography.labelSmall, color = if (canvasState.isSnapGrid) AmberEnergizer else TextMuted, fontSize = 9.sp)
                        }
                    }

                    // Dimensions Toggle
                    Surface(
                        color = if (canvasState.showDimensions) AmberDim else BgCard,
                        border = BorderStroke(1.dp, if (canvasState.showDimensions) AmberEnergizer else BorderDark),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.clickable {
                            canvasState = canvasState.copy(showDimensions = !canvasState.showDimensions)
                        }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AspectRatio, contentDescription = null, tint = if (canvasState.showDimensions) AmberEnergizer else TextMuted, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("DIMENSIONS", style = MaterialTheme.typography.labelSmall, color = if (canvasState.showDimensions) AmberEnergizer else TextMuted, fontSize = 9.sp)
                        }
                    }

                    // Zones Active Selector
                    Surface(
                        color = BgCard,
                        border = BorderStroke(1.dp, BorderDark),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.clickable { showZoneDialog = true }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            val activeZ = zones.find { it.id == activeZoneId }
                            val zColor = try { Color(android.graphics.Color.parseColor(activeZ?.colorHex ?: "#FFB300")) } catch (e: Exception) { AmberEnergizer }
                            Box(modifier = Modifier.size(8.dp).background(zColor, CircleShape))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("ACTIVE: ${activeZ?.name ?: "Zone 1"}", style = MaterialTheme.typography.labelSmall, color = TextPrimary, fontSize = 9.sp)
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = TextMuted, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
        }

        // CAD CANVAS
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            CadCanvasView(
                nodes = nodes,
                wires = wires,
                zones = zones,
                canvasState = canvasState,
                simulationResult = simulationResult,
                onNodeMove = { id, x, y -> handleNodeMove(id, x, y) },
                onNodeSelect = { id -> canvasState = canvasState.copy(selectedNodeId = id, selectedWireId = null) },
                onWireSelect = { id -> canvasState = canvasState.copy(selectedWireId = id, selectedNodeId = null) },
                onPlaceNode = { comp, x, y -> handlePlaceNode(comp, x, y) },
                onWireDrawn = { x1, y1, x2, y2 -> handleWireDrawn(x1, y1, x2, y2) },
                onDeleteNode = { id -> handleDeleteNode(id) },
                onDeleteWire = { id -> handleDeleteWire(id) },
                modifier = Modifier.fillMaxSize()
            )

            // Current Tool Indicator Overlay Badge
            Surface(
                color = BgPanel.copy(alpha = 0.9f),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, AmberEnergizer),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 8.dp)
            ) {
                Text(
                    text = when (canvasState.tool) {
                        CanvasTool.PAN -> "TOOL: PAN & SELECT"
                        CanvasTool.SELECT -> "TOOL: SELECT"
                        CanvasTool.MEASURE -> "TOOL: MEASURE TAPE"
                        CanvasTool.PLACE -> "TOOL: PLACE ${canvasState.pendingComponent?.displayName?.uppercase() ?: "POST"}"
                        CanvasTool.WIRE -> "TOOL: DRAW ${canvasState.wireMode.label.uppercase()} (${canvasState.strandCount}s)"
                        CanvasTool.FAULT -> "TOOL: FAULT INSPECTION"
                        CanvasTool.DELETE -> "TOOL: TAP TO DELETE"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = AmberEnergizer,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
        }

        // BOTTOM CAD TOOLBAR & PALETTE
        Surface(
            color = BgPanel,
            tonalElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // ROW 1: PRIMARY TOOL SELECTOR
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CadToolButton(
                        icon = Icons.Default.PanTool,
                        label = "Pan/Select",
                        selected = canvasState.tool == CanvasTool.PAN,
                        onClick = { canvasState = canvasState.copy(tool = CanvasTool.PAN) }
                    )

                    CadToolButton(
                        icon = Icons.Default.AddLocationAlt,
                        label = "Place",
                        selected = canvasState.tool == CanvasTool.PLACE,
                        onClick = { showComponentPicker = true }
                    )

                    CadToolButton(
                        icon = Icons.Default.LinearScale,
                        label = "Wire",
                        selected = canvasState.tool == CanvasTool.WIRE,
                        onClick = { canvasState = canvasState.copy(tool = CanvasTool.WIRE) }
                    )

                    CadToolButton(
                        icon = Icons.Default.Straighten,
                        label = "Measure",
                        selected = canvasState.tool == CanvasTool.MEASURE,
                        onClick = { canvasState = canvasState.copy(tool = CanvasTool.MEASURE) }
                    )

                    CadToolButton(
                        icon = Icons.Default.Delete,
                        label = "Delete",
                        selected = canvasState.tool == CanvasTool.DELETE,
                        onClick = { canvasState = canvasState.copy(tool = CanvasTool.DELETE) }
                    )
                }

                // ROW 2: WIRE TYPE SELECTOR & STRAND OPTIONS
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("WIRE:", style = MaterialTheme.typography.labelSmall, color = TextMuted)

                    WireType.values().forEach { wt ->
                        val wtColor = when (wt) {
                            WireType.HOT -> HtWireRed
                            WireType.EARTH -> EarthWireGreen
                            WireType.BRIDGE_HOT -> BridgeHotBlue
                            WireType.BRIDGE_EARTH -> BridgeEarthPurple
                        }
                        Box(
                            modifier = Modifier
                                .background(if (canvasState.wireMode == wt) wtColor.copy(alpha = 0.2f) else BgCard, RoundedCornerShape(4.dp))
                                .border(1.dp, if (canvasState.wireMode == wt) wtColor else BorderDark, RoundedCornerShape(4.dp))
                                .clickable { canvasState = canvasState.copy(wireMode = wt, tool = CanvasTool.WIRE) }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(6.dp).background(wtColor, CircleShape))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(wt.label, style = MaterialTheme.typography.labelSmall, color = if (canvasState.wireMode == wt) wtColor else TextMuted)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.width(4.dp))
                    Text("STRANDS:", style = MaterialTheme.typography.labelSmall, color = TextMuted)

                    listOf(1, 3, 5, 8, 12, 20).forEach { sc ->
                        Box(
                            modifier = Modifier
                                .background(if (canvasState.strandCount == sc) AmberDim else BgCard, RoundedCornerShape(4.dp))
                                .border(1.dp, if (canvasState.strandCount == sc) AmberEnergizer else BorderDark, RoundedCornerShape(4.dp))
                                .clickable { canvasState = canvasState.copy(strandCount = sc, tool = CanvasTool.WIRE) }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                        ) {
                            Text("$sc", style = MaterialTheme.typography.labelSmall, color = if (canvasState.strandCount == sc) AmberEnergizer else TextMuted)
                        }
                    }
                }
            }
        }
    }

    // BLUEPRINT TRACING DIALOG
    if (showBlueprintDialog) {
        Dialog(onDismissRequest = { showBlueprintDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "🗺️ BLUEPRINT / SATELLITE TRACING",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Select site plan underlay to trace perimeter lines against architectural structures:",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    BlueprintType.values().forEach { bp ->
                        val isSel = canvasState.blueprintType == bp
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .background(if (isSel) CyanLaser.copy(alpha = 0.15f) else BgCard, RoundedCornerShape(8.dp))
                                .border(1.dp, if (isSel) CyanLaser else BorderDark, RoundedCornerShape(8.dp))
                                .clickable {
                                    canvasState = canvasState.copy(blueprintType = bp)
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(bp.displayName, style = MaterialTheme.typography.titleSmall, color = if (isSel) CyanLaser else TextPrimary, fontWeight = FontWeight.Bold)
                                Text(bp.subtitle, style = MaterialTheme.typography.bodySmall, color = TextMuted, fontSize = 11.sp)
                            }
                            RadioButton(
                                selected = isSel,
                                onClick = { canvasState = canvasState.copy(blueprintType = bp) },
                                colors = RadioButtonDefaults.colors(selectedColor = CyanLaser, unselectedColor = TextMuted)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text("UNDERLAY OPACITY: ${(canvasState.blueprintOpacity * 100).toInt()}%", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Slider(
                        value = canvasState.blueprintOpacity,
                        onValueChange = { canvasState = canvasState.copy(blueprintOpacity = it) },
                        valueRange = 0.1f..1.0f,
                        colors = SliderDefaults.colors(thumbColor = CyanLaser, activeTrackColor = CyanLaser)
                    )

                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        onClick = { showBlueprintDialog = false },
                        colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("APPLY UNDERLAY", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // MULTI-ZONE SECTORING DIALOG
    if (showZoneDialog) {
        Dialog(onDismissRequest = { showZoneDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "🛡️ PERIMETER ZONES MANAGEMENT",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Partition perimeter into independent monitored security sectors:",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    zones.forEach { z ->
                        val isCurrentActive = activeZoneId == z.id
                        val zColor = try { Color(android.graphics.Color.parseColor(z.colorHex)) } catch (e: Exception) { AmberEnergizer }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .background(if (isCurrentActive) AmberDim else BgCard, RoundedCornerShape(8.dp))
                                .border(1.dp, if (isCurrentActive) AmberEnergizer else BorderDark, RoundedCornerShape(8.dp))
                                .clickable {
                                    activeZoneId = z.id
                                    showZoneDialog = false
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.size(16.dp).background(zColor, CircleShape))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(z.name, style = MaterialTheme.typography.titleSmall, color = if (isCurrentActive) AmberEnergizer else TextPrimary, fontWeight = FontWeight.Bold)
                                Text("Zone ID: ${z.id}", style = MaterialTheme.typography.bodySmall, color = TextMuted, fontSize = 10.sp)
                            }
                            if (isCurrentActive) {
                                Text("ACTIVE", style = MaterialTheme.typography.labelSmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        onClick = {
                            val newZone = FenceZone(
                                id = "zone_${zones.size + 1}",
                                name = "Zone ${zones.size + 1}: Sector",
                                colorHex = listOf("#FFB300", "#00E5FF", "#00E676", "#E040FB", "#FF5252")[(zones.size) % 5]
                            )
                            val nextZones = zones + newZone
                            syncProject(nodes, wires, fenceType, nextZones)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BgCard),
                        border = BorderStroke(1.dp, BorderDark),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = AmberEnergizer, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("+ ADD NEW PERIMETER ZONE", color = AmberEnergizer, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }

    // PRESETS TEMPLATE DIALOG
    if (showPresetsDialog) {
        Dialog(onDismissRequest = { showPresetsDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "📐 GENERATE TEMPLATE PRESETS",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Instantly construct standard perimeter topologies:",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    listOf(
                        Pair("Residential Villa (4-Corner)", "Complete 4-sided wall-top fence with sliding gate, earth spike, and energizer"),
                        Pair("Commercial Warehouse", "Heavy industrial 12-strand freestanding fence with truck access gate")
                    ).forEach { (title, desc) ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = BgCard),
                            border = BorderStroke(1.dp, BorderDark),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clickable { loadPreset(title) }
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(title, style = MaterialTheme.typography.titleSmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                                Text(desc, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                            }
                        }
                    }
                }
            }
        }
    }

    // COMPONENT PICKER DIALOG
    if (showComponentPicker) {
        Dialog(onDismissRequest = { showComponentPicker = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "▶ PLACE COMPONENT",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Select component to place onto CAD grid:",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    ComponentType.values().forEach { comp ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = BgCard),
                            border = BorderStroke(1.dp, BorderDark),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clickable {
                                    canvasState = canvasState.copy(
                                        pendingComponent = comp,
                                        tool = CanvasTool.PLACE
                                    )
                                    showComponentPicker = false
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .background(BgDark, CircleShape)
                                        .border(1.dp, AmberEnergizer, CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(comp.iconChar, fontSize = 16.sp)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = comp.displayName,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = comp.subtitle,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextMuted
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // CLEAR CONFIRMATION DIALOG
    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            title = { Text("Clear Canvas Layout?") },
            text = { Text("This will erase all fence nodes, posts, and wire spans in the current project.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        syncProject(emptyList(), emptyList(), fenceType)
                        showClearConfirm = false
                    }
                ) {
                    Text("CLEAR ALL", color = RedFault, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) {
                    Text("CANCEL", color = TextMuted)
                }
            },
            containerColor = BgPanel
        )
    }

    // SIMULATION RESULT BOTTOM SHEET
    if (showSimulationSheet && simulationResult != null) {
        val result = simulationResult!!
        ModalBottomSheet(
            onDismissRequest = { showSimulationSheet = false },
            containerColor = BgPanel
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "⚡ NODAL ELECTRICAL SIMULATION",
                    style = MaterialTheme.typography.titleMedium,
                    color = AmberEnergizer,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Status: ${result.status}",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (result.hasFault) RedFault else GreenOptimal,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MetricBox(
                        title = "MAX VOLTAGE",
                        value = "${String.format("%.1f", result.maxVoltageKV)} kV",
                        color = if (result.maxVoltageKV >= 6.0) GreenOptimal else RedFault,
                        modifier = Modifier.weight(1f)
                    )
                    MetricBox(
                        title = "MIN VOLTAGE",
                        value = "${String.format("%.1f", result.minVoltageKV)} kV",
                        color = if (result.minVoltageKV >= 3.0) CyanLaser else RedFault,
                        modifier = Modifier.weight(1f)
                    )
                    MetricBox(
                        title = "PULSE CURRENT",
                        value = "${String.format("%.1f", result.pulseCurrentAmps)} A",
                        color = AmberEnergizer,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { showSimulationSheet = false },
                    colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("CLOSE SIMULATION", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    // VALIDATION RESULT BOTTOM SHEET
    if (showValidationSheet && validationResult != null) {
        val result = validationResult!!
        ModalBottomSheet(
            onDismissRequest = { showValidationSheet = false },
            containerColor = BgPanel
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "✓ SANS 10222-3 COMPLIANCE AUDIT",
                    style = MaterialTheme.typography.titleMedium,
                    color = if (result.passed) GreenOptimal else RedFault,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(12.dp))

                val errors = result.issues.filter { it.severity == IssueSeverity.ERROR }
                val warnings = result.issues.filter { it.severity == IssueSeverity.WARN }

                errors.forEach { err ->
                    Text("❌ ${err.title}: ${err.detail}", color = RedFault, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 2.dp))
                }
                warnings.forEach { warn ->
                    Text("⚠️ ${warn.title}: ${warn.detail}", color = SuspectYellow, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 2.dp))
                }

                if (errors.isEmpty() && warnings.isEmpty()) {
                    Text("🟢 100% SANS 10222-3 Certified: All clearances and return loops verified.", color = GreenOptimal, style = MaterialTheme.typography.bodyMedium)
                }

                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { showValidationSheet = false },
                    colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("CLOSE AUDIT", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun MetricBox(
    title: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = BgCard,
        border = BorderStroke(1.dp, BorderDark),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(title, style = MaterialTheme.typography.labelSmall, color = TextMuted, fontSize = 9.sp)
            Text(value, style = MaterialTheme.typography.titleSmall, color = color, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CadToolButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        color = if (selected) AmberDim else BgCard,
        border = BorderStroke(1.dp, if (selected) AmberEnergizer else BorderDark),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (selected) AmberEnergizer else TextMuted,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = if (selected) AmberEnergizer else TextMuted,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
            )
        }
    }
}
