package com.fencecad.model

enum class FenceType(val displayName: String, val icon: String) {
    AGRICULTURAL("Agricultural", "🐄"),
    SECURITY("Security", "🔒"),
    GAME("Game", "🦬"),
    WILDLIFE("Wildlife", "🌿")
}

enum class ComponentType(val displayName: String, val subtitle: String, val iconChar: String) {
    ENERGIZER("Energizer", "Power source", "⚡"),
    EARTH_SPIKE("Earth Spike", "Ground rod", "⏚"),
    GATE("Gate", "With contacts", "🚪"),
    POST("Line Post", "Standard", "┃"),
    CORNER("Corner Post", "Strainer", "┓")
}

enum class WireType(val label: String) {
    HOT("HT Live"),
    EARTH("Earth Return"),
    BRIDGE_HOT("HT Bridge"),
    BRIDGE_EARTH("Earth Bridge")
}

enum class FaultState {
    OK,
    FAULTY,
    SUSPECT
}

enum class SchematicFaultType {
    HT_BRIDGE,
    EARTH_BRIDGE,
    STRAND,
    POST
}

data class SchematicFault(
    val postIndex: Int,
    val strandIndex: Int,
    val type: SchematicFaultType,
    val state: FaultState
)

data class FenceZone(
    val id: String,
    val name: String,
    val colorHex: String,
    val isArmed: Boolean = true,
    val targetVoltageKV: Double = 8.0
)

data class FenceNode(
    val id: String,
    val type: ComponentType,
    val x: Float,
    val y: Float,
    val label: String,
    val zoneId: String? = null
)

data class FenceWire(
    val id: String,
    val type: WireType,
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float,
    val lengthMeters: Float = 10f,
    val strandCount: Int = 1,
    val zoneId: String? = null
)

enum class BlueprintType(val displayName: String, val subtitle: String, val scaleMeters: Float) {
    NONE("None (Blank Grid)", "Standard dark CAD drafting matrix", 50f),
    RESIDENTIAL_VILLA("Residential Villa & Yard", "45m x 30m suburban lot with pool & drive", 45f),
    COMMERCIAL_WAREHOUSE("Industrial Warehouse & Yard", "80m x 60m logistics yard with 2 access gates", 80f),
    FARM_PADDOCK("Agricultural Paddock / Pasture", "150m x 100m livestock enclosure", 150f),
    HIGH_SECURITY_ESTATE("High-Security Perimeter Compound", "120m x 90m multi-zone inner/outer ring", 120f)
}

enum class CanvasTool {
    PAN,
    PLACE,
    WIRE,
    FAULT,
    DELETE,
    SELECT,
    MEASURE
}

data class CanvasState(
    val tool: CanvasTool = CanvasTool.PAN,
    val wireMode: WireType = WireType.HOT,
    val strandCount: Int = 8,
    val pendingComponent: ComponentType? = null,
    val selectedNodeId: String? = null,
    val selectedWireId: String? = null,
    val wireStartX: Float? = null,
    val wireStartY: Float? = null,
    val panX: Float = 40f,
    val panY: Float = 40f,
    val scale: Float = 1f,
    val isOrthoEnabled: Boolean = false,
    val isSnapGrid: Boolean = true,
    val showDimensions: Boolean = true,
    val activeZoneId: String = "zone_1",
    val blueprintType: BlueprintType = BlueprintType.NONE,
    val blueprintOpacity: Float = 0.35f
)

// Environmental Simulation Types
enum class WeatherCondition(val displayName: String, val icon: String, val leakFactor: Double, val description: String) {
    SUNNY_DRY("Dry & Sunny", "☀️", 0.0, "Near-zero atmospheric insulator leakage (< 0.01 µS/m)"),
    HUMID_MIST("Humid / Dense Fog", "🌫️", 0.18, "Surface condensation film on insulators (+0.18 µS/m)"),
    MODERATE_RAIN("Moderate Rainfall", "🌧️", 0.45, "Continuous water drip paths (+0.45 µS/m)"),
    HEAVY_STORM("Severe Thunderstorm", "⛈️", 0.85, "Heavy torrential deluge with lightning risk (+0.85 µS/m)")
}

enum class VegetationCondition(val displayName: String, val icon: String, val leakOhms: Double, val description: String) {
    CLEAN_CLEAR("Clear Perimeter", "✨", 1_000_000.0, "Line fully cleared with >1m clear servitude zone"),
    LIGHT_GRASS("Light Tall Grass", "🌾", 15_000.0, "Occasional blade contact on lowest live strand"),
    MEDIUM_BRUSH("Medium Brush Contact", "🌿", 4_500.0, "Frequent branch and damp foliage contact"),
    HEAVY_OVERHANG("Heavy Wet Foliage", "🌳", 1_200.0, "Severe branch resting across multiple live wires")
}

// Wire Material Database
enum class WireMaterial(
    val materialName: String,
    val alloyCode: String,
    val diameterMm: Double,
    val resistanceOhmsPerKm: Double,
    val maxEffectiveKm: Double,
    val tensileStrengthKg: Double,
    val corrosionResistance: String,
    val bestFor: String
) {
    ALU_ALLOY_16("Aluminium Alloy 1.6mm", "AA-6063", 1.6, 35.0, 12.0, 95.0, "Excellent (Coastal Grade)", "Long Security & Game runs"),
    ALU_ALLOY_20("Aluminium Alloy 2.0mm", "AA-6063", 2.0, 20.0, 20.0, 140.0, "Maximum (Ultra Coastal)", "Heavy multi-zone perimeters"),
    STAINLESS_316_12("Stainless Steel 316 1.2mm", "SS-316", 1.2, 120.0, 3.5, 110.0, "Immune to Marine Rust", "Harsh Industrial / High Coastal"),
    STAINLESS_316_16("Stainless Steel 316 1.6mm", "SS-316", 1.6, 85.0, 5.0, 160.0, "Marine Grade Tough", "High-stress security walls"),
    GALV_HT_224("Galvanized HT Steel 2.24mm", "Class A Zinc", 2.24, 45.0, 8.0, 420.0, "Good (Inland standard)", "Agricultural & Game boundary"),
    POLYWIRE_BRAID("Braided Polywire (6-SS)", "Poly+SS", 3.0, 2800.0, 0.4, 45.0, "Moderate", "Temporary strips & rotational grazing")
}

// Solar & Battery Autonomy Calculation Types
data class SolarBatteryCalcInput(
    val energizerOutputJoules: Double = 5.0,
    val energizerWattageW: Double = 12.0,
    val systemVoltageV: Double = 12.0,
    val desiredAutonomyDays: Int = 3,
    val batteryType: String = "Lead-Acid Deep Cycle", // "Lead-Acid Deep Cycle" (50% DoD) vs "LiFePO4 Lithium" (85% DoD)
    val averageSunHoursPerDay: Double = 5.5,
    val solarSafetyFactor: Double = 1.3
)

data class SolarBatteryCalcResult(
    val dailyEnergyWattHours: Double,
    val requiredBatteryCapacityAh: Double,
    val recommendedBatteryAhStandard: Int,
    val requiredSolarPanelWatts: Double,
    val recommendedSolarPanelWattsStandard: Int,
    val solarChargeControllerAmps: Double,
    val recommendedControllerAmpsStandard: Int,
    val autonomyHoursFullRun: Double,
    val estimatedLifespanYears: String
)

// Soil Resistivity & Earth Spikes System (SANS 10222-3)
enum class SoilType(
    val typeName: String,
    val resistivityOhmM: Double,
    val description: String,
    val moistureRating: String
) {
    SWAMP_MARSH("Wet Marsh / Wetland", 30.0, "Permanently saturated organic peat soil", "Saturated (100%)"),
    LOAM_AGRICULTURAL("Agricultural Garden Loam", 100.0, "Rich organic soil with good moisture retention", "Good (70%)"),
    CLAY_COMPACTED("Compacted Moist Clay", 150.0, "Dense clay layer holding moderate conductive salts", "Moderate (50%)"),
    SANDY_DRY("Dry Sandy Soil", 500.0, "Fast-draining porous silica sand", "Poor (20%)"),
    ROCKY_STONY("Rocky / Shaley Ground", 1200.0, "Fractured quartzite, sandstone & stone fill", "Very Low (10%)"),
    CALCRETE_GRANITE("Calcrete / Solid Granite Shelf", 2500.0, "Highly insulating calcium rock & bed granite", "Extremely Low (<5%)")
}

data class EarthCalcResult(
    val soilType: SoilType,
    val targetResistanceOhms: Double, // target <= 50 Ohms per SANS 10222-3
    val singleSpikeResistanceOhms: Double,
    val requiredSpikesCount: Int,
    val recommendedSpacingMeters: Double,
    val isBentoniteRequired: Boolean,
    val estimatedEarthingVoltageDropKV: Double,
    val safetyStatus: String,
    val recommendations: List<String>
)

// Pulse Metronome & Directional Fault Finder
data class FaultFinderReading(
    val isPulsing: Boolean,
    val measuredKV: Double,
    val peakCurrentAmps: Double,
    val directionArrow: String, // "→", "←", "✓ At Fault", "No Current"
    val estimatedDistanceMeters: Double,
    val proximityPercent: Int,
    val acousticBeepPitchHz: Int
)

// Circuit Simulation Types
enum class CircuitNodeType {
    ENERGIZER_LIVE,
    ENERGIZER_RETURN,
    EARTH_SPIKE,
    GATE_CONTACT_IN,
    GATE_CONTACT_OUT,
    WIRE_JUNCTION,
    BRIDGE_TAP,
    VIRTUAL_EARTH
}

data class CircuitNode(
    val id: String,
    val type: CircuitNodeType,
    val x: Float,
    val y: Float,
    val physicalNodeId: String? = null,
    val strandIndex: Int? = null
)

enum class CircuitEdgeType {
    WIRE_RESISTOR,
    BRIDGE_RESISTOR,
    INTERNAL_SOURCE_R,
    EARTH_RETURN_R,
    LEAKAGE_CONDUCTANCE,
    FAULT_RESISTOR
}

data class CircuitEdge(
    val id: String,
    val fromNodeId: String,
    val toNodeId: String,
    val type: CircuitEdgeType,
    val resistanceOhms: Double,
    val physicalWireId: String? = null,
    val isHot: Boolean = false,
    val isFaulted: Boolean = false
)

data class CircuitNetwork(
    val nodes: List<CircuitNode>,
    val edges: List<CircuitEdge>,
    val energizerNodeId: String?,
    val returnNodeId: String?,
    val earthNodes: List<String>,
    val energizerVoltageKV: Double = 8.0,
    val energizerJoules: Double = 5.0
)

data class NodeVoltageResult(
    val nodeId: String,
    val voltageKV: Double,
    val percentOfMax: Double,
    val isWarning: Boolean,
    val isDrop: Boolean
)

data class EdgeCurrentResult(
    val edgeId: String,
    val currentAmps: Double,
    val powerDissipatedWatts: Double,
    val voltageDropV: Double
)

data class FaultCandidate(
    val elementId: String,
    val elementType: String,
    val description: String,
    val deltaV: Double,
    val confidencePercent: Int,
    val isLikelyLocation: Boolean
)

data class SimulationResult(
    val nodeVoltages: Map<String, NodeVoltageResult>,
    val edgeCurrents: Map<String, EdgeCurrentResult>,
    val maxVoltageKV: Double,
    val minVoltageKV: Double,
    val totalPowerWatts: Double,
    val pulseCurrentAmps: Double,
    val status: String,
    val faultCandidates: List<FaultCandidate>,
    val hasFault: Boolean,
    val solverIterations: Int
)

// Diagnostics & Validation Types
data class DiagnosticInput(
    val measuredVoltageKV: Double,
    val energizerOutputKV: Double = 8.0,
    val fenceType: FenceType = FenceType.AGRICULTURAL,
    val totalLengthM: Double = 200.0,
    val earthSpikeCount: Int = 3,
    val soilCondition: String = "normal", // dry, normal, wet
    val symptoms: List<String> = emptyList()
)

data class DiagnosticResult(
    val likelyFault: String?,
    val confidence: Int,
    val explanation: String,
    val steps: List<String>,
    val severity: String // ok, warn, error
)

enum class IssueSeverity {
    OK,
    WARN,
    ERROR
}

data class ValidationIssue(
    val id: String,
    val severity: IssueSeverity,
    val title: String,
    val detail: String,
    val suggestion: String? = null,
    val affectedIds: List<String> = emptyList()
)

data class ValidationStats(
    val totalNodes: Int,
    val totalWires: Int,
    val htLengthM: Double,
    val earthLengthM: Double,
    val energizerCount: Int,
    val earthSpikeCount: Int,
    val gateCount: Int,
    val estimatedJoulesNeeded: Double
)

data class ValidationResult(
    val passed: Boolean,
    val score: Int,
    val issues: List<ValidationIssue>,
    val recommendations: List<String>,
    val stats: ValidationStats
)

// Project Persistence Types
data class ProjectMeta(
    val id: String,
    val name: String,
    val fenceType: FenceType,
    val updatedAt: Long
)

data class FenceProject(
    val id: String,
    val name: String,
    val fenceType: FenceType,
    val nodes: List<FenceNode>,
    val wires: List<FenceWire>,
    val updatedAt: Long,
    val zones: List<FenceZone> = listOf(
        FenceZone("zone_1", "Zone 1: Perimeter", "#FFB300"),
        FenceZone("zone_2", "Zone 2: Gate & Entry", "#00E5FF")
    ),
    val wireMaterial: WireMaterial = WireMaterial.ALU_ALLOY_16,
    val weatherCondition: WeatherCondition = WeatherCondition.SUNNY_DRY,
    val vegetationCondition: VegetationCondition = VegetationCondition.CLEAN_CLEAR
)

// Procurement Calculation Types
enum class InstallType(val label: String, val spacingMeters: Int) {
    FREESTANDING("Freestanding", 3),
    WALL_TOP("Wall-Top", 2)
}

data class ProcurementItem(
    val category: String,
    val item: String,
    val quantity: Int,
    val unit: String,
    val notes: String
)

data class ProcurementResults(
    val installType: InstallType,
    val perimeterMeters: Double,
    val gatesCount: Int,
    val gateWidthMeters: Double,
    val strandsCount: Int,
    val energizerDistMeters: Double,
    val totalPoles: Int,
    val endPosts: Int,
    val intermediatePoles: Int,
    val tensioners: Int,
    val sHooks: Int,
    val ferrules: Int,
    val gateContacts: Int,
    val earthSpikes: Int,
    val earthSpikesAlongFence: Int,
    val warningSigns: Int,
    val htWireMeters: Int,
    val fenceWireMeters: Int,
    val totalWireLengthKm: Double,
    val reqJoules: Double
)
