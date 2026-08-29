package com.fencecad.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = AmberEnergizer,
    onPrimary = Color.Black,
    primaryContainer = AmberDim,
    onPrimaryContainer = AmberEnergizer,
    secondary = BridgeHotBlue,
    onSecondary = Color.Black,
    secondaryContainer = Color(0xFF1E293B),
    onSecondaryContainer = Color(0xFF93C5FD),
    tertiary = EarthWireGreen,
    onTertiary = Color.Black,
    error = HtWireRed,
    onError = Color.Black,
    errorContainer = HtWireRedDim,
    onErrorContainer = HtWireRed,
    background = BgDark,
    onBackground = TextPrimary,
    surface = BgPanel,
    onSurface = TextPrimary,
    surfaceVariant = BgCard,
    onSurfaceVariant = TextMuted,
    outline = BorderDark,
    outlineVariant = BorderHighlight
)

@Composable
fun FenceSenseTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
