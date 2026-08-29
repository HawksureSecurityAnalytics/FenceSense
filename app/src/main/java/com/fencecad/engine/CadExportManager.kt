package com.fencecad.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import com.fencecad.model.ComponentType
import com.fencecad.model.FenceProject
import com.fencecad.model.WireType
import java.io.File
import java.io.FileOutputStream

object CadExportManager {

    /**
     * Generates a standard ASCII DXF (AutoCAD Drawing Exchange Format) file.
     */
    fun exportAndShareDxf(context: Context, project: FenceProject) {
        try {
            val exportDir = File(context.cacheDir, "exports")
            if (!exportDir.exists()) exportDir.mkdirs()

            val fileName = "FenceCad_${project.name.replace("\\s+".toRegex(), "_")}.dxf"
            val dxfFile = File(exportDir, fileName)

            val sb = StringBuilder()

            // Header Section
            sb.append("0\nSECTION\n2\nHEADER\n")
            sb.append("9\n\$ACADVER\n1\nAC1009\n")
            sb.append("9\n\$INSUNITS\n70\n6\n") // 6 = Meters
            sb.append("0\nENDSEC\n")

            // Tables Section (Layers)
            sb.append("0\nSECTION\n2\nTABLES\n")
            sb.append("0\nTABLE\n2\nLAYER\n70\n4\n")

            // Layer 1: HT_LIVE_WIRES
            sb.append("0\nLAYER\n2\nHT_LIVE_WIRES\n70\n0\n62\n1\n6\nCONTINUOUS\n") // Color 1 = Red
            // Layer 2: EARTH_RETURN
            sb.append("0\nLAYER\n2\nEARTH_RETURN\n70\n0\n62\n4\n6\nCONTINUOUS\n") // Color 4 = Cyan
            // Layer 3: POSTS_AND_HARDWARE
            sb.append("0\nLAYER\n2\nPOSTS_AND_HARDWARE\n70\n0\n62\n7\n6\nCONTINUOUS\n") // Color 7 = White
            // Layer 4: ENERGIZERS_AND_GATES
            sb.append("0\nLAYER\n2\nENERGIZERS_AND_GATES\n70\n0\n62\n2\n6\nCONTINUOUS\n") // Color 2 = Yellow

            sb.append("0\nENDTAB\n0\nENDSEC\n")

            // Entities Section (Lines, Circles, Texts)
            sb.append("0\nSECTION\n2\nENTITIES\n")

            // 1. Draw Wires as LINE entities
            for (wire in project.wires) {
                val layerName = if (wire.type == WireType.HOT || wire.type == WireType.BRIDGE_HOT) "HT_LIVE_WIRES" else "EARTH_RETURN"
                sb.append("0\nLINE\n")
                sb.append("8\n$layerName\n")
                sb.append("10\n${wire.x1}\n20\n${-wire.y1}\n30\n0.0\n") // Invert Y for standard CAD Cartesian orientation
                sb.append("11\n${wire.x2}\n21\n${-wire.y2}\n31\n0.0\n")
            }

            // 2. Draw Nodes as POINT/CIRCLE and TEXT entities
            for (node in project.nodes) {
                val layer = when (node.type) {
                    ComponentType.ENERGIZER, ComponentType.GATE -> "ENERGIZERS_AND_GATES"
                    else -> "POSTS_AND_HARDWARE"
                }

                // Circle marker
                sb.append("0\nCIRCLE\n")
                sb.append("8\n$layer\n")
                sb.append("10\n${node.x}\n20\n${-node.y}\n30\n0.0\n")
                sb.append("40\n2.5\n") // Radius

                // Text label
                sb.append("0\nTEXT\n")
                sb.append("8\n$layer\n")
                sb.append("10\n${node.x + 3.0}\n20\n${-node.y + 2.0}\n30\n0.0\n")
                sb.append("40\n1.8\n") // Text height
                sb.append("1\n${node.label} (${node.type.displayName})\n")
            }

            sb.append("0\nENDSEC\n0\nEOF\n")

            val fos = FileOutputStream(dxfFile)
            fos.write(sb.toString().toByteArray())
            fos.flush()
            fos.close()

            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                dxfFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/dxf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "CAD DXF Export: ${project.name}")
                putExtra(Intent.EXTRA_TEXT, "Exported 2D DXF Perimeter CAD drawing compatible with AutoCAD, QCAD, and GIS mapping tools.")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Share AutoCAD DXF File")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            Toast.makeText(context, "DXF Drawing Exported!", Toast.LENGTH_SHORT).show()

        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "DXF Export Failed: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * Generates a CSV coordinate survey file.
     */
    fun exportAndShareCsv(context: Context, project: FenceProject) {
        try {
            val exportDir = File(context.cacheDir, "exports")
            if (!exportDir.exists()) exportDir.mkdirs()

            val fileName = "FenceCoords_${project.name.replace("\\s+".toRegex(), "_")}.csv"
            val csvFile = File(exportDir, fileName)

            val sb = StringBuilder()
            sb.append("ID,Component Type,Local X (m),Local Y (m),Label,Zone ID\n")

            for (node in project.nodes) {
                sb.append("\"${node.id}\",\"${node.type.displayName}\",${node.x},${node.y},\"${node.label}\",\"${node.zoneId ?: "zone_1"}\"\n")
            }

            sb.append("\nWire ID,Wire Type,Start X,Start Y,End X,End Y,Span Meters,Strands,Zone ID\n")
            for (wire in project.wires) {
                sb.append("\"${wire.id}\",\"${wire.type.label}\",${wire.x1},${wire.y1},${wire.x2},${wire.y2},${wire.lengthMeters},${wire.strandCount},\"${wire.zoneId ?: "zone_1"}\"\n")
            }

            val fos = FileOutputStream(csvFile)
            fos.write(sb.toString().toByteArray())
            fos.flush()
            fos.close()

            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                csvFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Fence CAD Survey CSV: ${project.name}")
                putExtra(Intent.EXTRA_TEXT, "Exported node coordinates and wire span lengths table.")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Share Survey CSV File")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            Toast.makeText(context, "CSV Survey Exported!", Toast.LENGTH_SHORT).show()

        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "CSV Export Failed: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }
}
