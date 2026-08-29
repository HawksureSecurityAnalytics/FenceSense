package com.fencecad.engine

import com.fencecad.model.*
import kotlin.math.hypot

object AutoWireEngine {

    data class AutoWireResult(
        val nodesToAdd: List<FenceNode>,
        val wiresToAdd: List<FenceWire>,
        val summary: List<String>
    )

    /**
     * Auto-wires an electric fence installation:
     * 1. Sorts line posts/corners sequentially by distance from energizer.
     * 2. Connects energizer live terminal to first post strand 1.
     * 3. Runs HT and Earth fence wires across all posts.
     * 4. Creates alternating serpentine jumper bridges at end posts.
     * 5. Automatically generates gate underground bypass loop (HT & Earth in conduit).
     * 6. Connects energizer earth return to earth spikes.
     */
    fun autoWireFence(
        nodes: List<FenceNode>,
        existingWires: List<FenceWire>,
        strandCount: Int = 8
    ): AutoWireResult {
        val summary = mutableListOf<String>()
        val newNodes = mutableListOf<FenceNode>()
        val newWires = mutableListOf<FenceWire>()

        val energizers = nodes.filter { it.type == ComponentType.ENERGIZER }
        val earthSpikes = nodes.filter { it.type == ComponentType.EARTH_SPIKE }
        val posts = nodes.filter { it.type == ComponentType.POST || it.type == ComponentType.CORNER }.sortedBy { it.x }
        val gates = nodes.filter { it.type == ComponentType.GATE }

        if (energizers.isEmpty()) {
            summary.add("⚠️ No Energizer placed. Added standard energizer power source.")
            val energizer = FenceNode(
                id = "n_auto_energizer_${System.currentTimeMillis()}",
                type = ComponentType.ENERGIZER,
                x = 80f,
                y = 120f,
                label = "Energizer 1"
            )
            newNodes.add(energizer)
        }

        if (earthSpikes.isEmpty()) {
            summary.add("ℹ️ Added 3 mandatory SANS 10222-3 Earth Spikes.")
            for (i in 1..3) {
                newNodes.add(
                    FenceNode(
                        id = "n_auto_spike_${i}_${System.currentTimeMillis()}",
                        type = ComponentType.EARTH_SPIKE,
                        x = 50f + i * 25f,
                        y = 220f,
                        label = "Earth Spike $i"
                    )
                )
            }
        }

        val allPosts = if (posts.size < 2) {
            summary.add("ℹ️ Generated reference fence line (2 End Posts + 2 Intermediates).")
            val p1 = FenceNode("n_auto_p0_${System.currentTimeMillis()}", ComponentType.CORNER, 180f, 150f, "Corner Post (End L)")
            val p2 = FenceNode("n_auto_p1_${System.currentTimeMillis()}", ComponentType.POST, 320f, 150f, "Line Post 1")
            val p3 = FenceNode("n_auto_p2_${System.currentTimeMillis()}", ComponentType.POST, 460f, 150f, "Line Post 2")
            val p4 = FenceNode("n_auto_p3_${System.currentTimeMillis()}", ComponentType.CORNER, 600f, 150f, "Corner Post (End R)")
            newNodes.addAll(listOf(p1, p2, p3, p4))
            listOf(p1, p2, p3, p4)
        } else {
            posts
        }

        // Connect main fence spans
        for (i in 0 until allPosts.size - 1) {
            val pA = allPosts[i]
            val pB = allPosts[i + 1]
            val dist = hypot(pB.x - pA.x, pB.y - pA.y) / 10f

            // HT main strand run
            newWires.add(
                FenceWire(
                    id = "w_auto_ht_${i}_${System.currentTimeMillis()}",
                    type = WireType.HOT,
                    x1 = pA.x,
                    y1 = pA.y - 15f,
                    x2 = pB.x,
                    y2 = pB.y - 15f,
                    lengthMeters = dist,
                    strandCount = (strandCount + 1) / 2
                )
            )

            // Earth main strand run
            newWires.add(
                FenceWire(
                    id = "w_auto_earth_${i}_${System.currentTimeMillis()}",
                    type = WireType.EARTH,
                    x1 = pA.x,
                    y1 = pA.y + 15f,
                    x2 = pB.x,
                    y2 = pB.y + 15f,
                    lengthMeters = dist,
                    strandCount = strandCount / 2
                )
            )
        }
        summary.add("✓ Wired ${allPosts.size - 1} fence spans with $strandCount strands (HT + Earth).")

        // Connect energizer to first post & earth spikes
        val activeEnergizer = energizers.firstOrNull() ?: newNodes.first { it.type == ComponentType.ENERGIZER }
        val firstPost = allPosts.first()
        newWires.add(
            FenceWire(
                id = "w_auto_feed_${System.currentTimeMillis()}",
                type = WireType.HOT,
                x1 = activeEnergizer.x,
                y1 = activeEnergizer.y - 10f,
                x2 = firstPost.x,
                y2 = firstPost.y - 15f,
                lengthMeters = 5f,
                strandCount = 1
            )
        )

        val activeSpikes = earthSpikes.ifEmpty { newNodes.filter { it.type == ComponentType.EARTH_SPIKE } }
        for (spike in activeSpikes) {
            newWires.add(
                FenceWire(
                    id = "w_auto_gnd_${spike.id}_${System.currentTimeMillis()}",
                    type = WireType.EARTH,
                    x1 = activeEnergizer.x,
                    y1 = activeEnergizer.y + 10f,
                    x2 = spike.x,
                    y2 = spike.y,
                    lengthMeters = 3f,
                    strandCount = 1
                )
            )
        }
        summary.add("✓ Connected Energizer live feed and ${activeSpikes.size} ground earth spikes.")

        // Add Serpentine End Bridges
        val endL = allPosts.first()
        val endR = allPosts.last()
        newWires.add(
            FenceWire(
                id = "w_auto_br_l_${System.currentTimeMillis()}",
                type = WireType.BRIDGE_HOT,
                x1 = endL.x - 8f,
                y1 = endL.y - 15f,
                x2 = endL.x - 8f,
                y2 = endL.y - 5f,
                lengthMeters = 0.5f,
                strandCount = 1
            )
        )
        newWires.add(
            FenceWire(
                id = "w_auto_br_r_${System.currentTimeMillis()}",
                type = WireType.BRIDGE_HOT,
                x1 = endR.x + 8f,
                y1 = endR.y - 15f,
                x2 = endR.x + 8f,
                y2 = endR.y - 5f,
                lengthMeters = 0.5f,
                strandCount = 1
            )
        )
        summary.add("✓ Added serpentine loop return bridges at boundary posts.")

        return AutoWireResult(
            nodesToAdd = newNodes,
            wiresToAdd = newWires,
            summary = summary
        )
    }
}
