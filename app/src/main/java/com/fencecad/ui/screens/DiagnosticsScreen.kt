package com.fencecad.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fencecad.engine.ValidatorEngine
import com.fencecad.model.DiagnosticInput
import com.fencecad.model.DiagnosticResult
import com.fencecad.model.FenceType
import com.fencecad.ui.theme.*

val SYMPTOMS_LIST = listOf(
    "no_voltage" to "No voltage on wire / Dead line",
    "low_voltage" to "Low voltage reading (< 3.5kV)",
    "clicking" to "Audible snapping / clicking sound",
    "tripping" to "Energizer trips / alarm sounds",
    "intermittent" to "Intermittent / Comes and goes",
    "gate_area" to "Fault located near gate opening",
    "after_rain" to "Fault worse after rainfall / morning dew",
    "dry_weather" to "Fault worse in dry / sandy weather"
)

val SOIL_TYPES = listOf(
    Triple("dry", "Dry / Sandy", AmberEnergizer),
    Triple("normal", "Normal Loam", EarthWireGreen),
    Triple("wet", "Wet / Clay", BridgeHotBlue)
)

@Composable
fun DiagnosticsScreen(
    modifier: Modifier = Modifier
) {
    var step by remember { mutableStateOf(1) } // 1 = Input Form, 2 = Results
    var fenceType by remember { mutableStateOf(FenceType.AGRICULTURAL) }
    var measuredVoltageText by remember { mutableStateOf("") }
    var energizerOutputText by remember { mutableStateOf("8.0") }
    var totalLengthText by remember { mutableStateOf("200") }
    var earthSpikesText by remember { mutableStateOf("3") }
    var selectedSoil by remember { mutableStateOf("normal") }
    var selectedSymptoms by remember { mutableStateOf<Set<String>>(emptySet()) }
    var diagnosticResult by remember { mutableStateOf<DiagnosticResult?>(null) }

    fun toggleSymptom(key: String) {
        selectedSymptoms = if (selectedSymptoms.contains(key)) {
            selectedSymptoms - key
        } else {
            selectedSymptoms + key
        }
    }

    fun executeDiagnosis() {
        val measured = measuredVoltageText.toDoubleOrNull() ?: 0.0
        val energizer = energizerOutputText.toDoubleOrNull() ?: 8.0
        val length = totalLengthText.toDoubleOrNull() ?: 200.0
        val spikes = earthSpikesText.toIntOrNull() ?: 3

        val input = DiagnosticInput(
            measuredVoltageKV = measured,
            energizerOutputKV = energizer,
            fenceType = fenceType,
            totalLengthM = length,
            earthSpikeCount = spikes,
            soilCondition = selectedSoil,
            symptoms = selectedSymptoms.toList()
        )

        diagnosticResult = ValidatorEngine.runDiagnostics(input)
        step = 2
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // SCREEN HEADER
        Surface(
            color = BgPanel,
            tonalElevation = 2.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = "🔍 FENCE FAULT DIAGNOSTICS",
                    style = MaterialTheme.typography.titleMedium,
                    color = AmberEnergizer
                )
                Text(
                    text = "Offline expert fault-finding & troubleshooting wizard",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        if (step == 1) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(14.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // 1. FENCE TYPE
                Text("1. FENCE APPLICATION", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    FenceType.values().forEach { ft ->
                        val isSelected = fenceType == ft
                        Card(
                            colors = CardDefaults.cardColors(containerColor = if (isSelected) AmberDim else BgCard),
                            border = BorderStroke(1.dp, if (isSelected) AmberEnergizer else BorderDark),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .weight(1f)
                                .clickable { fenceType = ft }
                        ) {
                            Column(
                                modifier = Modifier.padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(ft.icon, fontSize = 20.sp)
                                Text(
                                    ft.displayName,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isSelected) AmberEnergizer else TextPrimary,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }

                // 2. VOLTAGE READINGS
                Text("2. VOLTAGE READINGS (kV)", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = measuredVoltageText,
                        onValueChange = { measuredVoltageText = it },
                        label = { Text("Measured on fence (kV)", style = MaterialTheme.typography.labelSmall) },
                        placeholder = { Text("e.g. 3.2", color = TextMuted) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AmberEnergizer,
                            unfocusedBorderColor = BorderDark,
                            focusedTextColor = AmberEnergizer,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = energizerOutputText,
                        onValueChange = { energizerOutputText = it },
                        label = { Text("Energizer rated (kV)", style = MaterialTheme.typography.labelSmall) },
                        placeholder = { Text("e.g. 8.5", color = TextMuted) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AmberEnergizer,
                            unfocusedBorderColor = BorderDark,
                            focusedTextColor = AmberEnergizer,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.weight(1f)
                    )
                }

                // 3. FENCE DETAILS
                Text("3. FENCE DETAILS & EARTHING", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = totalLengthText,
                        onValueChange = { totalLengthText = it },
                        label = { Text("Total length (m)", style = MaterialTheme.typography.labelSmall) },
                        placeholder = { Text("e.g. 300", color = TextMuted) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AmberEnergizer,
                            unfocusedBorderColor = BorderDark,
                            focusedTextColor = AmberEnergizer,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = earthSpikesText,
                        onValueChange = { earthSpikesText = it },
                        label = { Text("Earth spikes", style = MaterialTheme.typography.labelSmall) },
                        placeholder = { Text("e.g. 3", color = TextMuted) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AmberEnergizer,
                            unfocusedBorderColor = BorderDark,
                            focusedTextColor = AmberEnergizer,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.weight(1f)
                    )
                }

                // 4. SOIL CONDITION
                Text("4. SOIL CONDITION", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    SOIL_TYPES.forEach { (key, label, color) ->
                        val isSelected = selectedSoil == key
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .background(if (isSelected) color.copy(alpha = 0.2f) else BgCard, RoundedCornerShape(8.dp))
                                .border(1.dp, if (isSelected) color else BorderDark, RoundedCornerShape(8.dp))
                                .clickable { selectedSoil = key }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(label, style = MaterialTheme.typography.labelSmall, color = if (isSelected) color else TextPrimary)
                        }
                    }
                }

                // 5. OBSERVED SYMPTOMS
                Text("5. OBSERVED SYMPTOMS (Select all that apply)", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                for ((key, label) in SYMPTOMS_LIST) {
                    val isChecked = selectedSymptoms.contains(key)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = if (isChecked) AmberDim else BgCard),
                        border = BorderStroke(1.dp, if (isChecked) AmberEnergizer else BorderDark),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { toggleSymptom(key) }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (isChecked) AmberEnergizer else TextPrimary
                            )
                            if (isChecked) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = AmberEnergizer, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // DIAGNOSE BUTTON
                Button(
                    onClick = { executeDiagnosis() },
                    colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Icon(Icons.Default.Search, contentDescription = null, tint = Color.Black)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("🔍 DIAGNOSE FAULT", color = Color.Black, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                }
                Spacer(modifier = Modifier.height(20.dp))
            }
        } else if (diagnosticResult != null) {
            val result = diagnosticResult!!
            val confColor = if (result.confidence >= 80) EarthWireGreen else if (result.confidence >= 55) AmberEnergizer else TextMuted

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(14.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // FAULT RESULT CARD
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = BorderStroke(2.dp, confColor),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .background(confColor.copy(alpha = 0.2f), CircleShape)
                                .border(1.dp, confColor, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(if (result.severity == "error") "💥" else if (result.severity == "warn") "⚠️" else "✓", fontSize = 22.sp)
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = result.likelyFault ?: "Normal Operation",
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                            LinearProgressIndicator(
                                progress = { result.confidence / 100f },
                                color = confColor,
                                trackColor = BorderDark,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp)
                                    .height(6.dp)
                            )
                            Text(
                                "${result.confidence}% Confidence Rating",
                                style = MaterialTheme.typography.labelSmall,
                                color = confColor
                            )
                        }
                    }
                }

                // EXPLANATION
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = BorderStroke(1.dp, BorderDark),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("▶ ENGINEERING DIAGNOSIS", style = MaterialTheme.typography.labelSmall, color = AmberEnergizer)
                        Text(
                            text = result.explanation,
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimary,
                            lineHeight = 22.sp,
                            modifier = Modifier.padding(top = 6.dp)
                        )
                    }
                }

                // STEP-BY-STEP FAULT FINDING ACTION PLAN
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = BorderStroke(1.dp, BorderDark),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("▶ ACTIONABLE FAULT-FINDING PROCEDURE", style = MaterialTheme.typography.labelSmall, color = AmberEnergizer)

                        Spacer(modifier = Modifier.height(8.dp))

                        result.steps.forEachIndexed { idx, stepText ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(22.dp)
                                        .background(AmberDim, CircleShape)
                                        .border(1.dp, AmberEnergizer, CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${idx + 1}", style = MaterialTheme.typography.labelSmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = stepText,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextPrimary,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                // NEW DIAGNOSIS BUTTON
                OutlinedButton(
                    onClick = {
                        step = 1
                        selectedSymptoms = emptySet()
                    },
                    border = BorderStroke(1.dp, BorderDark),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text("← New Diagnosis Session", color = TextPrimary)
                }
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}
