package com.fencecad.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fencecad.model.FenceProject
import com.fencecad.storage.ProjectRepository
import com.fencecad.ui.theme.*

enum class AppTab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    CAD_DRAW("CAD", Icons.Default.Draw),
    FIELD_TOOLS("Tools", Icons.Default.Handyman),
    SCHEMATIC("Circuit", Icons.Default.ElectricBolt),
    DIAGNOSTICS("Faults", Icons.Default.Search),
    PROCUREMENT("BOQ", Icons.Default.Inventory2),
    PROJECTS("Vault", Icons.Default.Folder)
}

@Composable
fun MainScreen(
    repository: ProjectRepository
) {
    var currentTab by remember { mutableStateOf(AppTab.CAD_DRAW) }

    // Active project state
    val initialProjects = remember { repository.listProjects() }
    val initialId = initialProjects.firstOrNull()?.id ?: "demo_security_8strand"
    var currentProject by remember {
        mutableStateOf(repository.getProject(initialId) ?: repository.createProject("Perimeter 1", com.fencecad.model.FenceType.SECURITY))
    }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = BgPanel,
                tonalElevation = 8.dp
            ) {
                AppTab.values().forEach { tab ->
                    val isSelected = currentTab == tab
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentTab = tab },
                        icon = {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.title,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        label = {
                            Text(
                                text = tab.title,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 8.5.sp
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = AmberEnergizer,
                            selectedTextColor = AmberEnergizer,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted,
                            indicatorColor = AmberDim
                        )
                    )
                }
            }
        },
        containerColor = BgDark
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (currentTab) {
                AppTab.CAD_DRAW -> {
                    CadDrawScreen(
                        currentProject = currentProject,
                        onProjectUpdated = { updated ->
                            currentProject = updated
                            repository.saveProject(updated)
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
                AppTab.FIELD_TOOLS -> {
                    FieldToolsScreen(
                        currentProject = currentProject,
                        onProjectUpdated = { updated ->
                            currentProject = updated
                            repository.saveProject(updated)
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
                AppTab.SCHEMATIC -> {
                    SchematicScreen(
                        modifier = Modifier.fillMaxSize()
                    )
                }
                AppTab.DIAGNOSTICS -> {
                    DiagnosticsScreen(
                        modifier = Modifier.fillMaxSize()
                    )
                }
                AppTab.PROCUREMENT -> {
                    ProcurementScreen(
                        currentProject = currentProject,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                AppTab.PROJECTS -> {
                    ProjectsScreen(
                        repository = repository,
                        currentProjectId = currentProject.id,
                        onSelectProject = { selected ->
                            currentProject = selected
                            currentTab = AppTab.CAD_DRAW
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}
