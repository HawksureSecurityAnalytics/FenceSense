package com.fencecad.engine

import com.fencecad.model.*
import kotlin.math.*

object ProcurementEngine {

    fun calculateProcurement(
        project: FenceProject,
        postSpacingMeters: Int = 3,
        strandCount: Int = 8
    ): ProcurementResults {
        val totalWireMeters = project.wires.sumOf { it.lengthMeters.toDouble() }
        val perimeter = if (totalWireMeters > 0) totalWireMeters else 120.0

        val gates = max(1, project.nodes.count { it.type == ComponentType.GATE })
        val corners = max(4, project.nodes.count { it.type == ComponentType.CORNER })
        val spikes = max(3, project.nodes.count { it.type == ComponentType.EARTH_SPIKE })

        val totalPoles = max(4, ceil(perimeter / postSpacingMeters).toInt())
        val intermediatePoles = max(0, totalPoles - corners)

        val totalFenceWireM = (perimeter * strandCount).toInt()
        val totalWireKm = totalFenceWireM / 1000.0
        val reqJoules = max(1.0, (perimeter / 25.0) * (strandCount / 8.0) * 0.8)

        val warningSigns = max(2, (perimeter / 10.0).toInt())
        val tensioners = corners * strandCount
        val sHooks = tensioners * 2
        val ferrules = (corners * strandCount * 4) + (gates * 8)

        return ProcurementResults(
            installType = if (project.fenceType == FenceType.SECURITY) InstallType.WALL_TOP else InstallType.FREESTANDING,
            perimeterMeters = perimeter,
            gatesCount = gates,
            gateWidthMeters = 5.0,
            strandsCount = strandCount,
            energizerDistMeters = 15.0,
            totalPoles = totalPoles,
            endPosts = corners,
            intermediatePoles = intermediatePoles,
            tensioners = tensioners,
            sHooks = sHooks,
            ferrules = ferrules,
            gateContacts = gates * 2,
            earthSpikes = spikes,
            earthSpikesAlongFence = max(0, (perimeter / 50.0).toInt()),
            warningSigns = warningSigns,
            htWireMeters = (corners * 4 + gates * 12 + 25),
            fenceWireMeters = totalFenceWireM,
            totalWireLengthKm = totalWireKm,
            reqJoules = reqJoules
        )
    }

    fun generateDetailedBOQ(procurement: ProcurementResults): List<ProcurementItem> {
        val items = mutableListOf<ProcurementItem>()

        val wireRolls = max(1, ceil(procurement.fenceWireMeters / 1000.0).toInt())
        items.add(
            ProcurementItem(
                category = "Conductors",
                item = "1.6mm High-Tensile Stainless Steel / Aluminium Wire (1000m roll)",
                quantity = wireRolls,
                unit = "rolls",
                notes = "${procurement.fenceWireMeters}m total required"
            )
        )

        items.add(
            ProcurementItem(
                category = "Conductors",
                item = "High-Voltage Silicone Insulated Double Lead-Out Cable (2.5mm)",
                quantity = procurement.htWireMeters,
                unit = "m",
                notes = "Energizer feed & gate bypass loops"
            )
        )

        items.add(
            ProcurementItem(
                category = "Posts & Poles",
                item = "Corner Strainer / End Post with Stays",
                quantity = procurement.endPosts,
                unit = "units",
                notes = "Termination strain anchors"
            )
        )

        items.add(
            ProcurementItem(
                category = "Posts & Poles",
                item = "Intermediate Line Dropper / Wall Bracket (${procurement.strandsCount}-way)",
                quantity = procurement.intermediatePoles,
                unit = "units",
                notes = "Spaced every 3m along fence run"
            )
        )

        items.add(
            ProcurementItem(
                category = "Hardware",
                item = "Heavy-Duty Polymer Strain Insulators",
                quantity = procurement.endPosts * procurement.strandsCount * 2,
                unit = "units",
                notes = "2 per strand per corner"
            )
        )

        items.add(
            ProcurementItem(
                category = "Hardware",
                item = "UV-Stabilized Line Bobbin Insulators",
                quantity = procurement.intermediatePoles * procurement.strandsCount,
                unit = "units",
                notes = "Line post strand isolation"
            )
        )

        items.add(
            ProcurementItem(
                category = "Hardware",
                item = "Stainless Steel Compression Wire Tension Springs",
                quantity = procurement.tensioners,
                unit = "units",
                notes = "Thermal expansion tensioner"
            )
        )

        items.add(
            ProcurementItem(
                category = "Hardware",
                item = "Line Clamps & Aluminium Crimp Ferrules (Pack of 50)",
                quantity = max(1, ceil(procurement.ferrules / 50.0).toInt()),
                unit = "packs",
                notes = "High-conductivity strand joins"
            )
        )

        items.add(
            ProcurementItem(
                category = "Earthing & Safety",
                item = "1.2m Copper-Clad Earth Spikes with Heavy Brass Clamps",
                quantity = max(3, procurement.earthSpikes + procurement.earthSpikesAlongFence),
                unit = "units",
                notes = "SANS 10222-3 certified ground array"
            )
        )

        items.add(
            ProcurementItem(
                category = "Earthing & Safety",
                item = "Double 2-Stage Lightning Surge Diverters",
                quantity = 1,
                unit = "kit",
                notes = "Surge protection with choke loop"
            )
        )

        items.add(
            ProcurementItem(
                category = "Earthing & Safety",
                item = "IEC 60335-2-76 Approved Hazard Warning Signs (Yellow/Black)",
                quantity = procurement.warningSigns,
                unit = "units",
                notes = "Legal requirement every 10m & gates"
            )
        )

        items.add(
            ProcurementItem(
                category = "Electronics",
                item = "Energizer Unit (${String.format("%.1f", procurement.reqJoules)} Joule stored, LCD display, keypad)",
                quantity = 1,
                unit = "unit",
                notes = "Sized for ${String.format("%.1f", procurement.perimeterMeters)}m load"
            )
        )

        if (procurement.gatesCount > 0) {
            items.add(
                ProcurementItem(
                    category = "Gate Access",
                    item = "Inline Heavy-Duty Gate Contact Switch Set",
                    quantity = procurement.gateContacts,
                    unit = "sets",
                    notes = "Breaks live loop on gate swing"
                )
            )
        }

        return items
    }
}
