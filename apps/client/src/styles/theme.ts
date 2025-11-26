export const theme = {
  colors: {
    background: "#0d0d0d",
    surface: "#121212",
    surfaceMuted: "#1a1a1a",
    text: "#ffffff",
    textMuted: "#8a8a8a",
    accent: "#3d5afe", // NeoPop Blue
    accentSoft: "#818cf8",
    border: "#333333",
    highlight: "#ffffff",
    gradientStart: "#ffffff",
    gradientEnd: "#a8a4ff",
    success: "#00bfa5", // NeoPop Teal
    error: "#ff1744", // NeoPop Red
    warning: "#ff9100", // NeoPop Orange
  },
  fonts: {
    heading: "'Inter Variable', 'Inter', 'Space Grotesk', sans-serif",
    body: "'Inter Variable', 'Inter', 'Space Grotesk', sans-serif",
    mono: "'Space Mono', 'IBM Plex Mono', monospace",
  },
  radii: {
    none: "0px",
    sm: "0px", // Sharp corners for NeoPop
    md: "0px",
    pill: "999px", // Keep pills for badges if needed, or make them 0px too
  },
  space: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.5rem",
  },
  shadows: {
    focus: "0 0 0 1px #ffffff",
    glow: "0 0 20px rgba(61, 90, 254, 0.3)",
    elevated: "4px 4px 0px #000000", // Hard shadow
    card: "8px 8px 0px #000000", // Deeper hard shadow
  },
  gradients: {
    aurora: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(168,164,255,0.2) 100%)",
  },
  borders: {
    thin: "1px solid #333333",
    thick: "2px solid #ffffff",
  }
} as const;

export type AppTheme = typeof theme;
