package com.fencecad.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fencecad.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    onDone: () -> Unit
) {
    val messages = listOf("INITIALISING...", "LOADING CIRCUIT SOLVER...", "CHECKING SANS 10222-3...", "FENCE ENGINE ONLINE ✓")
    var messageIndex by remember { mutableStateOf(0) }
    var progress by remember { mutableStateOf(0f) }

    val infiniteTransition = rememberInfiniteTransition(label = "boltPulse")
    val boltScale by infiniteTransition.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "boltScale"
    )

    LaunchedEffect(Unit) {
        for (i in messages.indices) {
            messageIndex = i
            val targetProgress = when (i) {
                0 -> 0.25f
                1 -> 0.55f
                2 -> 0.85f
                else -> 1f
            }
            val startP = progress
            val steps = 20
            for (step in 1..steps) {
                progress = startP + (targetProgress - startP) * (step.toFloat() / steps)
                delay(25)
            }
            delay(350)
        }
        delay(400)
        onDone()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF141D2B), BgDark),
                    center = Offset(400f, 600f),
                    radius = 800f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            // GRAPHIC CAD ICON
            Box(
                modifier = Modifier
                    .size(130.dp)
                    .background(BgCard, RoundedCornerShape(28.dp))
                    .border(2.dp, AmberEnergizer.copy(alpha = 0.5f), RoundedCornerShape(28.dp)),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.size(100.dp)) {
                    val w = size.width
                    val h = size.height

                    // Corner posts
                    drawLine(PostGray, Offset(16f, 15f), Offset(16f, h - 15f), strokeWidth = 5f)
                    drawLine(PostGray, Offset(w - 16f, 15f), Offset(w - 16f, h - 15f), strokeWidth = 5f)

                    // HT Live wire strands
                    listOf(26f, 50f, 74f).forEach { y ->
                        drawLine(HtWireRed, Offset(10f, y), Offset(w - 10f, y), strokeWidth = 2.5f)
                    }

                    // Earth return strands
                    listOf(38f, 62f).forEach { y ->
                        drawLine(EarthWireGreen, Offset(10f, y), Offset(w - 10f, y), strokeWidth = 2f)
                    }

                    // Energizer center badge
                    val eSize = 36f * boltScale
                    drawRoundRect(
                        color = Color(0xFF1E1700),
                        topLeft = Offset(w / 2f - eSize / 2f, h / 2f - eSize / 2f),
                        size = Size(eSize, eSize),
                        cornerRadius = CornerRadius(6f, 6f)
                    )
                    drawRoundRect(
                        color = AmberEnergizer,
                        topLeft = Offset(w / 2f - eSize / 2f, h / 2f - eSize / 2f),
                        size = Size(eSize, eSize),
                        cornerRadius = CornerRadius(6f, 6f),
                        style = Stroke(width = 2f)
                    )

                    // Bolt
                    val bp = Path().apply {
                        val cx = w / 2f
                        val cy = h / 2f
                        moveTo(cx + 1f, cy - 10f * boltScale)
                        lineTo(cx - 5f * boltScale, cy + 1f)
                        lineTo(cx, cy + 1f)
                        lineTo(cx - 3f * boltScale, cy + 10f * boltScale)
                        lineTo(cx + 6f * boltScale, cy - 2f)
                        lineTo(cx + 1f, cy - 2f)
                        close()
                    }
                    drawPath(bp, AmberEnergizer)
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // BRAND TITLE
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Fence",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary,
                    letterSpacing = (-1).sp
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 4.dp)
                        .size(8.dp)
                        .background(HtWireRed, RoundedCornerShape(4.dp))
                )
                Text(
                    text = "Sense",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = AmberEnergizer,
                    letterSpacing = (-1).sp
                )
            }

            Text(
                text = "ELECTRIC FENCE ANALYTICS & CAD",
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(48.dp))

            // PROGRESS BAR & STATUS
            Column(
                modifier = Modifier.width(220.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .background(Color(0xFF1E293B), RoundedCornerShape(2.dp))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progress)
                            .fillMaxHeight()
                            .background(AmberEnergizer, RoundedCornerShape(2.dp))
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = messages[messageIndex],
                        style = MaterialTheme.typography.labelSmall,
                        color = if (messageIndex == 3) EarthWireGreen else TextMuted
                    )
                    Text(
                        text = "${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = AmberEnergizer
                    )
                }
            }
        }
    }
}
