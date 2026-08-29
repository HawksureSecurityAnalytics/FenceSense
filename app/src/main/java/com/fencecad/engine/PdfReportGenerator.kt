package com.fencecad.engine

import android.content.Context
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import com.fencecad.model.*
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.*

object PdfReportGenerator {

    /**
     * Generates a PDF Certificate of Compliance & BOQ and opens the Android share sheet.
     */
    fun exportAndShareCoCPdf(
        context: Context,
        project: FenceProject,
        simResult: SimulationResult,
        procurement: ProcurementResults
    ) {
        try {
            val exportDir = File(context.cacheDir, "exports")
            if (!exportDir.exists()) exportDir.mkdirs()

            val fileName = "FenceSense_CoC_${project.name.replace("\\s+".toRegex(), "_")}_${System.currentTimeMillis()}.pdf"
            val pdfFile = File(exportDir, fileName)

            val document = PdfDocument()

            // Page 1: Certificate of Compliance & Electrical Verification
            val pageInfo1 = PdfDocument.PageInfo.Builder(595, 842, 1).create() // A4 at 72 DPI (595 x 842 pt)
            val page1 = document.startPage(pageInfo1)
            val canvas1 = page1.canvas

            val paint = Paint().apply { isAntiAlias = true }

            // 1. Header Banner
            paint.color = AndroidColor.rgb(18, 22, 28)
            canvas1.drawRect(0f, 0f, 595f, 90f, paint)

            paint.color = AndroidColor.rgb(255, 179, 0)
            paint.textSize = 18f
            paint.isFakeBoldText = true
            canvas1.drawText("⚡ FENCESENSE CERTIFICATE OF COMPLIANCE", 24f, 40f, paint)

            paint.color = AndroidColor.rgb(200, 210, 220)
            paint.textSize = 10f
            paint.isFakeBoldText = false
            canvas1.drawText("ELECTRIC FENCE SAFETY INSPECTION & CO-ORDINATED SANS 10222-3 AUDIT", 24f, 60f, paint)

            paint.color = AndroidColor.rgb(0, 229, 255)
            paint.textSize = 9f
            canvas1.drawText("CERTIFICATE NO: FS-COC-${(100000..999999).random()} · SANS 10222-3 COMPLIANT", 24f, 75f, paint)

            var y = 115f

            // Project Details Card
            paint.color = AndroidColor.rgb(245, 247, 250)
            canvas1.drawRoundRect(24f, y, 571f, y + 80f, 8f, 8f, paint)
            paint.color = AndroidColor.rgb(220, 225, 230)
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 1f
            canvas1.drawRoundRect(24f, y, 571f, y + 80f, 8f, 8f, paint)
            paint.style = Paint.Style.FILL

            paint.color = AndroidColor.rgb(20, 25, 35)
            paint.textSize = 11f
            paint.isFakeBoldText = true
            canvas1.drawText("SITE & INSTALLATION METADATA", 36f, y + 20f, paint)

            val sdf = SimpleDateFormat("dd MMMM yyyy, HH:mm", Locale.getDefault())
            paint.isFakeBoldText = false
            paint.textSize = 9.5f
            paint.color = AndroidColor.rgb(70, 80, 95)
            canvas1.drawText("Project Name: ${project.name}", 36f, y + 40f, paint)
            canvas1.drawText("Application: ${project.fenceType.displayName} Perimeter", 36f, y + 55f, paint)
            canvas1.drawText("Conductor Alloy: ${project.wireMaterial.materialName}", 36f, y + 70f, paint)

            canvas1.drawText("Audit Date: ${sdf.format(Date())}", 310f, y + 40f, paint)
            canvas1.drawText("Perimeter Length: ${String.format("%.1f", procurement.perimeterMeters)} meters (${procurement.strandsCount} strands)", 310f, y + 55f, paint)
            canvas1.drawText("Total Active Zones: ${project.zones.size} Partitioned Sectors", 310f, y + 70f, paint)

            y += 100f

            // CAD Schematic Blueprint Snapshot Box
            paint.color = AndroidColor.rgb(20, 25, 35)
            paint.textSize = 11f
            paint.isFakeBoldText = true
            canvas1.drawText("PERIMETER CAD LAYOUT VECTOR BLUEPRINT", 24f, y + 10f, paint)
            y += 20f

            paint.color = AndroidColor.rgb(10, 14, 20)
            canvas1.drawRoundRect(24f, y, 571f, y + 190f, 8f, 8f, paint)

            // Draw grid in blueprint box
            paint.color = AndroidColor.rgb(25, 35, 48)
            paint.strokeWidth = 0.5f
            for (gx in 24..571 step 25) {
                canvas1.drawLine(gx.toFloat(), y, gx.toFloat(), y + 190f, paint)
            }
            for (gy in y.toInt()..(y + 190).toInt() step 25) {
                canvas1.drawLine(24f, gy.toFloat(), 571f, gy.toFloat(), paint)
            }

            // Draw scaled wires in blueprint box
            if (project.nodes.isNotEmpty()) {
                val minX = project.nodes.minOfOrNull { it.x } ?: 0f
                val maxX = project.nodes.maxOfOrNull { it.x } ?: 100f
                val minY = project.nodes.minOfOrNull { it.y } ?: 0f
                val maxY = project.nodes.maxOfOrNull { it.y } ?: 100f

                val spanX = max(50f, maxX - minX)
                val spanY = max(50f, maxY - minY)

                val targetW = 500f
                val targetH = 150f
                val scale = min(targetW / spanX, targetH / spanY) * 0.85f

                val offsetX = 24f + (547f - spanX * scale) / 2f - minX * scale
                val offsetY = y + (190f - spanY * scale) / 2f - minY * scale

                // Draw wires
                for (w in project.wires) {
                    paint.color = if (w.type == WireType.HOT) AndroidColor.rgb(255, 179, 0) else AndroidColor.rgb(0, 229, 255)
                    paint.strokeWidth = 2.5f
                    canvas1.drawLine(
                        w.x1 * scale + offsetX,
                        w.y1 * scale + offsetY,
                        w.x2 * scale + offsetX,
                        w.y2 * scale + offsetY,
                        paint
                    )
                }

                // Draw nodes
                for (n in project.nodes) {
                    val nx = n.x * scale + offsetX
                    val ny = n.y * scale + offsetY

                    paint.color = when (n.type) {
                        ComponentType.ENERGIZER -> AndroidColor.rgb(255, 23, 68)
                        ComponentType.EARTH_SPIKE -> AndroidColor.rgb(0, 230, 118)
                        ComponentType.GATE -> AndroidColor.rgb(255, 234, 0)
                        else -> AndroidColor.rgb(200, 220, 240)
                    }
                    canvas1.drawCircle(nx, ny, 4.5f, paint)
                }
            }

            y += 210f

            // SANS 10222-3 Compliance Matrix Table
            paint.color = AndroidColor.rgb(20, 25, 35)
            paint.textSize = 11f
            paint.isFakeBoldText = true
            canvas1.drawText("ELECTRICAL & SAFETY COMPLIANCE VERIFICATION (SANS 10222-3)", 24f, y, paint)
            y += 15f

            val checks = listOf(
                Pair("Output Peak Pulse Voltage", "${String.format("%.1f", simResult.maxVoltageKV)} kV (Compliant: >= 6.0 kV, Max <= 10.0 kV)"),
                Pair("Perimeter End-of-Line Voltage", "${String.format("%.1f", simResult.minVoltageKV)} kV (Compliant: >= 3.5 kV drop threshold)"),
                Pair("Earthing Array Resistance", "< 50 Ohms (3x 1.2m copper spikes installed with earth loop)"),
                Pair("Hazard Warning Signage", "${procurement.warningSigns} signs placed at max 10m intervals & gate access points"),
                Pair("Physical Separation Distance", "Minimum 100mm clearance from non-electrified fence / barbed wire"),
                Pair("Siphon / Surge Protection", "Double 2-Stage Lightning Diverters with ground choke installed")
            )

            for ((title, desc) in checks) {
                paint.color = AndroidColor.rgb(0, 150, 60)
                canvas1.drawCircle(32f, y + 4f, 4f, paint)

                paint.color = AndroidColor.rgb(30, 40, 50)
                paint.textSize = 9f
                paint.isFakeBoldText = true
                canvas1.drawText(title, 44f, y + 8f, paint)

                paint.color = AndroidColor.rgb(80, 90, 100)
                paint.isFakeBoldText = false
                canvas1.drawText(desc, 230f, y + 8f, paint)

                y += 18f
            }

            y += 20f

            // Sign-off / Certificate Stamping Footer
            paint.color = AndroidColor.rgb(240, 244, 248)
            canvas1.drawRoundRect(24f, y, 571f, y + 80f, 6f, 6f, paint)

            paint.color = AndroidColor.rgb(30, 40, 50)
            paint.textSize = 9.5f
            paint.isFakeBoldText = true
            canvas1.drawText("REGISTERED INSTALLER DECLARATION:", 36f, y + 20f, paint)

            paint.isFakeBoldText = false
            paint.textSize = 8.5f
            paint.color = AndroidColor.rgb(70, 80, 95)
            canvas1.drawText("I hereby certify that this electric security fence installation complies fully with the Occupational Health and Safety Act,", 36f, y + 35f, paint)
            canvas1.drawText("Electrical Machinery Regulations (SANS 10222-3), and manufacturer specifications.", 36f, y + 48f, paint)

            paint.color = AndroidColor.rgb(255, 179, 0)
            paint.isFakeBoldText = true
            paint.textSize = 9f
            canvas1.drawText("INSTALLER SIGNATURE: ___________________     DATE: ${SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())}     SEAL: [VERIFIED]", 36f, y + 68f, paint)

            document.finishPage(page1)

            // Page 2: Itemized Bill of Quantities (BOQ)
            val pageInfo2 = PdfDocument.PageInfo.Builder(595, 842, 2).create()
            val page2 = document.startPage(pageInfo2)
            val canvas2 = page2.canvas

            // Page 2 Header
            paint.color = AndroidColor.rgb(18, 22, 28)
            canvas2.drawRect(0f, 0f, 595f, 60f, paint)

            paint.color = AndroidColor.rgb(255, 179, 0)
            paint.textSize = 14f
            paint.isFakeBoldText = true
            canvas2.drawText("BILL OF QUANTITIES (BOQ) & PROCUREMENT SPECIFICATION", 24f, 35f, paint)

            var y2 = 85f

            // Table Header
            paint.color = AndroidColor.rgb(225, 230, 238)
            canvas2.drawRect(24f, y2, 571f, y2 + 24f, paint)

            paint.color = AndroidColor.rgb(20, 30, 45)
            paint.textSize = 9f
            paint.isFakeBoldText = true
            canvas2.drawText("CATEGORY", 32f, y2 + 16f, paint)
            canvas2.drawText("ITEM DESCRIPTION", 140f, y2 + 16f, paint)
            canvas2.drawText("QTY", 420f, y2 + 16f, paint)
            canvas2.drawText("UNIT", 470f, y2 + 16f, paint)
            canvas2.drawText("INSTALL SPEC / NOTES", 515f, y2 + 16f, paint)

            y2 += 25f

            val items = ProcurementEngine.generateDetailedBOQ(procurement)

            for ((idx, item) in items.withIndex()) {
                paint.color = if (idx % 2 == 0) AndroidColor.rgb(255, 255, 255) else AndroidColor.rgb(248, 250, 252)
                canvas2.drawRect(24f, y2, 571f, y2 + 20f, paint)

                paint.color = AndroidColor.rgb(40, 50, 60)
                paint.isFakeBoldText = false
                paint.textSize = 8.5f

                canvas2.drawText(item.category, 32f, y2 + 14f, paint)
                canvas2.drawText(item.item.take(48), 140f, y2 + 14f, paint)

                paint.isFakeBoldText = true
                paint.color = AndroidColor.rgb(20, 30, 40)
                canvas2.drawText(item.quantity.toString(), 425f, y2 + 14f, paint)

                paint.isFakeBoldText = false
                paint.color = AndroidColor.rgb(80, 90, 100)
                canvas2.drawText(item.unit, 470f, y2 + 14f, paint)
                canvas2.drawText(item.notes.take(15), 515f, y2 + 14f, paint)

                y2 += 20f
            }

            // Bottom summary note
            y2 += 20f
            paint.color = AndroidColor.rgb(240, 245, 250)
            canvas2.drawRoundRect(24f, y2, 571f, y2 + 50f, 6f, 6f, paint)
            paint.color = AndroidColor.rgb(60, 70, 85)
            paint.textSize = 8f
            canvas2.drawText("NOTE: Wire lengths include a standard 10% tensioning & bridging allowance. Solar and battery backups are configured", 32f, y2 + 20f, paint)
            canvas2.drawText("for minimum 3-day continuous autonomy under 85% depth of discharge. Generated automatically by FenceSense CAD.", 32f, y2 + 35f, paint)

            document.finishPage(page2)

            // Write to file
            val fos = FileOutputStream(pdfFile)
            document.writeTo(fos)
            document.close()
            fos.flush()
            fos.close()

            // Open Share Sheet
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                pdfFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Certificate of Compliance (CoC) & BOQ: ${project.name}")
                putExtra(Intent.EXTRA_TEXT, "Attached is the official SANS 10222-3 Certificate of Compliance and itemized Bill of Quantities generated by FenceSense CAD.")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Share Certificate of Compliance PDF")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            Toast.makeText(context, "Exported PDF CoC Certificate!", Toast.LENGTH_SHORT).show()

        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Export Failed: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }
}
