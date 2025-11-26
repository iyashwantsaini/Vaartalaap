import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
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

const CanvasShell = styled.div`
  position: relative;
  flex: 1;
  background: #000;
  overflow: hidden;
`;

const CanvasElement = styled.canvas`
  width: 100%;
  height: 100%;
  cursor: crosshair;
`;

const Toolbar = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 0px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  z-index: 10;
  
  max-width: 90%;
  overflow-x: auto;
  
  /* Hide scrollbar */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;

  @media (max-width: 768px) {
    gap: 0.25rem;
    padding: 0.35rem;
    justify-content: flex-start;
  }
`;

const ToolButton = styled.button<{
  $active?: boolean;
  $color?: string;
  $textColor?: string;
}>`
  width: 2rem;
  height: 2rem;
  border-radius: 0px;
  border: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.text : "transparent")};
  background: ${({ $color, theme }) => $color || theme.colors.surfaceMuted};
  color: ${({ theme, $textColor }) => $textColor || theme.colors.text};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
  flex-shrink: 0;

  &:hover {
    transform: scale(1.1);
    box-shadow: 2px 2px 0px ${({ theme }) => theme.colors.text};
  }

  @media (max-width: 768px) {
    width: 1.75rem;
    height: 1.75rem;
    
    svg {
      width: 16px;
      height: 16px;
    }
  }
`;

const Separator = styled.div`
  width: 1px;
  background: #333;
  margin: 0 4px;
`;

const ExpandedOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  z-index: 2000;
  display: flex;
  flex-direction: column;
`;

const ExpandedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

interface WhiteboardProps {
  strokes: RoomWhiteboardStroke[];
  readOnly?: boolean;
  onStrokesChange: (next: RoomWhiteboardStroke[]) => void;
}

const COLORS = [
  "#ffffff", // White
  "#ff5d78", // Red
  "#0fb56d", // Green
  "#2979ff", // Blue
  "#ffeb3b", // Yellow
];

export const Whiteboard = ({ strokes, readOnly = false, onStrokesChange }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeColor, setActiveColor] = useState("#ffffff");
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
      drawAllStrokes(context, strokes, rect.width, rect.height, scale, offset);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [strokes, scale, offset, isExpanded]);

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
      color: isEraser ? "#000000" : activeColor,
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
    drawAllStrokes(context, strokes, rect.width, rect.height, scale, offset);
    
    // Draw current stroke
    const pts = drawingRef.current.stroke.points;
    if (pts.length < 2) return;
    
    context.save();
    context.translate(offset.x, offset.y);
    context.scale(scale, scale);
    
    context.strokeStyle = drawingRef.current.stroke.color;
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

  const content = (
    <CanvasShell style={isExpanded ? { border: 'none' } : {}}>
      <Toolbar>
        <ToolButton
          $active={isPanning}
          onClick={() => {
            setIsPanning(true);
            setIsEraser(false);
          }}
          title="Pan Tool"
        >
          <HandIcon />
        </ToolButton>
        <Separator />
        <ToolButton
          onClick={() => setScale(s => Math.min(s * 1.2, 5))}
          title="Zoom In"
        >
          <ZoomInIcon />
        </ToolButton>
        <ToolButton
          onClick={() => setScale(s => Math.max(s / 1.2, 0.1))}
          title="Zoom Out"
        >
          <ZoomOutIcon />
        </ToolButton>
        {!readOnly && (
          <>
            <Separator />
            {COLORS.map((color) => (
              <ToolButton
                key={color}
                $color={color}
                $active={!isEraser && !isPanning && activeColor === color}
                onClick={() => {
                  setActiveColor(color);
                  setIsEraser(false);
                  setIsPanning(false);
                }}
                title="Color"
              />
            ))}
            <Separator />
            <ToolButton
              $active={isEraser}
              onClick={() => {
                setIsEraser(true);
                setIsPanning(false);
              }}
              title="Eraser"
            >
              <EraserIcon />
            </ToolButton>
            <ToolButton onClick={handleUndo} title="Undo">
              <UndoIcon />
            </ToolButton>
            <ToolButton onClick={handleClear} title="Clear All" $textColor="#ff5d78">
              <TrashIcon />
            </ToolButton>
          </>
        )}
        <Separator />
        <ToolButton onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Minimize" : "Maximize"}>
          {isExpanded ? <CloseIcon /> : <MaximizeIcon />}
        </ToolButton>
      </Toolbar>
      <CanvasElement
        ref={canvasRef}
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
    </CanvasShell>
  );

  if (isExpanded) {
    return createPortal(
      <ExpandedOverlay>
        <ExpandedHeader>
          <HeaderTitle>Whiteboard</HeaderTitle>
          <ToolButton onClick={() => setIsExpanded(false)}>
            <CloseIcon />
          </ToolButton>
        </ExpandedHeader>
        {content}
      </ExpandedOverlay>,
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
  offset: { x: number; y: number }
) => {
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(offset.x, offset.y);
  context.scale(scale, scale);
  
  for (const stroke of allStrokes) {
    if (stroke.points.length < 2) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.beginPath();
    const [first, ...rest] = stroke.points;
    context.moveTo(first.x, first.y);
    for (const point of rest) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }
  context.restore();
};
