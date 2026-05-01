import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import type { RoomWhiteboardStroke } from "@vaartalaap/shared";
import { ConfirmationDialog } from "./ConfirmationDialog";

const HandIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0a2 2 0 0 0-2 2v0a2 2 0 0 0-2 2v1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z" />
  </svg>
);

const ZoomInIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const EraserIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" />
    <path d="M11 3L20 12" />
  </svg>
);

const UndoIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const MaximizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface WhiteboardProps {
  strokes: RoomWhiteboardStroke[];
  readOnly?: boolean;
  onStrokesChange: (next: RoomWhiteboardStroke[]) => void;
}

const COLORS = [
  "#ff5d78", // Red
  "#0fb56d", // Green
  "#2979ff", // Blue
  "#ffeb3b", // Yellow
  "#b388ff", // Purple
];

export const Whiteboard = ({ strokes, readOnly = false, onStrokesChange }: WhiteboardProps) => {
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const canvasBg = isDark ? "#0a0a0f" : "#ffffff";
  // Default ink is a vivid blue that has strong contrast against BOTH
  // light and dark canvas backgrounds — so collaborators never lose track of
  // strokes when someone else flips the theme.
  const defaultInk = "#2979ff";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeColor, setActiveColor] = useState(defaultInk);
  const [isEraser, setIsEraser] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const drawingRef = useRef<{
    active: boolean;
    stroke: RoomWhiteboardStroke | null;
    lastMousePos: { x: number; y: number } | null;
  }>({
    active: false,
    stroke: null,
    lastMousePos: null,
  });

  // Resize canvas to container and redraw strokes whenever they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
      drawAllStrokes(context, strokes, rect.width, rect.height, scale, offset, canvasBg);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [strokes, scale, offset, isExpanded, canvasBg]);

  const startStroke = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly && !isPanning) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (isPanning) {
      drawingRef.current = { active: true, stroke: null, lastMousePos: { x, y } };
      return;
    }

    if (readOnly) return;

    // Transform screen coordinates to world coordinates
    const worldX = (x - offset.x) / scale;
    const worldY = (y - offset.y) / scale;

    const stroke: RoomWhiteboardStroke = {
      id: crypto.randomUUID(),
      color: isEraser ? canvasBg : activeColor,
      width: isEraser ? 24 / scale : 3 / scale,
      points: [{ x: worldX, y: worldY }],
    };

    drawingRef.current = { active: true, stroke, lastMousePos: null };
  };

  const extendStroke = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (isPanning && drawingRef.current.lastMousePos) {
      const dx = x - drawingRef.current.lastMousePos.x;
      const dy = y - drawingRef.current.lastMousePos.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      drawingRef.current.lastMousePos = { x, y };
      return;
    }

    if (!drawingRef.current.stroke) return;

    const worldX = (x - offset.x) / scale;
    const worldY = (y - offset.y) / scale;

    drawingRef.current.stroke.points.push({ x: worldX, y: worldY });

    const context = canvas.getContext("2d");
    if (!context) return;
    
    // Redraw everything to handle pan/zoom correctly during draw
    // Optimization: In a real app, we might want to layer canvases
    drawAllStrokes(context, strokes, rect.width, rect.height, scale, offset, canvasBg);
    
    // Draw current stroke
    const pts = drawingRef.current.stroke.points;
    if (pts.length < 2) return;
    
    context.save();
    context.translate(offset.x, offset.y);
    context.scale(scale, scale);
    
    context.strokeStyle = resolveStrokeColor(drawingRef.current.stroke.color, canvasBg);
    context.lineWidth = drawingRef.current.stroke.width;
    context.lineCap = "round";
    context.beginPath();
    // Draw just the last segment for performance if we weren't redrawing everything
    // But since we redraw everything above, we can just draw the whole current stroke or last segment
    // Let's draw the whole current stroke to be safe with transforms
    const [first, ...rest] = pts;
    context.moveTo(first.x, first.y);
    for (const point of rest) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
    context.restore();
  };

  const endStroke = () => {
    if (!drawingRef.current.active) return;
    
    if (isPanning) {
      drawingRef.current = { active: false, stroke: null, lastMousePos: null };
      return;
    }

    if (!drawingRef.current.stroke) {
      drawingRef.current = { active: false, stroke: null, lastMousePos: null };
      return;
    }

    const completed = drawingRef.current.stroke;
    drawingRef.current = { active: false, stroke: null, lastMousePos: null };
    if (completed.points.length > 1) {
      onStrokesChange([...strokes, completed]);
    }
  };

  const handleUndo = () => {
    if (strokes.length > 0) {
      onStrokesChange(strokes.slice(0, -1));
    }
  };

  const handleClear = () => {
    setIsClearDialogOpen(true);
  };

  const confirmClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onStrokesChange([]);
    setIsClearDialogOpen(false);
  };

  const toolbarContent = (
    <Box
      sx={{
        position: "absolute", top: "1rem", left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 0.5, p: 0.5, bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider", zIndex: 10,
        maxWidth: "90%", overflowX: "auto",
        "&::-webkit-scrollbar": { display: "none" }, msOverflowStyle: "none", scrollbarWidth: "none",
      }}
    >
      <Tooltip title="Pan Tool">
        <IconButton size="small" onClick={() => { setIsPanning(true); setIsEraser(false); }} color={isPanning ? "primary" : "default"}>
          <HandIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ width: "1px", bgcolor: "divider", mx: 0.5, flexShrink: 0, alignSelf: "stretch" }} />
      <Tooltip title="Zoom In">
        <IconButton size="small" onClick={() => setScale((s) => Math.min(s * 1.2, 5))}><ZoomInIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Zoom Out">
        <IconButton size="small" onClick={() => setScale((s) => Math.max(s / 1.2, 0.1))}><ZoomOutIcon /></IconButton>
      </Tooltip>
      {!readOnly && (
        <>
          <Box sx={{ width: "1px", bgcolor: "divider", mx: 0.5, flexShrink: 0, alignSelf: "stretch" }} />
          {COLORS.map((color) => (
            <Box
              key={color}
              component="button"
              onClick={() => { setActiveColor(color); setIsEraser(false); setIsPanning(false); }}
              title={color}
              sx={{
                width: 28, height: 28, bgcolor: color, border: "2px solid",
                borderColor: (!isEraser && !isPanning && activeColor === color) ? "text.primary" : "transparent",
                cursor: "pointer", flexShrink: 0, "&:hover": { transform: "scale(1.15)" },
              }}
            />
          ))}
          <Box sx={{ width: "1px", bgcolor: "divider", mx: 0.5, flexShrink: 0, alignSelf: "stretch" }} />
          <Tooltip title="Eraser">
            <IconButton size="small" onClick={() => { setIsEraser(true); setIsPanning(false); }} color={isEraser ? "primary" : "default"}>
              <EraserIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Undo">
            <IconButton size="small" onClick={handleUndo}><UndoIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Clear All">
            <IconButton size="small" onClick={handleClear} sx={{ color: "error.main" }}><TrashIcon /></IconButton>
          </Tooltip>
        </>
      )}
      <Box sx={{ width: "1px", bgcolor: "divider", mx: 0.5, flexShrink: 0, alignSelf: "stretch" }} />
      <Tooltip title={isExpanded ? "Minimize" : "Maximize"}>
        <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <CloseIcon /> : <MaximizeIcon />}
        </IconButton>
      </Tooltip>
    </Box>
  );

  const content = (
    <Box sx={{ position: "relative", flex: 1, bgcolor: canvasBg, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {toolbarContent}
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ width: "100%", height: "100%", cursor: isPanning ? "grab" : "crosshair" }}
        onMouseDown={startStroke}
        onMouseMove={extendStroke}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
      />
      <ConfirmationDialog
        open={isClearDialogOpen}
        title="Clear Whiteboard?"
        description="This will remove all drawings for everyone in the room. This action cannot be undone."
        confirmLabel="Clear Board"
        onConfirm={confirmClear}
        onCancel={() => setIsClearDialogOpen(false)}
      />
    </Box>
  );

  if (isExpanded) {
    return createPortal(
      <Box sx={{ position: "fixed", inset: 0, bgcolor: canvasBg, zIndex: 2000, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 3, py: 1.5, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
          <Box component="h2" sx={{ m: 0, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "text.primary" }}>Whiteboard</Box>
          <IconButton onClick={() => setIsExpanded(false)}><CloseIcon /></IconButton>
        </Box>
        {content}
      </Box>,
      document.body
    );
  }

  return content;
};

const drawAllStrokes = (
  context: CanvasRenderingContext2D,
  allStrokes: RoomWhiteboardStroke[],
  width: number,
  height: number,
  scale: number,
  offset: { x: number; y: number },
  canvasBg: string
) => {
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(offset.x, offset.y);
  context.scale(scale, scale);
  for (const stroke of allStrokes) {
    if (stroke.points.length < 2) continue;
    context.strokeStyle = resolveStrokeColor(stroke.color, canvasBg);
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.beginPath();
    const [first, ...rest] = stroke.points;
    context.moveTo(first.x, first.y);
    for (const point of rest) context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
};

// Auto-contrast: if a stroke colour is too close to the current canvas
// background (because it was drawn in the opposite theme, or it's an eraser
// stroke from a previous bg), render it with a contrasting ink so collab
// content stays visible after a theme flip. Coloured strokes (red, green,
// blue, etc.) are passed through unchanged.
const hexLuminance = (hex: string): number => {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const resolveStrokeColor = (color: string, bg: string): string => {
  if (!color.startsWith("#")) return color;
  const cl = hexLuminance(color);
  const bl = hexLuminance(bg);
  // Near-bg colour → treat as eraser, render as new bg (stays invisible).
  if (Math.abs(cl - bl) < 0.15) return bg;
  // White ink on light bg or black ink on dark bg → flip to contrasting ink.
  if (bl > 0.5 && cl > 0.85) return "#0f0f14";
  if (bl < 0.5 && cl < 0.15) return "#ffffff";
  return color;
};
