package com.fencecad.ui.screens

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fencecad.engine.CadExportManager
import com.fencecad.engine.PdfReportGenerator
import com.fencecad.engine.ProcurementEngine
import com.fencecad.engine.SimulationEngine
import com.fencecad.model.*
import com.fencecad.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.*

enum class FieldToolTab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    ENVIRONMENT("Weather & Load", Icons.Default.Cloud),
    SOLAR_BATTERY("Solar & Battery", Icons.Default.WbSunny),
    WIRE_MATRIX("Wire Alloy Matrix", Icons.Default.CompareArrows),
    EARTH_STUDY("Earth & Soil", Icons.Default.Terrain),
    FAULT_FINDER("Pulse Metronome", Icons.Default.VolumeUp),
    CERT_EXPORT("CoC & CAD Export", Icons.Default.PictureAsPdf)
}

@Composable
fun FieldToolsScreen(
    currentProject: FenceProject,
    onProjectUpdated: (FenceProject) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(FieldToolTab.ENVIRONMENT) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // TOP HEADER
        Surface(
            color = BgPanel,
            tonalElevation = 4.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(top = 10.dp, start = 14.dp, end = 14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "⚡ FIELD ENGINEERING & COMPLIANCE SUITE",
                            style = MaterialTheme.typography.titleMedium,
                            color = AmberEnergizer,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "SANS 10222-3 Calculation Engines & CoC Export for ${currentProject.name}",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                ScrollableTabRow(
                    selectedTabIndex = selectedTab.ordinal,
                    containerColor = BgPanel,
                    contentColor = AmberEnergizer,
                    edgePadding = 0.dp,
                    indicator = { tabPositions ->
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab.ordinal]),
                            color = AmberEnergizer,
                            height = 3.dp
                        )
                    }
                ) {
                    FieldToolTab.values().forEach { tab ->
                        val isSelected = selectedTab == tab
                        Tab(
                            selected = isSelected,
                            onClick = { selectedTab = tab },
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = tab.icon,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                        tint = if (isSelected) AmberEnergizer else TextMuted
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = tab.title,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) AmberEnergizer else TextMuted
                                    )
                                }
                            }
                        )
                    }
                }
            }
        }

        // TOOL BODY
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            when (selectedTab) {
                FieldToolTab.ENVIRONMENT -> EnvironmentSimulationView(
                    currentProject = currentProject,
                    onProjectUpdated = onProjectUpdated
                )
                FieldToolTab.SOLAR_BATTERY -> SolarBatteryCalculatorView(currentProject)
                FieldToolTab.WIRE_MATRIX -> WireMaterialMatrixView(currentProject, onProjectUpdated)
                FieldToolTab.EARTH_STUDY -> EarthArrayCalculatorView(currentProject)
                FieldToolTab.FAULT_FINDER -> PulseFaultFinderSimulatorView(context, currentProject)
                FieldToolTab.CERT_EXPORT -> ComplianceCertificateExportView(context, currentProject)
            }
        }
    }
}

// ----------------------------------------------------
// 1. WEATHER & VEGETATION ATTENUATION SIMULATOR
// ----------------------------------------------------
@Composable
private fun EnvironmentSimulationView(
    currentProject: FenceProject,
    onProjectUpdated: (FenceProject) -> Unit
) {
    var weather by remember(currentProject.weatherCondition) { mutableStateOf(currentProject.weatherCondition) }
    var vegetation by remember(currentProject.vegetationCondition) { mutableStateOf(currentProject.vegetationCondition) }

    val circuit = remember(currentProject) {
        SimulationEngine.buildCircuitFromProject(currentProject)
    }

    val liveSim = remember(circuit, weather, vegetation) {
        SimulationEngine.runSimulation(
            network = circuit,
            weather = weather,
            vegetation = vegetation
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // SUMMARY KPI BANNER
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, if (liveSim.maxVoltageKV < 3.5) RedFault else if (liveSim.maxVoltageKV < 6.0) AmberEnergizer else CyanLaser),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "ATTENUATED SIMULATION STATE",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextMuted
                            )
                            Text(
                                text = liveSim.status,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (liveSim.maxVoltageKV < 3.5) RedFault else if (liveSim.maxVoltageKV < 6.0) AmberEnergizer else CyanLaser
                            )
                        }
                        Text(
                            text = "${String.format("%.1f", liveSim.maxVoltageKV)} kV",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = AmberEnergizer
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    LinearProgressIndicator(
                        progress = { (liveSim.maxVoltageKV / 10.0).toFloat().coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp),
                        color = if (liveSim.maxVoltageKV < 3.5) RedFault else AmberEnergizer,
                        trackColor = BgDark
                    )

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Pulse Current: ${String.format("%.1f", liveSim.pulseCurrentAmps)} A", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        Text("Leakage Load: ${String.format("%.0f", liveSim.totalPowerWatts)} W", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        Text("SANS Threshold: ≥ 6.0 kV", style = MaterialTheme.typography.bodySmall, color = CyanLaser)
                    }
                }
            }
        }

        // WEATHER CONDITION SELECTOR
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "🌧️ METEOROLOGICAL & RAINFALL LOAD",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Simulates atmospheric humidity, torrential rain, and surface tracking across insulators.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
                    )

                    WeatherCondition.values().forEach { cond ->
                        val isSelected = weather == cond
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .background(if (isSelected) AmberDim else BgDark, RoundedCornerShape(8.dp))
                                .border(1.dp, if (isSelected) AmberEnergizer else BorderDark, RoundedCornerShape(8.dp))
                                .clickable {
                                    weather = cond
                                    onProjectUpdated(currentProject.copy(weatherCondition = cond))
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(cond.icon, fontSize = 22.sp)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(cond.displayName, style = MaterialTheme.typography.titleSmall, color = if (isSelected) AmberEnergizer else TextPrimary, fontWeight = FontWeight.Bold)
                                Text(cond.description, style = MaterialTheme.typography.bodySmall, color = TextMuted, fontSize = 11.sp)
                            }
                            RadioButton(
                                selected = isSelected,
                                onClick = {
                                    weather = cond
                                    onProjectUpdated(currentProject.copy(weatherCondition = cond))
                                },
                                colors = RadioButtonDefaults.colors(selectedColor = AmberEnergizer, unselectedColor = TextMuted)
                            )
                        }
                    }
                }
            }
        }

        // VEGETATION LOAD SELECTOR
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "🌿 PERIMETER VEGETATION BIOMASS LOAD",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Simulates weeds, overgrown wet grass, and tree branch bridging against live strands.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
                    )

                    VegetationCondition.values().forEach { veg ->
                        val isSelected = vegetation == veg
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .background(if (isSelected) AmberDim else BgDark, RoundedCornerShape(8.dp))
                                .border(1.dp, if (isSelected) AmberEnergizer else BorderDark, RoundedCornerShape(8.dp))
                                .clickable {
                                    vegetation = veg
                                    onProjectUpdated(currentProject.copy(vegetationCondition = veg))
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(veg.icon, fontSize = 22.sp)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(veg.displayName, style = MaterialTheme.typography.titleSmall, color = if (isSelected) AmberEnergizer else TextPrimary, fontWeight = FontWeight.Bold)
                                Text(veg.description, style = MaterialTheme.typography.bodySmall, color = TextMuted, fontSize = 11.sp)
                            }
                            RadioButton(
                                selected = isSelected,
                                onClick = {
                                    vegetation = veg
                                    onProjectUpdated(currentProject.copy(vegetationCondition = veg))
                                },
                                colors = RadioButtonDefaults.colors(selectedColor = AmberEnergizer, unselectedColor = TextMuted)
                            )
                        }
                    }
                }
            }
        }
    }
}

// ----------------------------------------------------
// 2. SOLAR & BATTERY AUTONOMY CALCULATOR
// ----------------------------------------------------
@Composable
private fun SolarBatteryCalculatorView(currentProject: FenceProject) {
    var energizerWatts by remember { mutableStateOf(15.0) }
    var autonomyDays by remember { mutableStateOf(3) }
    var batteryType by remember { mutableStateOf("LiFePO4 Lithium (85% DoD)") }
    var sunHours by remember { mutableStateOf(5.5) }

    val calcResult = remember(energizerWatts, autonomyDays, batteryType, sunHours) {
        SimulationEngine.calculateSolarBatteryAutonomy(
            SolarBatteryCalcInput(
                energizerWattageW = energizerWatts,
                desiredAutonomyDays = autonomyDays,
                batteryType = batteryType,
                averageSunHoursPerDay = sunHours
            )
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, AmberEnergizer),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "🔋 RECOMMENDED SOLAR & BATTERY BACKUP SPECIFICATION",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Battery Card
                        Surface(
                            color = BgDark,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, BorderDark),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("BATTERY BANK", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                                Text("${calcResult.recommendedBatteryAhStandard} Ah", style = MaterialTheme.typography.headlineSmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                                Text("12V ${batteryType.take(7)}", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                                Text("${String.format("%.0f", calcResult.autonomyHoursFullRun)}h Autonomy", style = MaterialTheme.typography.labelSmall, color = GreenOptimal)
                            }
                        }

                        // Solar Card
                        Surface(
                            color = BgDark,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, BorderDark),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("PV SOLAR PANEL", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                                Text("${calcResult.recommendedSolarPanelWattsStandard} W", style = MaterialTheme.typography.headlineSmall, color = CyanLaser, fontWeight = FontWeight.Bold)
                                Text("Monocrystalline", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                                Text("${calcResult.recommendedControllerAmpsStandard}A MPPT Controller", style = MaterialTheme.typography.labelSmall, color = CyanLaser)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Daily Energy Consumption: ${String.format("%.0f", calcResult.dailyEnergyWattHours)} Wh/day · Estimated Lifespan: ${calcResult.estimatedLifespanYears}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted
                    )
                }
            }
        }

        // ADJUSTER SLIDERS
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "⚙️ AUTONOMY & SYSTEM ADJUSTERS",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Energizer Power
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Energizer Rating / Load", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        Text("${energizerWatts.toInt()} Watts", style = MaterialTheme.typography.bodySmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = energizerWatts.toFloat(),
                        onValueChange = { energizerWatts = it.toDouble() },
                        valueRange = 5f..40f,
                        steps = 6,
                        colors = SliderDefaults.colors(thumbColor = AmberEnergizer, activeTrackColor = AmberEnergizer)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Autonomy Days
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Backup Autonomy Requirement", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        Text("$autonomyDays Days No-Sun", style = MaterialTheme.typography.bodySmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = autonomyDays.toFloat(),
                        onValueChange = { autonomyDays = it.toInt() },
                        valueRange = 1f..5f,
                        steps = 3,
                        colors = SliderDefaults.colors(thumbColor = AmberEnergizer, activeTrackColor = AmberEnergizer)
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Battery Chemistry Switcher
                    Text("BATTERY CHEMISTRY", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("LiFePO4 Lithium (85% DoD)", "Lead-Acid Deep Cycle (50% DoD)").forEach { chem ->
                            val isSel = batteryType == chem
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(if (isSel) AmberDim else BgDark, RoundedCornerShape(8.dp))
                                    .border(1.dp, if (isSel) AmberEnergizer else BorderDark, RoundedCornerShape(8.dp))
                                    .clickable { batteryType = chem }
                                    .padding(vertical = 10.dp, horizontal = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (chem.contains("Lithium")) "🔋 LiFePO4 Lithium" else "🪫 Lead-Acid AGM",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isSel) AmberEnergizer else TextMuted,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ----------------------------------------------------
// 3. WIRE ALLOY COMPARISON MATRIX
// ----------------------------------------------------
@Composable
private fun WireMaterialMatrixView(
    currentProject: FenceProject,
    onProjectUpdated: (FenceProject) -> Unit
) {
    val totalSpanMeters = remember(currentProject) {
        val len = currentProject.wires.sumOf { it.lengthMeters.toDouble() }
        if (len > 0) len else 120.0
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "🔬 CONDUCTOR ALLOY BENCHMARK (${String.format("%.0f", totalSpanMeters)}m Perimeter)",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Compare resistance, coastal corrosion resistance, and voltage drop across wire materials.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
        }

        items(WireMaterial.values()) { mat ->
            val isCurrent = currentProject.wireMaterial == mat
            val loopResistance = (totalSpanMeters * (mat.resistanceOhmsPerKm / 1000.0)) / 8.0
            val dropKV = (loopResistance * 12.0) / 1000.0

            Card(
                colors = CardDefaults.cardColors(containerColor = if (isCurrent) AmberDim else BgCard),
                border = BorderStroke(1.dp, if (isCurrent) AmberEnergizer else BorderDark),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        onProjectUpdated(currentProject.copy(wireMaterial = mat))
                    }
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = mat.materialName,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isCurrent) AmberEnergizer else TextPrimary
                                )
                                if (isCurrent) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(color = AmberEnergizer, shape = RoundedCornerShape(4.dp)) {
                                        Text(
                                            "ACTIVE ALLOY",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color.Black,
                                            fontSize = 8.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            Text(mat.bestFor, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("${mat.resistanceOhmsPerKm} Ω/km", style = MaterialTheme.typography.titleSmall, color = if (mat.resistanceOhmsPerKm < 50) GreenOptimal else AmberEnergizer, fontWeight = FontWeight.Bold)
                            Text("Drop: ${String.format("%.2f", dropKV)} kV", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Alloy: ${mat.alloyCode}", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text("Tensile: ${mat.tensileStrengthKg.toInt()} kg", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text("Corrosion: ${mat.corrosionResistance.take(18)}", style = MaterialTheme.typography.labelSmall, color = CyanLaser)
                    }
                }
            }
        }
    }
}

// ----------------------------------------------------
// 4. EARTH LOOP & SOIL RESISTIVITY DESIGNER
// ----------------------------------------------------
@Composable
private fun EarthArrayCalculatorView(currentProject: FenceProject) {
    var selectedSoil by remember { mutableStateOf(SoilType.CLAY_COMPACTED) }
    var spikeLength by remember { mutableStateOf(1.2) }
    var spikeCount by remember { mutableStateOf(3) }

    val earthResult = remember(selectedSoil, spikeLength, spikeCount) {
        SimulationEngine.calculateEarthLoopSystem(selectedSoil, spikeLength, spikeCount)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, if (earthResult.targetResistanceOhms <= 50.0) GreenOptimal else RedFault),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("PREDICTED EARTH LOOP IMPEDANCE", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            Text(
                                text = "${String.format("%.1f", earthResult.targetResistanceOhms)} Ω",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (earthResult.targetResistanceOhms <= 50.0) GreenOptimal else RedFault
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(earthResult.safetyStatus, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text("SANS Target: ≤ 50 Ω", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Touch Potential Voltage Rise on Ground: ${String.format("%.2f", earthResult.estimatedEarthingVoltageDropKV)} kV",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (earthResult.estimatedEarthingVoltageDropKV > 0.5) AmberEnergizer else TextMuted
                    )
                }
            }
        }

        // SOIL CLASSIFICATION SELECTOR
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "🌍 SOIL CLASSIFICATION & STRATA",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    SoilType.values().forEach { soil ->
                        val isSel = selectedSoil == soil
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp)
                                .background(if (isSel) AmberDim else BgDark, RoundedCornerShape(8.dp))
                                .border(1.dp, if (isSel) AmberEnergizer else BorderDark, RoundedCornerShape(8.dp))
                                .clickable { selectedSoil = soil }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(soil.typeName, style = MaterialTheme.typography.titleSmall, color = if (isSel) AmberEnergizer else TextPrimary, fontWeight = FontWeight.Bold)
                                Text("${soil.description} · ρ = ${soil.resistivityOhmM.toInt()} Ω·m", style = MaterialTheme.typography.bodySmall, color = TextMuted, fontSize = 11.sp)
                            }
                            RadioButton(
                                selected = isSel,
                                onClick = { selectedSoil = soil },
                                colors = RadioButtonDefaults.colors(selectedColor = AmberEnergizer, unselectedColor = TextMuted)
                            )
                        }
                    }
                }
            }
        }

        // SPIKE COUNT ADJUSTER
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "🔩 EARTH SPIKE CONFIGURATION",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Spikes in Array", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        Text("$spikeCount Spikes", style = MaterialTheme.typography.bodySmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = spikeCount.toFloat(),
                        onValueChange = { spikeCount = it.toInt() },
                        valueRange = 1f..10f,
                        steps = 8,
                        colors = SliderDefaults.colors(thumbColor = AmberEnergizer, activeTrackColor = AmberEnergizer)
                    )

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("SANS 10222-3 Mandatory Guidelines:", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    earthResult.recommendations.forEach { rec ->
                        Row(modifier = Modifier.padding(top = 4.dp), verticalAlignment = Alignment.Top) {
                            Text("• ", color = AmberEnergizer, fontWeight = FontWeight.Bold)
                            Text(rec, style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        }
                    }
                }
            }
        }
    }
}

// ----------------------------------------------------
// 5. PULSE METRONOME & DIGITAL FAULT FINDER
// ----------------------------------------------------
@Composable
private fun PulseFaultFinderSimulatorView(
    context: Context,
    currentProject: FenceProject
) {
    var isPulsing by remember { mutableStateOf(false) }
    var pulseIntervalMs by remember { mutableStateOf(1200L) }
    var currentAmpReading by remember { mutableStateOf(14.8) }
    var direction by remember { mutableStateOf("→ FAULT FORWARD") }
    var audioFeedback by remember { mutableStateOf(true) }
    var hapticFeedback by remember { mutableStateOf(true) }
    var pulseTickCount by remember { mutableStateOf(0) }

    val vibrator = remember {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    // Tone generator for audio tick
    val toneGen = remember {
        try {
            ToneGenerator(AudioManager.STREAM_NOTIFICATION, 85)
        } catch (e: Exception) {
            null
        }
    }

    // Pulse loop coroutine
    LaunchedEffect(isPulsing, pulseIntervalMs, audioFeedback, hapticFeedback) {
        while (isPulsing && isActive) {
            pulseTickCount++

            // Audio Click
            if (audioFeedback) {
                try {
                    toneGen?.startTone(ToneGenerator.TONE_PROP_BEEP, 30)
                } catch (e: Exception) {
                    // ignore audio failures
                }
            }

            // Haptic Pulse
            if (hapticFeedback && vibrator?.hasVibrator() == true) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(25)
                }
            }

            delay(pulseIntervalMs)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            toneGen?.release()
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(2.dp, if (isPulsing) AmberEnergizer else BorderDark),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Pulsing LED Indicator
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(if (isPulsing) AmberEnergizer else BgDark, CircleShape)
                            .border(2.dp, AmberEnergizer, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.ElectricBolt,
                            contentDescription = null,
                            tint = if (isPulsing) Color.Black else AmberEnergizer,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = if (isPulsing) "DIGITAL FAULT FINDER ACTIVE" else "PULSE METRONOME IDLE",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (isPulsing) AmberEnergizer else TextMuted
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // LCD Display Box
                    Surface(
                        color = Color(0xFF0F1A12),
                        border = BorderStroke(1.dp, Color(0xFF1E3A24)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("PEAK CURRENT", style = MaterialTheme.typography.labelSmall, color = Color(0xFF558B62))
                                Text(
                                    text = if (isPulsing) "${String.format("%.1f", currentAmpReading)} A" else "--.- A",
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF00FF66)
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text("FLOW DIRECTION", style = MaterialTheme.typography.labelSmall, color = Color(0xFF558B62))
                                Text(
                                    text = if (isPulsing) direction else "OFFLINE",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPulsing) AmberEnergizer else TextMuted
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Start/Stop Button
                    Button(
                        onClick = { isPulsing = !isPulsing },
                        colors = ButtonDefaults.buttonColors(containerColor = if (isPulsing) RedFault else AmberEnergizer),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    ) {
                        Icon(
                            imageVector = if (isPulsing) Icons.Default.Stop else Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.Black
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isPulsing) "STOP PULSE CLICKER" else "START ENERGIZER METRONOME",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // METRONOME CONTROLS
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "🎛️ FIELD TEST FREQUENCY & SENSORY FEEDBACK",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Pulse Cadence Rate", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        Text("${String.format("%.1f", 1000.0 / pulseIntervalMs)} Hz (${pulseIntervalMs}ms)", style = MaterialTheme.typography.bodySmall, color = AmberEnergizer, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = pulseIntervalMs.toFloat(),
                        onValueChange = { pulseIntervalMs = it.toLong() },
                        valueRange = 700f..2000f,
                        steps = 12,
                        colors = SliderDefaults.colors(thumbColor = AmberEnergizer, activeTrackColor = AmberEnergizer)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Acoustic Beep Feedback", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        Switch(
                            checked = audioFeedback,
                            onCheckedChange = { audioFeedback = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = AmberEnergizer, checkedTrackColor = AmberDim)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Haptic Pulse Vibration", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        Switch(
                            checked = hapticFeedback,
                            onCheckedChange = { hapticFeedback = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = AmberEnergizer, checkedTrackColor = AmberDim)
                        )
                    }
                }
            }
        }
    }
}

// ----------------------------------------------------
// 6. CERTIFICATE OF COMPLIANCE & CAD EXPORTS
// ----------------------------------------------------
@Composable
private fun ComplianceCertificateExportView(
    context: Context,
    currentProject: FenceProject
) {
    val circuit = remember(currentProject) { SimulationEngine.buildCircuitFromProject(currentProject) }
    val simResult = remember(circuit) { SimulationEngine.runSimulation(circuit) }
    val procurement = remember(currentProject) { ProcurementEngine.calculateProcurement(currentProject) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // PDF EXPORT CARD
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, AmberEnergizer),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(AmberDim, CircleShape)
                                .border(1.dp, AmberEnergizer, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = AmberEnergizer, modifier = Modifier.size(24.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("OFFICIAL SANS 10222-3 CERTIFICATE OF COMPLIANCE", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = AmberEnergizer)
                            Text("Generates 2-Page Vector PDF with Blueprint, BOQ, and CoC Sign-off", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = {
                            PdfReportGenerator.exportAndShareCoCPdf(
                                context = context,
                                project = currentProject,
                                simResult = simResult,
                                procurement = procurement
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Share, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("EXPORT & SHARE PDF CERTIFICATE", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // CAD DXF & CSV EXPORT CARD
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, BorderDark),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "📐 2D CAD & GIS SURVEY EXPORT",
                        style = MaterialTheme.typography.titleSmall,
                        color = AmberEnergizer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Export CAD drawings to AutoCAD (.dxf) or GPS coordinate survey spreadsheets (.csv).",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                CadExportManager.exportAndShareDxf(context, currentProject)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CyanLaser),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Download, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("AUTOCAD DXF", color = Color.Black, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                        }

                        Button(
                            onClick = {
                                CadExportManager.exportAndShareCsv(context, currentProject)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = GreenOptimal),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.TableChart, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("SURVEY CSV", color = Color.Black, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}
