import { createTheme, type Theme } from "@mui/material/styles";

// Two MUI themes (dark + light) sharing the same brand colours and component
// overrides. Exporting a factory keeps the overrides DRY.

const baseComponents = (mode: "light" | "dark") => ({
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 2,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      containedPrimary: {
        "&:hover": { backgroundColor: "#5570ff" },
      },
      outlinedPrimary: {
        borderColor: mode === "dark" ? "#22222e" : "#d6d6e0",
        "&:hover": {
          borderColor: "#4f63ff",
          backgroundColor: "rgba(79, 99, 255, 0.08)",
        },
      },
    },
  },
  MuiTextField: {
    defaultProps: { variant: "outlined", size: "small" },
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.9rem",
          "& fieldset": { borderColor: mode === "dark" ? "#22222e" : "#d6d6e0" },
          "&:hover fieldset": { borderColor: mode === "dark" ? "#6e6e8a" : "#9b9bb0" },
          "&.Mui-focused fieldset": { borderColor: "#4f63ff" },
        },
        "& .MuiInputLabel-root": {
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.85rem",
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 4,
        border: `1px solid ${mode === "dark" ? "#22222e" : "#d6d6e0"}`,
        backgroundImage: "none",
        backgroundColor: mode === "dark" ? "#0f0f14" : "#ffffff",
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: { fontWeight: 800, letterSpacing: "-0.02em" },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 2,
        fontFamily: "'Space Mono', monospace",
        fontSize: "0.75rem",
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        minHeight: 48,
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      indicator: { backgroundColor: "#4f63ff", height: 3 },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { backgroundImage: "none" },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
        backgroundColor: mode === "dark" ? "#0f0f14" : "#ffffff",
        borderBottom: `1px solid ${mode === "dark" ? "#22222e" : "#e5e5ec"}`,
        boxShadow: "none",
        color: mode === "dark" ? "#f4f4ff" : "#0f0f14",
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 2,
        fontFamily: "'Space Mono', monospace",
        fontSize: "0.75rem",
        backgroundColor: "#22222e",
        border: "1px solid #22222e",
        color: "#ffffff",
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 2 },
    },
  },
  MuiList: {
    styleOverrides: {
      root: { padding: 0 },
    },
  },
});

const baseTypography = {
  fontFamily: "'Inter Variable', 'Inter', sans-serif",
  h1: { fontWeight: 900, letterSpacing: "-0.04em" },
  h2: { fontWeight: 800, letterSpacing: "-0.03em" },
  h3: { fontWeight: 800, letterSpacing: "-0.02em" },
  h4: { fontWeight: 700 },
  h5: { fontWeight: 700 },
  h6: { fontWeight: 700 },
  button: {
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  caption: {
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.08em",
  },
  overline: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    letterSpacing: "0.2em",
  },
};

export const buildMuiTheme = (mode: "light" | "dark"): Theme => {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#4f63ff",
        light: "#8b9eff",
        dark: "#3347d4",
        contrastText: "#ffffff",
      },
      secondary: {
        main: isDark ? "#8b9eff" : "#3347d4",
        contrastText: "#ffffff",
      },
      error: { main: "#ff3b5c" },
      success: { main: "#00c896" },
      warning: { main: "#ffaa00" },
      background: {
        default: isDark ? "#09090d" : "#f7f7fb",
        paper: isDark ? "#0f0f14" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f4f4ff" : "#0f0f14",
        secondary: isDark ? "#6e6e8a" : "#5a5a72",
      },
      divider: isDark ? "#22222e" : "#e5e5ec",
    },
    typography: baseTypography,
    shape: { borderRadius: 2 },
    components: baseComponents(mode) as any,
  });
};

// Backwards-compat default export: dark theme. Existing imports keep working
// while we transition consumers to the context-driven theme.
export const muiTheme = buildMuiTheme("dark");
