package com.fencecad.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
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
import com.fencecad.model.*
import com.fencecad.ui.theme.*
import kotlin.math.*

const val CAD_SNAP = 20f

@Composable
fun CadCanvasView(
    nodes: List<FenceNode>,
    wires: List<FenceWire>,
    zones: List<FenceZone>,
    canvasState: CanvasState,
    simulationResult: SimulationResult?,
    onNodeMove: (String, Float, Float) -> Unit,
    onNodeSelect: (String?) -> Unit,
    onWireSelect: (String?) -> Unit,
    onPlaceNode: (ComponentType, Float, Float) -> Unit,
    onWireDrawn: (Float, Float, Float, Float) -> Unit,
    onDeleteNode: (String) -> Unit,
    onDeleteWire: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var panX by remember { mutableStateOf(canvasState.panX) }
    var panY by remember { mutableStateOf(canvasState.panY) }
    var scale by remember { mutableStateOf(canvasState.scale.coerceIn(0.25f, 5.0f)) }

    // Live wire drawing rubber-band state
    var isDrawingWire by remember { mutableStateOf(false) }
    var wireStartX by remember { mutableStateOf(0f) }
    var wireStartY by remember { mutableStateOf(0f) }
    var wireCurrentX by remember { mutableStateOf(0f) }
    var wireCurrentY by remember { mutableStateOf(0f) }

    // Live dragging node
    var draggingNodeId by remember { mutableStateOf<String?>(null) }

    // Pulse animation for simulated current flow
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulsePhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pulsePhase"
    )

    val textMeasurer = rememberTextMeasurer()

    fun snap(v: Float) = if (canvasState.isSnapGrid) (round(v / CAD_SNAP) * CAD_SNAP) else v

    fun applyOrtho(sx: Float, sy: Float, cx: Float, cy: Float): Pair<Float, Float> {
        if (!canvasState.isOrthoEnabled) return Pair(cx, cy)
        val dx = cx - sx
        val dy = cy - sy
        val dist = hypot(dx, dy)
        if (dist < 5f) return Pair(cx, cy)

        val angleRad = atan2(dy, dx)
        val angleDeg = (Math.toDegrees(angleRad.toDouble()) + 360.0) % 360.0
        val snapDeg = (round(angleDeg / 45.0) * 45.0) % 360.0
        val snapRad = Math.toRadians(snapDeg)

        val ox = sx + (dist * cos(snapRad)).toFloat()
        val oy = sy + (dist * sin(snapRad)).toFloat()
        return Pair(snap(ox), snap(oy))
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
            .pointerInput(canvasState.tool, nodes, wires, canvasState.isSnapGrid, canvasState.isOrthoEnabled) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    var isMultiTouch = false
                    var isDraggingAction = false
                    var dragTargetNodeId: String? = null
                    val startDownPos = down.position
                    var lastSinglePos = startDownPos
                    val startTime = System.currentTimeMillis()

                    val initialSafeScale = if (scale > 0f) scale else 1.0f
                    val initialWorldX = (startDownPos.x - panX) / initialSafeScale
                    val initialWorldY = (startDownPos.y - panY) / initialSafeScale
                    val touchTolerance = (28f / initialSafeScale).coerceIn(24f, 48f)
                    val hitNodeOnDown = nodes.find { hypot(it.x - initialWorldX, it.y - initialWorldY) < touchTolerance }

                    if (canvasState.tool == CanvasTool.WIRE || canvasState.tool == CanvasTool.MEASURE) {
                        val nearNode = nodes.find { hypot(it.x - initialWorldX, it.y - initialWorldY) < 30f }
                        wireStartX = nearNode?.x ?: snap(initialWorldX)
                        wireStartY = nearNode?.y ?: snap(initialWorldY)
                        wireCurrentX = wireStartX
                        wireCurrentY = wireStartY
                    } else if (canvasState.tool == CanvasTool.SELECT || canvasState.tool == CanvasTool.PAN) {
                        if (hitNodeOnDown != null) {
                            dragTargetNodeId = hitNodeOnDown.id
                            draggingNodeId = hitNodeOnDown.id
                            onNodeSelect(hitNodeOnDown.id)
                        }
                    }

                    while (true) {
                        val event = awaitPointerEvent()
                        val activePointers = event.changes.filter { it.pressed }

                        if (activePointers.isEmpty()) {
                            break
                        }

                        if (activePointers.size >= 2) {
                            // Multi-touch Pinch to Zoom & Pan
                            isMultiTouch = true
                            if (isDrawingWire) {
                                isDrawingWire = false
                            }
                            draggingNodeId = null
                            dragTargetNodeId = null

                            val p0 = activePointers[0].position
                            val p1 = activePointers[1].position
                            val prevP0 = activePointers[0].previousPosition
                            val prevP1 = activePointers[1].previousPosition

                            val currentDist = hypot(p0.x - p1.x, p0.y - p1.y)
                            val prevDist = hypot(prevP0.x - prevP1.x, prevP0.y - prevP1.y)

                            val centroid = Offset((p0.x + p1.x) / 2f, (p0.y + p1.y) / 2f)
                            val prevCentroid = Offset((prevP0.x + prevP1.x) / 2f, (prevP0.y + prevP1.y) / 2f)
                            val panDelta = Offset(centroid.x - prevCentroid.x, centroid.y - prevCentroid.y)

                            if (prevDist > 8f && currentDist > 8f) {
                                val zoomFactor = currentDist / prevDist
                                if (zoomFactor.isFinite() && zoomFactor > 0.001f) {
                                    val oldScale = scale
                                    val newScale = (oldScale * zoomFactor).coerceIn(0.25f, 5.0f)
                                    if (oldScale > 0.001f) {
                                        panX = centroid.x - (centroid.x - panX) * (newScale / oldScale)
                                        panY = centroid.y - (centroid.y - panY) * (newScale / oldScale)
                                    }
                                    scale = newScale
                                }
                            }
                            if (panDelta.x.isFinite()) panX += panDelta.x
                            if (panDelta.y.isFinite()) panY += panDelta.y

                            activePointers.forEach { it.consume() }
                        } else if (activePointers.size == 1 && !isMultiTouch) {
                            val pointer = activePointers[0]
                            val currentPos = pointer.position
                            val totalDragDist = hypot(currentPos.x - startDownPos.x, currentPos.y - startDownPos.y)

                            if (totalDragDist > 10f) {
                                isDraggingAction = true
                            }

                            if (isDraggingAction) {
                                val dragDelta = Offset(currentPos.x - lastSinglePos.x, currentPos.y - lastSinglePos.y)
                                val currentSafeScale = if (scale > 0f) scale else 1.0f

                                if (canvasState.tool == CanvasTool.WIRE || canvasState.tool == CanvasTool.MEASURE) {
                                    isDrawingWire = true
                                    val currentWorldX = (currentPos.x - panX) / currentSafeScale
                                    val currentWorldY = (currentPos.y - panY) / currentSafeScale
                                    val (orthoX, orthoY) = applyOrtho(wireStartX, wireStartY, currentWorldX, currentWorldY)
                                    wireCurrentX = orthoX
                                    wireCurrentY = orthoY
                                } else if (dragTargetNodeId != null) {
                                    val targetNode = nodes.find { it.id == dragTargetNodeId }
                                    if (targetNode != null) {
                                        val newX = snap(targetNode.x + dragDelta.x / currentSafeScale)
                                        val newY = snap(targetNode.y + dragDelta.y / currentSafeScale)
                                        onNodeMove(dragTargetNodeId, newX, newY)
                                    }
                                } else if (canvasState.tool == CanvasTool.PAN || canvasState.tool == CanvasTool.SELECT) {
                                    if (dragDelta.x.isFinite()) panX += dragDelta.x
                                    if (dragDelta.y.isFinite()) panY += dragDelta.y
                                }
                                pointer.consume()
                            }
                            lastSinglePos = currentPos
                        }
                    }

                    // Gesture ended
                    val duration = System.currentTimeMillis() - startTime
                    val finalSafeScale = if (scale > 0f) scale else 1.0f

                    if (!isMultiTouch) {
                        if (!isDraggingAction && duration < 500) {
                            // Single tap
                            val tapWorldX = (startDownPos.x - panX) / finalSafeScale
                            val tapWorldY = (startDownPos.y - panY) / finalSafeScale

                            when (canvasState.tool) {
                                CanvasTool.PLACE -> {
                                    val comp = canvasState.pendingComponent ?: ComponentType.POST
                                    onPlaceNode(comp, snap(tapWorldX), snap(tapWorldY))
                                }
                                CanvasTool.DELETE -> {
                                    val hitNode = nodes.find { hypot(it.x - tapWorldX, it.y - tapWorldY) < (28f / finalSafeScale).coerceIn(20f, 40f) }
                                    if (hitNode != null) {
                                        onDeleteNode(hitNode.id)
                                    } else {
                                        val hitWire = wires.find { distToSegment(tapWorldX, tapWorldY, it.x1, it.y1, it.x2, it.y2) < (18f / finalSafeScale).coerceIn(14f, 30f) }
                                        if (hitWire != null) {
                                            onDeleteWire(hitWire.id)
                                        }
                                    }
                                }
                                CanvasTool.FAULT, CanvasTool.SELECT, CanvasTool.PAN -> {
                                    val hitNode = nodes.find { hypot(it.x - tapWorldX, it.y - tapWorldY) < (28f / finalSafeScale).coerceIn(20f, 40f) }
                                    if (hitNode != null) {
                                        onNodeSelect(hitNode.id)
                                    } else {
                                        val hitWire = wires.find { distToSegment(tapWorldX, tapWorldY, it.x1, it.y1, it.x2, it.y2) < (18f / finalSafeScale).coerceIn(14f, 30f) }
                                        onWireSelect(hitWire?.id)
                                        if (hitWire == null) onNodeSelect(null)
                                    }
                                }
                                CanvasTool.WIRE, CanvasTool.MEASURE -> {}
                            }
                        } else if (isDrawingWire && (canvasState.tool == CanvasTool.WIRE || canvasState.tool == CanvasTool.MEASURE)) {
                            val (orthoX, orthoY) = applyOrtho(wireStartX, wireStartY, wireCurrentX, wireCurrentY)
                            val nearEndNode = nodes.find { hypot(it.x - orthoX, it.y - orthoY) < 30f }
                            val finalX = nearEndNode?.x ?: snap(orthoX)
                            val finalY = nearEndNode?.y ?: snap(orthoY)

                            if (hypot(finalX - wireStartX, finalY - wireStartY) > 15f && canvasState.tool == CanvasTool.WIRE) {
                                onWireDrawn(wireStartX, wireStartY, finalX, finalY)
                            }
                        }
                    }

                    isDrawingWire = false
                    draggingNodeId = null
                }
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // 1. Draw Architectural Blueprint Underlay (if selected)
            if (canvasState.blueprintType != BlueprintType.NONE) {
                drawBlueprintUnderlay(
                    blueprintType = canvasState.blueprintType,
                    opacity = canvasState.blueprintOpacity,
                    panX = panX,
                    panY = panY,
                    scale = scale,
                    textMeasurer = textMeasurer
                )
            }

            // 2. Draw CAD Matrix Grid
            drawCadGrid(panX, panY, scale, size.width, size.height)

            // Helper zone color lookup
            fun getZoneColor(zoneId: String?, defaultColor: Color): Color {
                val z = zones.find { it.id == zoneId } ?: return defaultColor
                return try {
                    Color(android.graphics.Color.parseColor(z.colorHex))
                } catch (e: Exception) {
                    defaultColor
                }
            }

            // 3. Draw Wires
            for (wire in wires) {
                val x1 = panX + wire.x1 * scale
                val y1 = panY + wire.y1 * scale
                val x2 = panX + wire.x2 * scale
                val y2 = panY + wire.y2 * scale

                val isSelected = wire.id == canvasState.selectedWireId
                val baseColor = when (wire.type) {
                    WireType.HOT -> HtWireRed
                    WireType.EARTH -> EarthWireGreen
                    WireType.BRIDGE_HOT -> BridgeHotBlue
                    WireType.BRIDGE_EARTH -> BridgeEarthPurple
                }
                val wireColor = if (wire.type == WireType.HOT) getZoneColor(wire.zoneId, baseColor) else baseColor

                val strokeW = when {
                    isSelected -> 4.8f * scale
                    wire.type == WireType.BRIDGE_HOT || wire.type == WireType.BRIDGE_EARTH -> 2.2f * scale
                    else -> 3.2f * scale
                }

                if (isSelected) {
                    drawLine(
                        color = AmberEnergizer.copy(alpha = 0.45f),
                        start = Offset(x1, y1),
                        end = Offset(x2, y2),
                        strokeWidth = strokeW + 7f * scale
                    )
                }

                drawLine(
                    color = wireColor,
                    start = Offset(x1, y1),
                    end = Offset(x2, y2),
                    strokeWidth = strokeW
                )

                // Wire length and angle dimension badge
                if (canvasState.showDimensions) {
                    val midX = (x1 + x2) / 2f
                    val midY = (y1 + y2) / 2f
                    val dx = wire.x2 - wire.x1
                    val dy = wire.y2 - wire.y1
                    val lenM = hypot(dx, dy)
                    val angleDeg = ((Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())) + 360.0) % 360.0).toInt()

                    val labelText = "${String.format("%.1f", lenM)}m ∠${angleDeg}°"
                    drawRoundRect(
                        color = BgCard.copy(alpha = 0.90f),
                        topLeft = Offset(midX - 28f * scale, midY - 9f * scale),
                        size = Size(56f * scale, 18f * scale),
                        cornerRadius = CornerRadius(4f * scale, 4f * scale)
                    )
                    drawRoundRect(
                        color = BorderDark,
                        topLeft = Offset(midX - 28f * scale, midY - 9f * scale),
                        size = Size(56f * scale, 18f * scale),
                        cornerRadius = CornerRadius(4f * scale, 4f * scale),
                        style = Stroke(width = 0.8f * scale)
                    )
                    drawText(
                        textMeasurer = textMeasurer,
                        text = labelText,
                        topLeft = Offset(midX - 25f * scale, midY - 7f * scale),
                        style = TextStyle(color = AmberEnergizer, fontSize = (7.5f * scale).coerceIn(6f, 11f).sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    )
                }

                // Animated current pulse if simulation is running
                if (simulationResult != null && simulationResult.pulseCurrentAmps > 0) {
                    val px = x1 + (x2 - x1) * pulsePhase
                    val py = y1 + (y2 - y1) * pulsePhase
                    drawCircle(
                        color = if (wire.type == WireType.HOT) AmberEnergizer else EarthWireGreen,
                        radius = 4.5f * scale,
                        center = Offset(px, py)
                    )
                }
            }

            // 4. Draw Live Wire Rubberband Preview with live dimension callout
            if (isDrawingWire) {
                val sx = panX + wireStartX * scale
                val sy = panY + wireStartY * scale
                val cx = panX + wireCurrentX * scale
                val cy = panY + wireCurrentY * scale
                val previewColor = when (canvasState.wireMode) {
                    WireType.HOT -> HtWireRed
                    WireType.EARTH -> EarthWireGreen
                    WireType.BRIDGE_HOT -> BridgeHotBlue
                    WireType.BRIDGE_EARTH -> BridgeEarthPurple
                }

                drawLine(
                    color = if (canvasState.tool == CanvasTool.MEASURE) CyanLaser else previewColor,
                    start = Offset(sx, sy),
                    end = Offset(cx, cy),
                    strokeWidth = 2.8f * scale,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 5f))
                )

                // Live distance badge during drawing
                val dLen = hypot(wireCurrentX - wireStartX, wireCurrentY - wireStartY)
                val midX = (sx + cx) / 2f
                val midY = (sy + cy) / 2f
                val liveBadge = if (canvasState.isOrthoEnabled) "📐 ${String.format("%.1f", dLen)}m [ORTHO]" else "${String.format("%.1f", dLen)}m"

                drawRoundRect(
                    color = BgPanel,
                    topLeft = Offset(midX - 32f * scale, midY - 10f * scale),
                    size = Size(64f * scale, 20f * scale),
                    cornerRadius = CornerRadius(4f * scale, 4f * scale)
                )
                drawText(
                    textMeasurer = textMeasurer,
                    text = liveBadge,
                    topLeft = Offset(midX - 28f * scale, midY - 8f * scale),
                    style = TextStyle(color = AmberEnergizer, fontSize = (8 * scale).coerceIn(7f, 12f).sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                )
            }

            // 5. Draw Component Nodes
            for (node in nodes) {
                val nx = panX + node.x * scale
                val ny = panY + node.y * scale
                val isSelected = node.id == canvasState.selectedNodeId

                drawComponentNode(
                    node = node,
                    cx = nx,
                    cy = ny,
                    scale = scale,
                    isSelected = isSelected,
                    simulationResult = simulationResult,
                    textMeasurer = textMeasurer
                )
            }
        }

        // 6. Floating On-Screen Zoom & View Controls Overlay
        Surface(
            color = BgPanel.copy(alpha = 0.92f),
            shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, BorderDark),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                // Zoom In
                IconButton(
                    onClick = {
                        val newScale = (scale * 1.25f).coerceIn(0.25f, 5.0f)
                        scale = newScale
                    },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Zoom In", tint = AmberEnergizer, modifier = Modifier.size(18.dp))
                }

                // Scale percent chip / tap to 100%
                Surface(
                    color = BgCard,
                    shape = RoundedCornerShape(4.dp),
                    border = BorderStroke(0.8.dp, BorderDark),
                    modifier = Modifier.clickable {
                        scale = 1.0f
                        panX = 0f
                        panY = 0f
                    }
                ) {
                    Text(
                        text = "${(scale * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = AmberEnergizer,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                    )
                }

                // Zoom Out
                IconButton(
                    onClick = {
                        val newScale = (scale * 0.8f).coerceIn(0.25f, 5.0f)
                        scale = newScale
                    },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "Zoom Out", tint = AmberEnergizer, modifier = Modifier.size(18.dp))
                }

                // Reset / Fit
                IconButton(
                    onClick = {
                        scale = 1.0f
                        panX = 0f
                        panY = 0f
                    },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.CenterFocusStrong, contentDescription = "Center View", tint = TextMuted, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

private fun DrawScope.drawBlueprintUnderlay(
    blueprintType: BlueprintType,
    opacity: Float,
    panX: Float,
    panY: Float,
    scale: Float,
    textMeasurer: TextMeasurer
) {
    val alpha = opacity.coerceIn(0.1f, 1.0f)
    val siteColor = Color(0xFF0D2838).copy(alpha = alpha * 0.4f)
    val structColor = Color(0xFF1E3A5F).copy(alpha = alpha * 0.7f)
    val accentColor = Color(0xFF00E5FF).copy(alpha = alpha)

    when (blueprintType) {
        BlueprintType.RESIDENTIAL_VILLA -> {
            // Property boundary
            val bx = panX + 40f * scale
            val by = panY + 40f * scale
            val bw = 240f * scale
            val bh = 180f * scale
            drawRoundRect(color = siteColor, topLeft = Offset(bx, by), size = Size(bw, bh), cornerRadius = CornerRadius(6f * scale, 6f * scale))
            drawRoundRect(color = accentColor.copy(alpha = 0.5f), topLeft = Offset(bx, by), size = Size(bw, bh), cornerRadius = CornerRadius(6f * scale, 6f * scale), style = Stroke(1.5f * scale))

            // House Main Body
            val hx = bx + 40f * scale
            val hy = by + 30f * scale
            drawRect(color = structColor, topLeft = Offset(hx, hy), size = Size(120f * scale, 90f * scale))
            drawRect(color = accentColor, topLeft = Offset(hx, hy), size = Size(120f * scale, 90f * scale), style = Stroke(1.2f * scale))
            drawText(textMeasurer, "MAIN RESIDENCE (2-STORY)", Offset(hx + 10f * scale, hy + 38f * scale), TextStyle(color = accentColor, fontSize = (7f * scale).coerceIn(6f, 10f).sp))

            // Swimming Pool
            val px = bx + 180f * scale
            val py = by + 50f * scale
            drawRoundRect(color = Color(0xFF006699).copy(alpha = alpha * 0.6f), topLeft = Offset(px, py), size = Size(40f * scale, 60f * scale), cornerRadius = CornerRadius(8f * scale, 8f * scale))
            drawText(textMeasurer, "POOL", Offset(px + 8f * scale, py + 24f * scale), TextStyle(color = Color(0xFF00E5FF), fontSize = (6f * scale).coerceIn(5f, 9f).sp))

            // Driveway Access
            drawLine(accentColor.copy(alpha = 0.4f), Offset(bx + 70f * scale, by + 180f * scale), Offset(bx + 70f * scale, by + 120f * scale), strokeWidth = 2f * scale, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f)))
            drawLine(accentColor.copy(alpha = 0.4f), Offset(bx + 110f * scale, by + 180f * scale), Offset(bx + 110f * scale, by + 120f * scale), strokeWidth = 2f * scale, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f)))
            drawText(textMeasurer, "MOTOR DRIVEWAY / ENTRY", Offset(bx + 62f * scale, by + 160f * scale), TextStyle(color = TextMuted, fontSize = (6f * scale).coerceIn(5f, 8f).sp))
        }

        BlueprintType.COMMERCIAL_WAREHOUSE -> {
            val bx = panX + 30f * scale
            val by = panY + 30f * scale
            val bw = 300f * scale
            val bh = 220f * scale
            drawRoundRect(color = siteColor, topLeft = Offset(bx, by), size = Size(bw, bh), cornerRadius = CornerRadius(6f * scale, 6f * scale))
            drawRoundRect(color = accentColor.copy(alpha = 0.5f), topLeft = Offset(bx, by), size = Size(bw, bh), cornerRadius = CornerRadius(6f * scale, 6f * scale), style = Stroke(1.5f * scale))

            // Warehouse building
            val wx = bx + 60f * scale
            val wy = by + 40f * scale
            drawRect(color = structColor, topLeft = Offset(wx, wy), size = Size(180f * scale, 120f * scale))
            drawRect(color = accentColor, topLeft = Offset(wx, wy), size = Size(180f * scale, 120f * scale), style = Stroke(1.5f * scale))
            drawText(textMeasurer, "INDUSTRIAL LOGISTICS WAREHOUSE (3,500 m²)", Offset(wx + 12f * scale, wy + 50f * scale), TextStyle(color = accentColor, fontSize = (7.5f * scale).coerceIn(6f, 10f).sp, fontWeight = FontWeight.Bold))

            // Loading bays
            drawText(textMeasurer, "TRUCK LOADING YARD", Offset(bx + 70f * scale, by + 185f * scale), TextStyle(color = TextMuted, fontSize = (6.5f * scale).coerceIn(5f, 9f).sp))
        }

        BlueprintType.FARM_PADDOCK, BlueprintType.HIGH_SECURITY_ESTATE, BlueprintType.NONE -> {
            // Clean grid underlay
        }
    }
}

private fun DrawScope.drawCadGrid(panX: Float, panY: Float, scale: Float, w: Float, h: Float) {
    if (!scale.isFinite() || scale <= 0f) return
    val step = CAD_SNAP * scale
    if (!step.isFinite() || step < 7f) return

    val startX = ((panX % step) + step) % step
    val startY = ((panY % step) + step) % step

    var x = startX
    var countX = 0
    while (x < w && countX < 400) {
        drawLine(
            color = BorderDark.copy(alpha = 0.4f),
            start = Offset(x, 0f),
            end = Offset(x, h),
            strokeWidth = 0.6f
        )
        x += step
        countX++
    }

    var y = startY
    var countY = 0
    while (y < h && countY < 400) {
        drawLine(
            color = BorderDark.copy(alpha = 0.4f),
            start = Offset(0f, y),
            end = Offset(w, y),
            strokeWidth = 0.6f
        )
        y += step
        countY++
    }
}

private fun DrawScope.drawComponentNode(
    node: FenceNode,
    cx: Float,
    cy: Float,
    scale: Float,
    isSelected: Boolean,
    simulationResult: SimulationResult?,
    textMeasurer: TextMeasurer
) {
    val nodeR = 14f * scale

    if (isSelected) {
        drawCircle(
            color = AmberEnergizer.copy(alpha = 0.35f),
            radius = nodeR + 7f * scale,
            center = Offset(cx, cy)
        )
    }

    when (node.type) {
        ComponentType.ENERGIZER -> {
            val boxW = 34f * scale
            val boxH = 34f * scale
            drawRoundRect(
                color = Color(0xFF1E1700),
                topLeft = Offset(cx - boxW / 2f, cy - boxH / 2f),
                size = Size(boxW, boxH),
                cornerRadius = CornerRadius(4f * scale, 4f * scale)
            )
            drawRoundRect(
                color = AmberEnergizer,
                topLeft = Offset(cx - boxW / 2f, cy - boxH / 2f),
                size = Size(boxW, boxH),
                cornerRadius = CornerRadius(4f * scale, 4f * scale),
                style = Stroke(width = 2f * scale)
            )
            val boltPath = Path().apply {
                moveTo(cx + 1f * scale, cy - 10f * scale)
                lineTo(cx - 5f * scale, cy + 1f * scale)
                lineTo(cx, cy + 1f * scale)
                lineTo(cx - 3f * scale, cy + 10f * scale)
                lineTo(cx + 6f * scale, cy - 2f * scale)
                lineTo(cx + 1f * scale, cy - 2f * scale)
                close()
            }
            drawPath(boltPath, AmberEnergizer)
        }
        ComponentType.EARTH_SPIKE -> {
            drawCircle(color = BgCard, radius = nodeR, center = Offset(cx, cy))
            drawCircle(color = SpikeGray, radius = nodeR, center = Offset(cx, cy), style = Stroke(width = 1.8f * scale))
            drawLine(SpikeGray, Offset(cx - 8f * scale, cy - 2f * scale), Offset(cx + 8f * scale, cy - 2f * scale), strokeWidth = 1.5f * scale)
            drawLine(SpikeGray, Offset(cx - 5f * scale, cy + 3f * scale), Offset(cx + 5f * scale, cy + 3f * scale), strokeWidth = 1.5f * scale)
            drawLine(SpikeGray, Offset(cx - 2f * scale, cy + 8f * scale), Offset(cx + 2f * scale, cy + 8f * scale), strokeWidth = 1.5f * scale)
        }
        ComponentType.GATE -> {
            val gateW = 28f * scale
            val gateH = 20f * scale
            drawRoundRect(
                color = Color(0xFF1E1700),
                topLeft = Offset(cx - gateW / 2f, cy - gateH / 2f),
                size = Size(gateW, gateH),
                cornerRadius = CornerRadius(3f * scale, 3f * scale)
            )
            drawRoundRect(
                color = FaultOrange,
                topLeft = Offset(cx - gateW / 2f, cy - gateH / 2f),
                size = Size(gateW, gateH),
                cornerRadius = CornerRadius(3f * scale, 3f * scale),
                style = Stroke(width = 1.5f * scale)
            )
            drawText(
                textMeasurer = textMeasurer,
                text = "GATE",
                topLeft = Offset(cx - 11f * scale, cy - 5f * scale),
                style = TextStyle(color = FaultOrange, fontSize = (7 * scale).coerceIn(6f, 10f).sp, fontWeight = FontWeight.Bold)
            )
        }
        ComponentType.CORNER -> {
            drawCircle(color = Color(0xFF1E293B), radius = nodeR, center = Offset(cx, cy))
            drawCircle(color = PostGray, radius = nodeR, center = Offset(cx, cy), style = Stroke(width = 2f * scale))
            drawCircle(color = AmberEnergizer, radius = 4f * scale, center = Offset(cx, cy))
        }
        ComponentType.POST -> {
            drawCircle(color = Color(0xFF111827), radius = nodeR - 2f * scale, center = Offset(cx, cy))
            drawCircle(color = TextMuted, radius = nodeR - 2f * scale, center = Offset(cx, cy), style = Stroke(width = 1.5f * scale))
            drawCircle(color = TextMuted, radius = 3f * scale, center = Offset(cx, cy))
        }
    }

    drawText(
        textMeasurer = textMeasurer,
        text = node.label,
        topLeft = Offset(cx - 24f * scale, cy + nodeR + 2f * scale),
        style = TextStyle(color = TextPrimary, fontSize = (8 * scale).coerceIn(7f, 12f).sp, fontFamily = FontFamily.Monospace)
    )

    if (simulationResult != null) {
        val nodeLiveKey = "${node.id}_live"
        val nodeJuncKey = "${node.id}_junc"
        val vResult = simulationResult.nodeVoltages[nodeLiveKey] ?: simulationResult.nodeVoltages[nodeJuncKey] ?: simulationResult.nodeVoltages[node.id]

        if (vResult != null) {
            val vColor = if (vResult.isWarning) HtWireRed else if (vResult.isDrop) SuspectYellow else EarthWireGreen
            val vText = "${String.format("%.1f", vResult.voltageKV)}kV"

            drawRoundRect(
                color = BgPanel,
                topLeft = Offset(cx - 18f * scale, cy - nodeR - 16f * scale),
                size = Size(36f * scale, 14f * scale),
                cornerRadius = CornerRadius(3f * scale, 3f * scale)
            )
            drawRoundRect(
                color = vColor,
                topLeft = Offset(cx - 18f * scale, cy - nodeR - 16f * scale),
                size = Size(36f * scale, 14f * scale),
                cornerRadius = CornerRadius(3f * scale, 3f * scale),
                style = Stroke(width = 1f * scale)
            )
            drawText(
                textMeasurer = textMeasurer,
                text = vText,
                topLeft = Offset(cx - 14f * scale, cy - nodeR - 14f * scale),
                style = TextStyle(color = vColor, fontSize = (7 * scale).coerceIn(6f, 10f).sp, fontWeight = FontWeight.Bold)
            )
        }
    }
}

private fun distToSegment(px: Float, py: Float, x1: Float, y1: Float, x2: Float, y2: Float): Float {
    val l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
    if (l2 == 0f) return hypot(px - x1, py - y1)
    val t = max(0f, min(1f, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2))
    val projX = x1 + t * (x2 - x1)
    val projY = y1 + t * (y2 - y1)
    return hypot(px - projX, py - projY)
}
