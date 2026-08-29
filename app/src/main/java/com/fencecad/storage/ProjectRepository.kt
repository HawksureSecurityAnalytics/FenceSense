package com.fencecad.storage

import android.content.Context
import android.content.SharedPreferences
import com.fencecad.model.*
import org.json.JSONArray
import org.json.JSONObject

class ProjectRepository(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("fence_cad_prefs", Context.MODE_PRIVATE)

    init {
        // Seed initial demo projects if empty
        if (!prefs.contains("projects_initialized")) {
            seedInitialProjects()
            prefs.edit().putBoolean("projects_initialized", true).apply()
        }
    }

    private fun seedInitialProjects() {
        val demo1 = FenceProject(
            id = "demo_security_8strand",
            name = "Perimeter Security 8-Strand",
            fenceType = FenceType.SECURITY,
            nodes = listOf(
                FenceNode("n_enrg", ComponentType.ENERGIZER, 80f, 130f, "Energizer 1"),
                FenceNode("n_spk1", ComponentType.EARTH_SPIKE, 60f, 230f, "Earth Spike 1"),
                FenceNode("n_spk2", ComponentType.EARTH_SPIKE, 85f, 230f, "Earth Spike 2"),
                FenceNode("n_spk3", ComponentType.EARTH_SPIKE, 110f, 230f, "Earth Spike 3"),
                FenceNode("n_c1", ComponentType.CORNER, 170f, 150f, "Corner Post 1"),
                FenceNode("n_p1", ComponentType.POST, 310f, 150f, "Line Post 1"),
                FenceNode("n_g1", ComponentType.GATE, 430f, 150f, "Main Security Gate"),
                FenceNode("n_p2", ComponentType.POST, 550f, 150f, "Line Post 2"),
                FenceNode("n_c2", ComponentType.CORNER, 680f, 150f, "Corner Post 2")
            ),
            wires = listOf(
                FenceWire("w_feed", WireType.HOT, 80f, 120f, 170f, 135f, 10f, 1),
                FenceWire("w_gnd", WireType.EARTH, 80f, 140f, 60f, 230f, 3f, 1),
                FenceWire("w_gnd2", WireType.EARTH, 60f, 230f, 85f, 230f, 3f, 1),
                FenceWire("w_gnd3", WireType.EARTH, 85f, 230f, 110f, 230f, 3f, 1),
                FenceWire("w_span1_ht", WireType.HOT, 170f, 135f, 310f, 135f, 30f, 4),
                FenceWire("w_span1_e", WireType.EARTH, 170f, 165f, 310f, 165f, 30f, 4),
                FenceWire("w_span2_ht", WireType.HOT, 310f, 135f, 430f, 135f, 25f, 4),
                FenceWire("w_span2_e", WireType.EARTH, 310f, 165f, 430f, 165f, 25f, 4),
                FenceWire("w_span3_ht", WireType.HOT, 430f, 135f, 550f, 135f, 25f, 4),
                FenceWire("w_span3_e", WireType.EARTH, 430f, 165f, 550f, 165f, 25f, 4),
                FenceWire("w_span4_ht", WireType.HOT, 550f, 135f, 680f, 135f, 30f, 4),
                FenceWire("w_span4_e", WireType.EARTH, 550f, 165f, 680f, 165f, 30f, 4),
                FenceWire("w_br1", WireType.BRIDGE_HOT, 170f, 135f, 170f, 145f, 0.5f, 1),
                FenceWire("w_br2", WireType.BRIDGE_HOT, 680f, 135f, 680f, 145f, 0.5f, 1)
            ),
            updatedAt = System.currentTimeMillis()
        )

        val demo2 = FenceProject(
            id = "demo_agri_pasture",
            name = "North Paddock Cattle Fence",
            fenceType = FenceType.AGRICULTURAL,
            nodes = listOf(
                FenceNode("n_enrg_a", ComponentType.ENERGIZER, 80f, 130f, "Solar Energizer"),
                FenceNode("n_spk_a1", ComponentType.EARTH_SPIKE, 80f, 220f, "Earth Spike 1"),
                FenceNode("n_spk_a2", ComponentType.EARTH_SPIKE, 110f, 220f, "Earth Spike 2"),
                FenceNode("n_c1_a", ComponentType.CORNER, 170f, 150f, "Strainer Post A"),
                FenceNode("n_p1_a", ComponentType.POST, 340f, 150f, "Dropper Post 1"),
                FenceNode("n_c2_a", ComponentType.CORNER, 520f, 150f, "Strainer Post B")
            ),
            wires = listOf(
                FenceWire("w_feed_a", WireType.HOT, 80f, 120f, 170f, 135f, 8f, 1),
                FenceWire("w_gnd_a", WireType.EARTH, 80f, 140f, 80f, 220f, 3f, 1),
                FenceWire("w_span1_a", WireType.HOT, 170f, 135f, 340f, 135f, 50f, 3),
                FenceWire("w_span2_a", WireType.HOT, 340f, 135f, 520f, 135f, 50f, 3),
                FenceWire("w_span1_ae", WireType.EARTH, 170f, 165f, 340f, 165f, 50f, 2),
                FenceWire("w_span2_ae", WireType.EARTH, 340f, 165f, 520f, 165f, 50f, 2)
            ),
            updatedAt = System.currentTimeMillis() - 86400000L
        )

        saveProject(demo1)
        saveProject(demo2)
    }

    fun listProjects(): List<ProjectMeta> {
        val list = mutableListOf<ProjectMeta>()
        val allKeys = prefs.all.keys.filter { it.startsWith("project_meta_") }
        for (key in allKeys) {
            val jsonStr = prefs.getString(key, null) ?: continue
            try {
                val json = JSONObject(jsonStr)
                list.add(
                    ProjectMeta(
                        id = json.getString("id"),
                        name = json.getString("name"),
                        fenceType = FenceType.valueOf(json.optString("fenceType", FenceType.AGRICULTURAL.name)),
                        updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
                    )
                )
            } catch (_: Exception) {}
        }
        return list.sortedByDescending { it.updatedAt }
    }

    fun getProject(id: String): FenceProject? {
        val jsonStr = prefs.getString("project_data_$id", null) ?: return null
        return try {
            val json = JSONObject(jsonStr)
            val nodesArray = json.getJSONArray("nodes")
            val nodes = mutableListOf<FenceNode>()
            for (i in 0 until nodesArray.length()) {
                val nObj = nodesArray.getJSONObject(i)
                nodes.add(
                    FenceNode(
                        id = nObj.getString("id"),
                        type = ComponentType.valueOf(nObj.getString("type")),
                        x = nObj.getDouble("x").toFloat(),
                        y = nObj.getDouble("y").toFloat(),
                        label = nObj.optString("label", "")
                    )
                )
            }

            val wiresArray = json.getJSONArray("wires")
            val wires = mutableListOf<FenceWire>()
            for (i in 0 until wiresArray.length()) {
                val wObj = wiresArray.getJSONObject(i)
                wires.add(
                    FenceWire(
                        id = wObj.getString("id"),
                        type = WireType.valueOf(wObj.getString("type")),
                        x1 = wObj.getDouble("x1").toFloat(),
                        y1 = wObj.getDouble("y1").toFloat(),
                        x2 = wObj.getDouble("x2").toFloat(),
                        y2 = wObj.getDouble("y2").toFloat(),
                        lengthMeters = wObj.optDouble("lengthMeters", 10.0).toFloat(),
                        strandCount = wObj.optInt("strandCount", 1)
                    )
                )
            }

            FenceProject(
                id = json.getString("id"),
                name = json.getString("name"),
                fenceType = FenceType.valueOf(json.optString("fenceType", FenceType.AGRICULTURAL.name)),
                nodes = nodes,
                wires = wires,
                updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
            )
        } catch (e: Exception) {
            null
        }
    }

    fun saveProject(project: FenceProject) {
        val metaJson = JSONObject().apply {
            put("id", project.id)
            put("name", project.name)
            put("fenceType", project.fenceType.name)
            put("updatedAt", project.updatedAt)
        }

        val dataJson = JSONObject().apply {
            put("id", project.id)
            put("name", project.name)
            put("fenceType", project.fenceType.name)
            put("updatedAt", project.updatedAt)

            val nodesArray = JSONArray()
            for (n in project.nodes) {
                nodesArray.put(JSONObject().apply {
                    put("id", n.id)
                    put("type", n.type.name)
                    put("x", n.x)
                    put("y", n.y)
                    put("label", n.label)
                })
            }
            put("nodes", nodesArray)

            val wiresArray = JSONArray()
            for (w in project.wires) {
                wiresArray.put(JSONObject().apply {
                    put("id", w.id)
                    put("type", w.type.name)
                    put("x1", w.x1)
                    put("y1", w.y1)
                    put("x2", w.x2)
                    put("y2", w.y2)
                    put("lengthMeters", w.lengthMeters)
                    put("strandCount", w.strandCount)
                })
            }
            put("wires", wiresArray)
        }

        prefs.edit()
            .putString("project_meta_${project.id}", metaJson.toString())
            .putString("project_data_${project.id}", dataJson.toString())
            .apply()
    }

    fun createProject(name: String, fenceType: FenceType): FenceProject {
        val id = "proj_${System.currentTimeMillis()}"
        val project = FenceProject(
            id = id,
            name = name,
            fenceType = fenceType,
            nodes = listOf(
                FenceNode("n_enrg_${id}", ComponentType.ENERGIZER, 80f, 130f, "Energizer 1"),
                FenceNode("n_spk_${id}_1", ComponentType.EARTH_SPIKE, 80f, 220f, "Earth Spike 1"),
                FenceNode("n_spk_${id}_2", ComponentType.EARTH_SPIKE, 105f, 220f, "Earth Spike 2"),
                FenceNode("n_spk_${id}_3", ComponentType.EARTH_SPIKE, 130f, 220f, "Earth Spike 3")
            ),
            wires = emptyList(),
            updatedAt = System.currentTimeMillis()
        )
        saveProject(project)
        return project
    }

    fun deleteProject(id: String) {
        prefs.edit()
            .remove("project_meta_$id")
            .remove("project_data_$id")
            .apply()
    }
}
