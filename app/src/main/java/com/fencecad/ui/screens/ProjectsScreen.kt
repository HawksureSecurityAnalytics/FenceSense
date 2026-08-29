package com.fencecad.ui.screens

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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.fencecad.model.FenceProject
import com.fencecad.model.FenceType
import com.fencecad.model.ProjectMeta
import com.fencecad.storage.ProjectRepository
import com.fencecad.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ProjectsScreen(
    repository: ProjectRepository,
    currentProjectId: String,
    onSelectProject: (FenceProject) -> Unit,
    modifier: Modifier = Modifier
) {
    var projectsList by remember { mutableStateOf(repository.listProjects()) }
    var showNewProjectDialog by remember { mutableStateOf(false) }
    var newProjectName by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf(FenceType.SECURITY) }

    fun refresh() {
        projectsList = repository.listProjects()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // HEADER
        Surface(
            color = BgPanel,
            tonalElevation = 2.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "📁 CAD PROJECT VAULT",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer
                    )
                    Text(
                        text = "${projectsList.size} Saved Perimeter Layouts",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted
                    )
                }

                Button(
                    onClick = {
                        newProjectName = "Perimeter ${projectsList.size + 1}"
                        showNewProjectDialog = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("NEW PROJECT", color = Color.Black, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                }
            }
        }

        // PROJECTS LIST
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(projectsList) { meta ->
                val isCurrent = meta.id == currentProjectId
                val sdf = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault())
                val dateStr = sdf.format(Date(meta.updatedAt))

                Card(
                    colors = CardDefaults.cardColors(containerColor = if (isCurrent) AmberDim else BgCard),
                    border = BorderStroke(1.dp, if (isCurrent) AmberEnergizer else BorderDark),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            val proj = repository.getProject(meta.id)
                            if (proj != null) {
                                onSelectProject(proj)
                            }
                        }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(if (isCurrent) AmberEnergizer else BgDark, CircleShape)
                                .border(1.dp, if (isCurrent) AmberEnergizer else BorderDark, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(meta.fenceType.icon, fontSize = 20.sp)
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = meta.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (isCurrent) AmberEnergizer else TextPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                if (isCurrent) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(
                                        color = AmberEnergizer,
                                        shape = RoundedCornerShape(3.dp)
                                    ) {
                                        Text(
                                            "ACTIVE",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color.Black,
                                            fontSize = 7.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                            }
                            Text(
                                text = "${meta.fenceType.displayName} · Updated $dateStr",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextMuted,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }

                        // Delete button
                        if (projectsList.size > 1) {
                            IconButton(
                                onClick = {
                                    repository.deleteProject(meta.id)
                                    refresh()
                                },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = TextMuted, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    // NEW PROJECT DIALOG
    if (showNewProjectDialog) {
        Dialog(onDismissRequest = { showNewProjectDialog = false }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = BgPanel,
                border = BorderStroke(1.dp, BorderDark),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "⚡ CREATE NEW PERIMETER PROJECT",
                        style = MaterialTheme.typography.titleMedium,
                        color = AmberEnergizer
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = newProjectName,
                        onValueChange = { newProjectName = it },
                        label = { Text("Project Name") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AmberEnergizer,
                            unfocusedBorderColor = BorderDark,
                            focusedTextColor = AmberEnergizer,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                    Text("APPLICATION TYPE", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FenceType.values().forEach { ft ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(if (selectedType == ft) AmberDim else BgCard, RoundedCornerShape(6.dp))
                                    .border(1.dp, if (selectedType == ft) AmberEnergizer else BorderDark, RoundedCornerShape(6.dp))
                                    .clickable { selectedType = ft }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(ft.displayName.take(4), style = MaterialTheme.typography.labelSmall, color = if (selectedType == ft) AmberEnergizer else TextMuted)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = { showNewProjectDialog = false }) {
                            Text("Cancel", color = TextMuted)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (newProjectName.isNotBlank()) {
                                    val newProj = repository.createProject(newProjectName.trim(), selectedType)
                                    onSelectProject(newProj)
                                    refresh()
                                    showNewProjectDialog = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AmberEnergizer)
                        ) {
                            Text("Create", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
