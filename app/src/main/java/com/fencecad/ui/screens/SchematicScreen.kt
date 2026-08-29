package com.fencecad.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fencecad.ui.components.InteractiveSchematic
import com.fencecad.ui.theme.*

data class ReferenceDiagram(
    val id: String,
    val title: String,
    val subtitle: String,
    val badge: String,
    val description: String,
    val notes: List<String>,
    val standardsRef: String
)

val REFERENCE_DIAGRAMS = listOf(
    ReferenceDiagram(
        id = "serpentine",
        title = "Series Serpentine Loop",
        subtitle = "Standard South African Electric Fence Configuration",
        badge = "SANS 10222-3",
        description = "Live HT wires snake back and forth across posts via end jumper bridges. A cut wire anywhere triggers an immediate open-circuit alarm on the security energizer monitor return terminal.",
        notes = listOf(
            "Alternating strands are live HT (red) and Earth return (green).",
            "Jumper bridges at corner posts must use high-voltage silicone-insulated lead-out cable.",
            "Bottom wire must be positioned 100mm–150mm above wall/ground level."
        ),
        standardsRef = "SANS 10222-3 Section 4.2"
    ),
    ReferenceDiagram(
        id = "gate_bypass",
        title = "Underground Gate Bypass Conduit",
        subtitle = "Maintaining Perimeter Integrity Across Openings",
        badge = "Mandatory",
        description = "High-voltage insulated HT lead-out cable routed through a 25mm heavy-duty PVC underground conduit beneath the gate track. Ensures fence continuity remains active even when gates stand open.",
        notes = listOf(
            "Conduit must be buried at least 300mm under driveways (500mm under heavy vehicle access).",
            "Use waterproof resin gel joints or continuous uncut cable under the driveway span.",
            "Earth return cable must accompany the HT cable in the conduit."
        ),
        standardsRef = "SANS 10222-3 Section 5.8"
    ),
    ReferenceDiagram(
        id = "gate_contacts",
        title = "Gate Series In-Line Contacts",
        subtitle = "Instant Alarm Trigger on Gate Forced Entry",
        badge = "Security",
        description = "Spring-loaded heavy brass contacts mounted on gate post and gate leaf. When closed, contacts complete the live HT series loop. Opening the gate breaks the circuit and sounds alarm within 3 seconds.",
        notes = listOf(
            "Brass contacts should be cleaned and lubricated with electrical grease semi-annually.",
            "Install bypass cut-out switch at gate motor box for authorized maintenance bypass.",
            "Microswitch tamper loop on gate housing is strongly recommended."
        ),
        standardsRef = "SANS 10222-3 Section 5.9"
    ),
    ReferenceDiagram(
        id = "earthing_array",
        title = "Energizer Earthing System",
        subtitle = "Multiple Rod Array & Soil Conductivity",
        badge = "Critical",
        description = "Minimum 3 x 1.2m copper-coated earth spikes driven into moist soil spaced 3m apart. Interconnected using 2.5mm HT cable. A poor earth reduces shock deterrent by up to 90%.",
        notes = listOf(
            "Earth spikes must be at least 10m away from mains electrical ground or telecom earthing.",
            "In dry or rocky soil, install intermediate earth spikes every 30m along fence perimeter.",
            "Earth resistance must measure under 10 Ohms for certified COC compliance."
        ),
        standardsRef = "SANS 10222-3 Section 6.1"
    ),
    ReferenceDiagram(
        id = "two_zone",
        title = "Dual-Zone Monitored Fence",
        subtitle = "Independent Zone Sectoring",
        badge = "Advanced",
        description = "Dual-channel energizer driving two independent physical fence zones (e.g. Front Perimeter vs Back Paddock). Enables targeted response and isolates faults without disabling the whole site.",
        notes = listOf(
            "Zones must have separate feed and return conductors running back to energizer.",
            "Warning signs must display the specific zone identifier for rapid response.",
            "Each zone requires independent lightning protection diverters."
        ),
        standardsRef = "SANS 10222-3 Section 7.4"
    )
)

@Composable
fun SchematicScreen(
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf(0) } // 0 = Interactive Schematic, 1 = Reference Library

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // TAB HEADER
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = BgPanel,
            contentColor = AmberEnergizer,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = AmberEnergizer
                )
            }
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.ElectricBolt, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Interactive Schematic", fontWeight = FontWeight.Bold)
                    }
                }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Wiring Library", fontWeight = FontWeight.Bold)
                    }
                }
            )
        }

        if (selectedTab == 0) {
            InteractiveSchematic(modifier = Modifier.fillMaxSize())
        } else {
            WiringLibraryView(modifier = Modifier.fillMaxSize())
        }
    }
}

@Composable
fun WiringLibraryView(modifier: Modifier = Modifier) {
    var selectedDiagram by remember { mutableStateOf<ReferenceDiagram?>(null) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                text = "⚡ SANS 10222-3 WIRING STANDARDS",
                style = MaterialTheme.typography.titleMedium,
                color = AmberEnergizer
            )
            Text(
                text = "Official certified electric fence wiring reference schematics & specifications.",
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
                modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
            )
        }

        items(REFERENCE_DIAGRAMS) { diagram ->
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = BorderStroke(1.dp, if (selectedDiagram?.id == diagram.id) AmberEnergizer else BorderDark),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        selectedDiagram = if (selectedDiagram?.id == diagram.id) null else diagram
                    }
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = diagram.title,
                            style = MaterialTheme.typography.titleMedium,
                            color = TextPrimary
                        )
                        Surface(
                            color = AmberDim,
                            shape = RoundedCornerShape(4.dp),
                            border = BorderStroke(1.dp, AmberEnergizer)
                        ) {
                            Text(
                                text = diagram.badge,
                                style = MaterialTheme.typography.labelSmall,
                                color = AmberEnergizer,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Text(
                        text = diagram.subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
                    )

                    Text(
                        text = diagram.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary
                    )

                    if (selectedDiagram?.id == diagram.id) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "▶ SANS INSTALLATION NOTES",
                            style = MaterialTheme.typography.labelSmall,
                            color = AmberEnergizer,
                            letterSpacing = 1.sp
                        )
                        for (note in diagram.notes) {
                            Text(
                                text = "• $note",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimary,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Reference Standard: ${diagram.standardsRef}",
                            style = MaterialTheme.typography.labelSmall,
                            color = EarthWireGreen
                        )
                    }
                }
            }
        }
    }
}
