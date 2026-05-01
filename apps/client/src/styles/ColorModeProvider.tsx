import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { buildMuiTheme } from "./muiTheme";

type ColorMode = "light" | "dark";

interface ColorModeContextValue {
  mode: ColorMode;
  toggle: () => void;
  setMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

const STORAGE_KEY = "vaartalaap:color-mode";

const readInitialMode = (): ColorMode => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Fall back to OS preference.
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
};

interface ColorModeProviderProps {
  children: ReactNode;
}

export const ColorModeProvider = ({ children }: ColorModeProviderProps) => {
  const [mode, setModeState] = useState<ColorMode>(readInitialMode);

  // Persist user's choice across reloads.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
    // Reflect the mode on <html> so non-MUI surfaces (CodeMirror, custom CSS,
    // browser scrollbars) can react via the [data-color-mode] attribute or
    // the standard color-scheme property.
    document.documentElement.dataset.colorMode = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggle = useCallback(() => {
    setModeState((m) => (m === "dark" ? "light" : "dark"));
  }, []);

  const setMode = useCallback((next: ColorMode) => setModeState(next), []);

  const theme = useMemo(() => buildMuiTheme(mode), [mode]);
  const ctx = useMemo<ColorModeContextValue>(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);

  return (
    <ColorModeContext.Provider value={ctx}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};

export const useColorMode = (): ColorModeContextValue => {
  const ctx = useContext(ColorModeContext);
  if (!ctx) {
    // During SSR or tests without a provider, return a no-op shim.
    return {
      mode: "dark",
      toggle: () => {},
      setMode: () => {},
    };
  }
  return ctx;
};
