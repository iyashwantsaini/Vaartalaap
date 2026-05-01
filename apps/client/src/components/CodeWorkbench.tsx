import { useMemo, useState, useEffect, useRef } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import HistoryIcon from "@mui/icons-material/History";
import { languages } from "../lib/languages";
import { executeCode } from "../lib/codeExecutor";
import { CollabCodeEditor } from "./CollabCodeEditor";

interface RunHistoryEntry {
  at: number;
  language: string;
  output: string;
  durationMs: number;
}

const HISTORY_LIMIT = 8;

const customDarkTheme = EditorView.theme({
  "&": { backgroundColor: "#050505 !important" },
  ".cm-gutters": { backgroundColor: "#050505 !important", borderRight: "1px solid #1a1a1a", color: "#5a5a72" },
  ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04) !important" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.04) !important" },
});

const customLightTheme = EditorView.theme({
  "&": { backgroundColor: "#ffffff !important", color: "#0f0f14" },
  ".cm-content": { caretColor: "#0f0f14" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0f0f14" },
  ".cm-gutters": { backgroundColor: "#f7f7fb !important", borderRight: "1px solid #e5e5ec", color: "#9aa0b4" },
  ".cm-activeLine": { backgroundColor: "rgba(15,15,20,0.04) !important" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(15,15,20,0.04) !important" },
  "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "rgba(79,99,255,0.18)" },
});

interface CodeWorkbenchProps {
  value: string;
  language: typeof languages[number]["value"];
  input: string;
  output: string;
  readOnly?: boolean;
  onChange: (next: string) => void;
  onLanguageChange: (next: typeof languages[number]["value"]) => void;
  onInputChange: (next: string) => void;
  onOutputChange: (next: string) => void;
  // Collaboration context. When roomId is supplied the main code editor
  // switches to a Yjs-backed CRDT binding so concurrent edits merge cleanly
  // and remote cursors render with the peer's name + colour.
  roomId?: string;
  userName?: string;
  userColor?: string;
}

export const CodeWorkbench = ({
  value,
  language,
  input,
  output,
  readOnly = false,
  onChange,
  onLanguageChange,
  onInputChange,
  onOutputChange,
  roomId,
  userName,
  userColor,
}: CodeWorkbenchProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Ref-based handleRun reference so the keymap closure always sees latest props
  const handleRunRef = useRef<() => void>(() => {});

  const extensions = useMemo(() => {
    const preset = languages.find((e) => e.value === language) ?? languages[0];
    return [
      preset.extension,
      keymap.of([
        { key: "Mod-Enter", run: () => { handleRunRef.current(); return true; } },
      ]),
    ];
  }, [language]);

  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const baseTheme = useMemo(() => {
    const bg = isDark ? "#050505" : "#ffffff";
    const fg = isDark ? "#f4f4ff" : "#0f0f14";
    const caret = isDark ? "#fff" : "#0f0f14";
    const placeholder = isDark ? "#6e6e8a" : "#9aa0b4";
    return EditorView.theme({
      "&": { backgroundColor: `${bg} !important`, height: "100%", color: fg },
      ".cm-content": { caretColor: caret, fontFamily: "monospace", color: fg },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: caret, borderLeftWidth: "2px" },
      "&.cm-focused .cm-cursor": { borderLeftColor: caret },
      "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "rgba(79,99,255,0.35)" },
      "&.cm-focused": { outline: "none" },
      ".cm-gutters": { backgroundColor: "transparent", border: "none" },
      ".cm-placeholder": { color: placeholder },
    });
  }, [isDark]);

  useEffect(() => {
    if (!value) {
      const langConfig = languages.find((l) => l.value === language);
      if (langConfig) onChange(langConfig.template);
    }
  }, [language, value, onChange]);

  const handleRun = async () => {
    if (isRunning || readOnly) return;
    setIsRunning(true);
    onOutputChange("Running...");
    const startedAt = Date.now();
    try {
      const result = await executeCode(language, value, input);
      onOutputChange(result.output);
      setHistory((prev) => [
        { at: startedAt, language, output: result.output, durationMs: Date.now() - startedAt },
        ...prev,
      ].slice(0, HISTORY_LIMIT));
    } catch {
      onOutputChange("Failed to execute code. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setToast("Output copied");
    } catch {
      setToast("Copy failed — your browser blocked clipboard access");
    }
  };

  const handleClearOutput = () => {
    onOutputChange("");
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // Keep the keymap-callable ref pointed at the latest closure
  useEffect(() => {
    handleRunRef.current = handleRun;
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.default", minWidth: 0 }}>
      {/* Toolbar */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          gap: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Typography
            variant="caption"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: "0.68rem",
              background: "linear-gradient(135deg, #4f63ff 0%, #8b9eff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Language
          </Typography>
          <Select
            size="small"
            value={language}
            disabled={readOnly}
            onChange={(e) => onLanguageChange(e.target.value as CodeWorkbenchProps["language"])}
            sx={{
              fontFamily: "monospace",
              fontWeight: 700,
              fontSize: "0.85rem",
              minWidth: 140,
              "& .MuiSelect-select": { py: 0.75 },
            }}
          >
            {languages.map((entry) => (
              <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>
            ))}
          </Select>
        </Stack>
        <Tooltip title="Run">
          <span>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={handleRun}
              disabled={isRunning || readOnly}
              sx={{ fontFamily: "monospace", fontWeight: 800 }}
            >
              {isRunning ? "Running\u2026" : "Run"}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Editor area */}
      <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ flex: 1, overflow: "hidden", "& .cm-editor": { height: "100%", fontFamily: "monospace" }, "& .cm-scroller": { overflowY: "auto !important" } }}>
          {roomId ? (
            // Collaborative path: Y.Doc per (roomId, language) so language
            // switches load independent buffers; remote cursors render via
            // y-codemirror.next + awareness.
            <CollabCodeEditor
              key={`${roomId}::code:${language}::${isDark ? "d" : "l"}`}
              roomId={roomId}
              docName={`code:${language}`}
              languageExtension={(languages.find((e) => e.value === language) ?? languages[0]).extension}
              readOnly={readOnly}
              userName={userName || "Guest"}
              userColor={userColor || "#7f7fff"}
              extraExtensions={[
                ...(isDark
                  ? [oneDark, customDarkTheme]
                  : [customLightTheme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })]),
                keymap.of([
                  { key: "Mod-Enter", run: () => { handleRunRef.current(); return true; } },
                ]),
              ]}
              // Seed ONLY with the language template, never with `value`.
              // `value` is the legacy room.documents.code field which we still
              // mirror for REST snapshots — feeding it back as a seed would
              // duplicate content on every remount because it now contains
              // whatever was last persisted.
              seedIfEmpty={languages.find((l) => l.value === language)?.template ?? ""}
              onTextChange={onChange}
            />
          ) : (
            // Solo / lobby preview path — plain CodeMirror, no collab overhead.
            <CodeMirror
              value={value}
              height="100%"
              theme={isDark ? oneDark : "light"}
              extensions={[
                ...extensions,
                ...(isDark
                  ? [customDarkTheme]
                  : [customLightTheme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })]),
              ]}
              editable={!readOnly}
              basicSetup={{ lineNumbers: true, autocompletion: true }}
              onChange={(next) => onChange(next)}
            />
          )}
        </Box>

        {/* IO Panel */}
        <Box sx={{ height: 200, borderTop: "1px solid", borderColor: "divider", display: "flex", minWidth: 0, minHeight: 100 }}>
          {/* Input */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid", borderColor: "divider", overflow: "hidden", minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              sx={{ px: 2, py: 0.25, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", minHeight: 32 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  color: "text.secondary",
                }}
              >
                Input · stdin
              </Typography>
            </Stack>
            <Box sx={{ flex: 1, overflow: "hidden", bgcolor: isDark ? "#050505" : "#ffffff", "& .cm-editor": { height: "100%" }, "& .cm-scroller": { overflowY: "auto !important" } }}>
              <CodeMirror
                value={input}
                height="100%"
                theme={baseTheme}
                editable={!readOnly}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                onChange={(val) => onInputChange(val)}
                placeholder="Enter input for your program here..."
              />
            </Box>
          </Box>
          {/* Output */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 2, py: 0.25, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", minHeight: 32 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                  color: "text.secondary",
                }}
              >
                Output
              </Typography>
              <Stack direction="row" spacing={0.25} alignItems="center">
                <Tooltip title={history.length === 0 ? "No runs yet" : `Run history (${history.length})`}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={history.length === 0}
                      onClick={(e) => setHistoryAnchor(e.currentTarget)}
                      sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                    >
                      <HistoryIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Copy output">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!output}
                      onClick={handleCopyOutput}
                      sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                    >
                      <ContentCopyIcon sx={{ fontSize: "0.95rem" }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Clear output">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!output || readOnly}
                      onClick={handleClearOutput}
                      sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            <Box sx={{ flex: 1, overflow: "hidden", bgcolor: isDark ? "#050505" : "#ffffff", "& .cm-editor": { height: "100%" }, "& .cm-scroller": { overflowY: "auto !important" } }}>
              <CodeMirror
                value={output}
                height="100%"
                theme={baseTheme}
                editable={false}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                placeholder="Output will appear here..."
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Run history dropdown */}
      <Menu
        anchorEl={historyAnchor}
        open={Boolean(historyAnchor)}
        onClose={() => setHistoryAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { maxWidth: 360, minWidth: 260, maxHeight: 360 } } }}
      >
        {history.map((entry, idx) => {
          const langLabel = languages.find((l) => l.value === entry.language)?.label ?? entry.language;
          const preview = (entry.output || "").split("\n")[0]?.slice(0, 60) ?? "(empty)";
          return (
            <MenuItem
              key={`${entry.at}-${idx}`}
              onClick={() => {
                onOutputChange(entry.output);
                setHistoryAnchor(null);
              }}
              sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", py: 1, gap: 0.25 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.main" }}>
                  {langLabel}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", flex: 1 }}>
                  {formatTime(entry.at)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>
                  {entry.durationMs} ms
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "monospace",
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {preview || "(empty)"}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={1800}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={toast ?? ""}
      />
    </Box>
  );
};
