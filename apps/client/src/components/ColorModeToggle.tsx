import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useColorMode } from "../styles/ColorModeProvider";

interface ColorModeToggleProps {
  size?: "small" | "medium" | "large";
}

export const ColorModeToggle = ({ size = "small" }: ColorModeToggleProps) => {
  const { mode, toggle } = useColorMode();
  const isDark = mode === "dark";
  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton
        size={size}
        onClick={toggle}
        aria-label="toggle color mode"
        sx={{ color: "text.primary" }}
      >
        {isDark ? <LightModeIcon fontSize={size} /> : <DarkModeIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
};
