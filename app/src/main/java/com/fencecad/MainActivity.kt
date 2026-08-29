package com.fencecad

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.fencecad.storage.ProjectRepository
import com.fencecad.ui.screens.MainScreen
import com.fencecad.ui.screens.SplashScreen
import com.fencecad.ui.theme.BgDark
import com.fencecad.ui.theme.FenceSenseTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val repository = ProjectRepository(applicationContext)

        setContent {
            FenceSenseTheme {
                var showSplash by remember { mutableStateOf(true) }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = BgDark
                ) {
                    if (showSplash) {
                        SplashScreen(
                            onDone = { showSplash = false }
                        )
                    } else {
                        MainScreen(
                            repository = repository
                        )
                    }
                }
            }
        }
    }
}
