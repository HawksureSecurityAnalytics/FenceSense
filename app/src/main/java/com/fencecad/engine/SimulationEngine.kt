package com.fencecad.engine

import com.fencecad.model.*
import kotlin.math.*

object SimulationEngine {

    private const val BRIDGE_RESISTANCE = 0.02
    private const val INTERNAL_SOURCE_RESISTANCE = 50.0 // 50 Ohm internal energizer impedance

    /**
     * Solves the nodal voltages across the circuit network using Modified Nodal Analysis (MNA).
     * Forms G * V = I matrix equation and solves via Gaussian elimination with partial pivoting.
     */
    fun runSimulation(
        network: CircuitNetwork,
        faultedElementIds: Set<String> = emptySet(),
        weather: WeatherCondition = WeatherCondition.SUNNY_DRY,
        vegetation: VegetationCondition = VegetationCondition.CLEAN_CLEAR
    ): SimulationResult {
        if (network.nodes.isEmpty()) {
            return SimulationResult(
                nodeVoltages = emptyMap(),
                edgeCurrents = emptyMap(),
                maxVoltageKV = 0.0,
                minVoltageKV = 0.0,
                totalPowerWatts = 0.0,
                pulseCurrentAmps = 0.0,
                status = "Empty Network",
                faultCandidates = emptyList(),
                hasFault = false,
                solverIterations = 0
            )
        }

        // Map node IDs to matrix indices (0 .. N-1)
        val nodeIndexMap = network.nodes.mapIndexed { index, node -> node.id to index }.toMap()
        val n = network.nodes.size

        // G matrix and I vector
        val G = Array(n) { DoubleArray(n) }
        val I = DoubleArray(n)

        // Find reference earth node
        val earthRefId = network.earthNodes.firstOrNull() ?: network.returnNodeId ?: network.nodes.first().id
        val earthRefIndex = nodeIndexMap[earthRefId] ?: 0

        // Stamp all circuit edges
        for (edge in network.edges) {
            val u = nodeIndexMap[edge.fromNodeId] ?: continue
            val v = nodeIndexMap[edge.toNodeId] ?: continue

            var r = edge.resistanceOhms
            if (edge.isFaulted || faultedElementIds.contains(edge.id) || (edge.physicalWireId != null && faultedElementIds.contains(edge.physicalWireId))) {
                r *= 50000.0 // Open-circuit / high impedance fault
            }

            val conductance = 1.0 / max(0.001, r)

            G[u][u] += conductance
            G[v][v] += conductance
            G[u][v] -= conductance
            G[v][u] -= conductance
        }

        // Environmental leakage conductance (weather + vegetation load to earth reference)
        val weatherLeakPerNode = weather.leakFactor * 0.00008 // Siemens
        val vegLeakPerNode = 1.0 / max(50.0, vegetation.leakOhms)

        for (node in network.nodes) {
            if (node.type == CircuitNodeType.ENERGIZER_LIVE || node.type == CircuitNodeType.WIRE_JUNCTION || node.type == CircuitNodeType.BRIDGE_TAP) {
                val idx = nodeIndexMap[node.id] ?: continue
                val totalLeakG = weatherLeakPerNode + vegLeakPerNode
                if (totalLeakG > 0.0) {
                    G[idx][idx] += totalLeakG
                    G[earthRefIndex][earthRefIndex] += totalLeakG
                    G[idx][earthRefIndex] -= totalLeakG
                    G[earthRefIndex][idx] -= totalLeakG
                }
            }
        }

        // Stamp Energizer Source (Thevenin to Norton equivalent)
        val energizerNodeId = network.energizerNodeId
        val energizerIndex = energizerNodeId?.let { nodeIndexMap[it] }

        val sourceVoltageV = network.energizerVoltageKV * 1000.0
        val rInternal = INTERNAL_SOURCE_RESISTANCE
        val gInternal = 1.0 / rInternal

        if (energizerIndex != null && energizerIndex != earthRefIndex) {
            G[energizerIndex][energizerIndex] += gInternal
            G[earthRefIndex][earthRefIndex] += gInternal
            G[energizerIndex][earthRefIndex] -= gInternal
            G[earthRefIndex][energizerIndex] -= gInternal

            // Norton equivalent current source
            val iSource = sourceVoltageV / rInternal
            I[energizerIndex] += iSource
            I[earthRefIndex] -= iSource
        }

        // Ground reference pinning (set V[earthRefIndex] = 0)
        for (col in 0 until n) {
            G[earthRefIndex][col] = 0.0
        }
        G[earthRefIndex][earthRefIndex] = 1.0
        I[earthRefIndex] = 0.0

        // Solve G * V = I using Gaussian Elimination
        val V = solveGaussian(G, I, n)

        // Calculate node voltage results
        var maxVKV = 0.0
        var minVKV = Double.MAX_VALUE
        val nodeVoltages = mutableMapOf<String, NodeVoltageResult>()

        for (node in network.nodes) {
            val idx = nodeIndexMap[node.id] ?: continue
            val vVolts = V[idx]
            val vKV = max(0.0, vVolts / 1000.0)

            if (node.type != CircuitNodeType.EARTH_SPIKE && node.type != CircuitNodeType.ENERGIZER_RETURN) {
                if (vKV > maxVKV) maxVKV = vKV
                if (vKV < minVKV) minVKV = vKV
            }

            val maxCapKV = max(0.1, network.energizerVoltageKV)
            val pct = (vKV / maxCapKV).coerceIn(0.0, 1.0) * 100.0
            val isWarning = vKV < 3.0 && node.type != CircuitNodeType.EARTH_SPIKE && node.type != CircuitNodeType.ENERGIZER_RETURN
            val isDrop = vKV < (maxCapKV * 0.45) && node.type != CircuitNodeType.EARTH_SPIKE

            nodeVoltages[node.id] = NodeVoltageResult(
                nodeId = node.id,
                voltageKV = vKV,
                percentOfMax = pct,
                isWarning = isWarning,
                isDrop = isDrop
            )
        }

        if (minVKV == Double.MAX_VALUE) minVKV = 0.0

        // Calculate Edge Currents and Dissipation
        val edgeCurrents = mutableMapOf<String, EdgeCurrentResult>()
        var totalPowerW = 0.0
        var pulseCurrentA = 0.0

        for (edge in network.edges) {
            val u = nodeIndexMap[edge.fromNodeId] ?: continue
            val v = nodeIndexMap[edge.toNodeId] ?: continue

            val vDrop = abs(V[u] - V[v])
            val r = max(0.001, edge.resistanceOhms)
            val currentA = vDrop / r
            val powerW = (vDrop * vDrop) / r

            totalPowerW += powerW
            if (edge.fromNodeId == energizerNodeId || edge.toNodeId == energizerNodeId) {
                pulseCurrentA = max(pulseCurrentA, currentA)
            }

            edgeCurrents[edge.id] = EdgeCurrentResult(
                edgeId = edge.id,
                currentAmps = currentA,
                powerDissipatedWatts = powerW,
                voltageDropV = vDrop
            )
        }

        // Fault candidate localization
        val faultCandidates = mutableListOf<FaultCandidate>()
        for (edge in network.edges) {
            val u = nodeIndexMap[edge.fromNodeId] ?: continue
            val v = nodeIndexMap[edge.toNodeId] ?: continue
            val vDrop = abs(V[u] - V[v])

            if (vDrop > 2500.0) { // Large step potential drop
                val conf = min(98, (vDrop / 40.0).toInt())
                faultCandidates.add(
                    FaultCandidate(
                        elementId = edge.physicalWireId ?: edge.id,
                        elementType = if (edge.type == CircuitEdgeType.BRIDGE_RESISTOR) "Bridge Clip" else "Fence Strand",
                        description = "High Voltage Step: ${String.format("%.1f", vDrop / 1000.0)} kV drop across span",
                        deltaV = vDrop / 1000.0,
                        confidencePercent = conf,
                        isLikelyLocation = true
                    )
                )
            }
        }

        val hasFault = faultCandidates.isNotEmpty() || faultedElementIds.isNotEmpty() || (maxVKV < 3.0 && network.nodes.size > 2)
        val status = when {
            hasFault -> "⚠️ FAULT / DROP DETECTED"
            weather != WeatherCondition.SUNNY_DRY || vegetation != VegetationCondition.CLEAN_CLEAR -> "⚡ ATTENUATED LINE (Environmental Load)"
            maxVKV >= 6.0 -> "🟢 OPTIMAL (SANS Compliant)"
            maxVKV >= 3.5 -> "🟡 ADEQUATE (Moderate Load)"
            else -> "🔴 CRITICAL (Below 3.5 kV)"
        }

        return SimulationResult(
            nodeVoltages = nodeVoltages,
            edgeCurrents = edgeCurrents,
            maxVoltageKV = maxVKV,
            minVoltageKV = minVKV,
            totalPowerWatts = totalPowerW,
            pulseCurrentAmps = pulseCurrentA,
            status = status,
            faultCandidates = faultCandidates,
            hasFault = hasFault,
            solverIterations = n
        )
    }

    /**
     * Translates high-level project (Nodes & Wires) into a nodal resistor mesh.
     */
    fun buildCircuitFromProject(
        project: FenceProject,
        energizerRatingKV: Double = 8.0,
        energizerJoules: Double = 5.0,
        soilType: SoilType = SoilType.CLAY_COMPACTED
    ): CircuitNetwork {
        val nodes = project.nodes
        val wires = project.wires
        val material = project.wireMaterial

        val cNodes = mutableListOf<CircuitNode>()
        val cEdges = mutableListOf<CircuitEdge>()

        var energizerLiveId: String? = null
        var energizerReturnId: String? = null
        val earthNodeIds = mutableListOf<String>()

        val wireResPerMeter = material.resistanceOhmsPerKm / 1000.0

        // 1. Create Circuit Nodes
        for (node in nodes) {
            when (node.type) {
                ComponentType.ENERGIZER -> {
                    val liveId = "${node.id}_live"
                    val retId = "${node.id}_earth"
                    cNodes.add(CircuitNode(liveId, CircuitNodeType.ENERGIZER_LIVE, node.x, node.y - 10f, node.id))
                    cNodes.add(CircuitNode(retId, CircuitNodeType.ENERGIZER_RETURN, node.x, node.y + 10f, node.id))
                    energizerLiveId = liveId
                    energizerReturnId = retId
                }
                ComponentType.EARTH_SPIKE -> {
                    val spId = "${node.id}_spike"
                    cNodes.add(CircuitNode(spId, CircuitNodeType.EARTH_SPIKE, node.x, node.y, node.id))
                    earthNodeIds.add(spId)
                }
                ComponentType.GATE -> {
                    val gIn = "${node.id}_in"
                    val gOut = "${node.id}_out"
                    cNodes.add(CircuitNode(gIn, CircuitNodeType.GATE_CONTACT_IN, node.x - 15f, node.y, node.id))
                    cNodes.add(CircuitNode(gOut, CircuitNodeType.GATE_CONTACT_OUT, node.x + 15f, node.y, node.id))
                    // Gate contact resistance
                    cEdges.add(
                        CircuitEdge(
                            id = "e_gate_${node.id}",
                            fromNodeId = gIn,
                            toNodeId = gOut,
                            type = CircuitEdgeType.BRIDGE_RESISTOR,
                            resistanceOhms = 0.05
                        )
                    )
                }
                ComponentType.POST, ComponentType.CORNER -> {
                    val jId = "${node.id}_junc"
                    cNodes.add(CircuitNode(jId, CircuitNodeType.WIRE_JUNCTION, node.x, node.y, node.id))
                }
            }
        }

        // 2. Connect wires to nearest nodes
        for (wire in wires) {
            val fromNode = findNearestCircuitNode(cNodes, wire.x1, wire.y1)
            val toNode = findNearestCircuitNode(cNodes, wire.x2, wire.y2)

            if (fromNode != null && toNode != null && fromNode.id != toNode.id) {
                val len = max(1.0, wire.lengthMeters.toDouble())
                val r = when (wire.type) {
                    WireType.HOT -> (len * wireResPerMeter) / max(1, wire.strandCount)
                    WireType.EARTH -> (len * wireResPerMeter) / max(1, wire.strandCount)
                    WireType.BRIDGE_HOT -> BRIDGE_RESISTANCE
                    WireType.BRIDGE_EARTH -> BRIDGE_RESISTANCE
                }

                cEdges.add(
                    CircuitEdge(
                        id = "ce_${wire.id}",
                        fromNodeId = fromNode.id,
                        toNodeId = toNode.id,
                        type = if (wire.type == WireType.BRIDGE_HOT || wire.type == WireType.BRIDGE_EARTH) CircuitEdgeType.BRIDGE_RESISTOR else CircuitEdgeType.WIRE_RESISTOR,
                        resistanceOhms = max(0.001, r),
                        physicalWireId = wire.id,
                        isHot = wire.type == WireType.HOT || wire.type == WireType.BRIDGE_HOT
                    )
                )
            }
        }

        // 3. Connect earth return to spikes with soil resistance
        val earthBaseR = (soilType.resistivityOhmM / 10.0).coerceIn(5.0, 150.0)
        if (energizerReturnId != null && earthNodeIds.isNotEmpty()) {
            for (spikeId in earthNodeIds) {
                cEdges.add(
                    CircuitEdge(
                        id = "ce_earth_conn_${spikeId}",
                        fromNodeId = energizerReturnId,
                        toNodeId = spikeId,
                        type = CircuitEdgeType.EARTH_RETURN_R,
                        resistanceOhms = earthBaseR / earthNodeIds.size
                    )
                )
            }
        }

        return CircuitNetwork(
            nodes = cNodes,
            edges = cEdges,
            energizerNodeId = energizerLiveId,
            returnNodeId = energizerReturnId,
            earthNodes = earthNodeIds,
            energizerVoltageKV = energizerRatingKV,
            energizerJoules = energizerJoules
        )
    }

    private fun findNearestCircuitNode(nodes: List<CircuitNode>, x: Float, y: Float, maxDist: Float = 90f): CircuitNode? {
        var best: CircuitNode? = null
        var bestD = maxDist
        for (n in nodes) {
            val d = hypot(n.x - x, n.y - y)
            if (d < bestD) {
                bestD = d
                best = n
            }
        }
        return best
    }

    private fun solveGaussian(A: Array<DoubleArray>, B: DoubleArray, n: Int): DoubleArray {
        val M = Array(n) { i -> DoubleArray(n + 1) { j -> if (j < n) A[i][j] else B[i] } }

        for (p in 0 until n) {
            var maxRow = p
            var maxVal = abs(M[p][p])
            for (i in p + 1 until n) {
                val v = abs(M[i][p])
                if (v > maxVal) {
                    maxVal = v
                    maxRow = i
                }
            }

            if (maxRow != p) {
                val temp = M[p]
                M[p] = M[maxRow]
                M[maxRow] = temp
            }

            if (abs(M[p][p]) < 1e-12) {
                M[p][p] = 1e-12
            }

            for (i in p + 1 until n) {
                val alpha = M[i][p] / M[p][p]
                for (j in p until n + 1) {
                    M[i][j] -= alpha * M[p][j]
                }
            }
        }

        val x = DoubleArray(n)
        for (i in n - 1 downTo 0) {
            var sum = 0.0
            for (j in i + 1 until n) {
                sum += M[i][j] * x[j]
            }
            x[i] = (M[i][n] - sum) / M[i][i]
        }
        return x
    }

    // ==========================================
    // FIELD CALCULATOR MODULES
    // ==========================================

    /**
     * Sizing calculations for Solar Panel and Backup Battery.
     */
    fun calculateSolarBatteryAutonomy(input: SolarBatteryCalcInput): SolarBatteryCalcResult {
        val dailyEnergyWh = input.energizerWattageW * 24.0 // Wh/day
        val dod = if (input.batteryType.contains("Lithium") || input.batteryType.contains("LiFePO4")) 0.85 else 0.50

        val requiredAh = (dailyEnergyWh * input.desiredAutonomyDays) / (input.systemVoltageV * dod)
        val standardAh = when {
            requiredAh <= 20.0 -> 24
            requiredAh <= 45.0 -> 50
            requiredAh <= 75.0 -> 100
            requiredAh <= 110.0 -> 120
            requiredAh <= 190.0 -> 200
            else -> ((ceil(requiredAh / 50.0)) * 50).toInt()
        }

        val reqSolarWatts = (dailyEnergyWh * input.solarSafetyFactor) / max(1.0, input.averageSunHoursPerDay)
        val standardSolarWatts = when {
            reqSolarWatts <= 20.0 -> 25
            reqSolarWatts <= 45.0 -> 50
            reqSolarWatts <= 90.0 -> 100
            reqSolarWatts <= 160.0 -> 200
            reqSolarWatts <= 300.0 -> 330
            else -> ((ceil(reqSolarWatts / 100.0)) * 100).toInt()
        }

        val controllerAmps = (standardSolarWatts / input.systemVoltageV) * 1.25
        val standardControllerAmps = when {
            controllerAmps <= 10.0 -> 10
            controllerAmps <= 20.0 -> 20
            controllerAmps <= 30.0 -> 30
            else -> 45
        }

        val autonomyHours = (standardAh * input.systemVoltageV * dod) / input.energizerWattageW
        val lifespan = if (input.batteryType.contains("Lithium")) "7 - 10 Years (3500+ cycles)" else "2 - 4 Years (600 cycles)"

        return SolarBatteryCalcResult(
            dailyEnergyWattHours = dailyEnergyWh,
            requiredBatteryCapacityAh = requiredAh,
            recommendedBatteryAhStandard = standardAh,
            requiredSolarPanelWatts = reqSolarWatts,
            recommendedSolarPanelWattsStandard = standardSolarWatts,
            solarChargeControllerAmps = controllerAmps,
            recommendedControllerAmpsStandard = standardControllerAmps,
            autonomyHoursFullRun = autonomyHours,
            estimatedLifespanYears = lifespan
        )
    }

    /**
     * Soil Resistivity & Earthing Array Analysis per SANS 10222-3.
     */
    fun calculateEarthLoopSystem(soilType: SoilType, spikeLengthM: Double = 1.2, spikeCount: Int = 3): EarthCalcResult {
        // Dwight's formula for single driven rod: R = (rho / (2 * pi * L)) * (ln(4L / d) - 1)
        val d = 0.016 // 16mm diameter copper rod
        val singleR = (soilType.resistivityOhmM / (2 * PI * spikeLengthM)) * (ln((4 * spikeLengthM) / d) - 1.0)

        // Multiple rods in parallel with 3m spacing efficiency factor (approx 0.85 per parallel rod)
        val parallelFactor = 1.0 / (spikeCount.toDouble().pow(0.85))
        val targetR = max(0.5, singleR * parallelFactor)

        val neededSpikes = max(3, ceil((singleR / 50.0).pow(1.15)).toInt())
        val spacingM = max(3.0, spikeLengthM * 2.0)
        val bentoniteReq = soilType == SoilType.ROCKY_STONY || soilType == SoilType.CALCRETE_GRANITE || soilType == SoilType.SANDY_DRY

        val earthVoltDropKV = (12.0 * targetR) / 1000.0 // across 12A peak pulse return

        val safetyStatus = when {
            targetR <= 30.0 -> "🟢 EXCELLENT (Safe step potential < 300V)"
            targetR <= 50.0 -> "🟢 SANS 10222-3 COMPLIANT (< 50 Ω threshold)"
            targetR <= 100.0 -> "🟡 MARGINAL (Earth voltage drop may cause nuisance alarms)"
            else -> "🔴 DANGEROUS / NON-COMPLIANT (> 100 Ω - High touch voltage risk)"
        }

        val recs = mutableListOf<String>()
        recs.add("Install minimum $neededSpikes x ${spikeLengthM}m copper-bonded spikes spaced ${String.format("%.1f", spacingM)}m apart.")
        if (bentoniteReq) {
            recs.add("Use SuperConductive Bentonite Clay backfill around all earth rods to reduce resistance by up to 60%.")
        }
        recs.add("Ensure dedicated HT insulated earth return cable (min 1.6mm²) is continuous with no bare steel splices.")
        if (soilType.resistivityOhmM > 1000.0) {
            recs.add("Consider an active Earth Loop Return system where every alternate fence strand is a continuous grounded return wire.")
        }

        return EarthCalcResult(
            soilType = soilType,
            targetResistanceOhms = targetR,
            singleSpikeResistanceOhms = singleR,
            requiredSpikesCount = neededSpikes,
            recommendedSpacingMeters = spacingM,
            isBentoniteRequired = bentoniteReq,
            estimatedEarthingVoltageDropKV = earthVoltDropKV,
            safetyStatus = safetyStatus,
            recommendations = recs
        )
    }

    /**
     * Wire comparison matrix for given perimeter and strand count.
     */
    fun calculateWireComparison(perimeterMeters: Double, strandCount: Int = 8): List<Triple<WireMaterial, Double, Double>> {
        val totalWireKm = (perimeterMeters * strandCount) / 1000.0
        return WireMaterial.values().map { mat ->
            val loopResistance = (perimeterMeters * (mat.resistanceOhmsPerKm / 1000.0)) / strandCount
            val estimatedDropKV = (loopResistance * 15.0) / 1000.0 // at 15A pulse
            Triple(mat, loopResistance, estimatedDropKV)
        }
    }
}
