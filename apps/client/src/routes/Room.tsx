import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import HomeIcon from "@mui/icons-material/Home";
import LinkIcon from "@mui/icons-material/Link";
import { nanoid } from "nanoid";
import type { RoomSnapshot, RoomTab } from "@vaartalaap/shared";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { languages } from "../lib/languages";
import { CodeWorkbench } from "../components/CodeWorkbench";
import { Whiteboard } from "../components/Whiteboard";
import { CallPanel } from "../components/CallPanel";
import { ChatPanel } from "../components/ChatPanel";
import { Notepad } from "../components/Notepad";
import { RoomLobby } from "../components/RoomLobby";
import { ExecQuotaChip } from "../components/ExecQuotaChip";
import { ColorModeToggle } from "../components/ColorModeToggle";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const MAX_OUTPUT_BYTES = 50_000;

export const RoomRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams<{ roomId: string }>();
  const state = location.state as { joined?: boolean; participantId?: string; displayName?: string } | null;

  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-found">("loading");
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>(() => {
    if (state?.displayName) return state.displayName;
    return localStorage.getItem("vaartalaap:displayName") ?? "";
  });
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(state?.joined ?? false);
  const [localParticipantId, setLocalParticipantId] = useState<string | undefined>(state?.participantId);
  const [isSocketReady, setIsSocketReady] = useState(false);

  // Each user controls their own tab — not synced to server
  const [activeTab, setActiveTab] = useState<RoomTab>("code");

  // Toast for participant join/leave notifications
  const [toast, setToast] = useState<{ message: string; severity: "info" | "success" | "warning" } | null>(null);
  const knownParticipantsRef = useRef<Set<string>>(new Set());

  // Stable per-participant colour for collaborative cursors. Derived from the
  // participantId so the same user always gets the same colour across reloads
  // and for every peer that sees them. We avoid storing it server-side to
  // keep the participant schema small.
  const userColor = useMemo(() => {
    if (!localParticipantId) return "#7f7fff";
    let h = 0;
    for (let i = 0; i < localParticipantId.length; i += 1) {
      h = (h * 31 + localParticipantId.charCodeAt(i)) >>> 0;
    }
    // Saturated, mid-bright HSL — readable on dark bg, distinct between users.
    const hue = h % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }, [localParticipantId]);

  // Debounce timers for high-frequency doc changes
  const codeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whiteboardDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear history state on mount so refresh treats user as new
  useEffect(() => {
    if (state?.joined) {
      window.history.replaceState({}, "");
    }
  }, []);

  // Clear debounce timers on unmount
  useEffect(() => {
    return () => {
      if (codeDebounce.current) clearTimeout(codeDebounce.current);
      if (notesDebounce.current) clearTimeout(notesDebounce.current);
      if (inputDebounce.current) clearTimeout(inputDebounce.current);
      if (whiteboardDebounce.current) clearTimeout(whiteboardDebounce.current);
    };
  }, []);

  // Sync local tab when room first loads
  useEffect(() => {
    if (room?.activeTab) {
      setActiveTab(room.activeTab);
    }
  }, [room?.roomId]); // only on first load, not every activeTab update

  // Socket: attach listeners, rejoin on reconnect
  useEffect(() => {
    if (!roomId || !localParticipantId) return;

    const socket = getSocket();
    // Capture the room/participant for cleanup, so even if state changes
    // during teardown we still emit a leave for the *exact* (roomId, pid)
    // pair that was joined.
    const joinedRoomId = roomId;
    const joinedParticipantId = localParticipantId;

    const handleConnect = () => {
      // Send displayName too so the server can re-add us as a participant
      // if we were dropped during a brief disconnect (grace-period removal).
      socket.emit("room:join", {
        roomId: joinedRoomId,
        participantId: joinedParticipantId,
        displayName: displayName || undefined,
      });
      setIsSocketReady(true);
    };

    const handleDocumentsUpdated = (payload: { roomId: string; documents?: RoomSnapshot["documents"] }) => {
      if (!payload?.documents) return;
      setRoom((current) => {
        if (!current || current.roomId !== payload.roomId) return current;
        return { ...current, documents: payload.documents! };
      });
    };

    const handleParticipantsUpdated = (participants: RoomSnapshot["participants"]) => {
      // Diff against previously known set to fire join/leave toasts
      const known = knownParticipantsRef.current;
      const next = new Set(participants.map((p) => p.id));
      if (known.size > 0) {
        for (const p of participants) {
          if (!known.has(p.id) && p.id !== joinedParticipantId) {
            setToast({ message: `${p.displayName} joined the room`, severity: "success" });
          }
        }
        for (const id of known) {
          if (!next.has(id) && id !== joinedParticipantId) {
            setToast({ message: `Someone left the room`, severity: "info" });
          }
        }
      }
      knownParticipantsRef.current = next;
      setRoom((current) => {
        if (!current) return current;
        return { ...current, participants };
      });
    };

    socket.on("connect", handleConnect);
    socket.on("room:documents-updated", handleDocumentsUpdated);
    socket.on("room:participants-update", handleParticipantsUpdated);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room:documents-updated", handleDocumentsUpdated);
      socket.off("room:participants-update", handleParticipantsUpdated);
      setIsSocketReady(false);
      // Tell the server to drop us from THIS room only. The shared socket
      // singleton stays alive for SPA navigation; without this, the server
      // would only learn about the leave on full disconnect, leaving a
      // ghost participant behind whenever the user navigates between rooms.
      if (socket.connected) {
        socket.emit("room:leave", { roomId: joinedRoomId });
      }
      // Reset the join-toast diff so we don't fire stale "joined" alerts
      // when entering the next room.
      knownParticipantsRef.current = new Set();
    };
  }, [roomId, localParticipantId]);

  // Load room snapshot
  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      try {
        setStatus("loading");
        const snapshot = await api.fetchRoom(roomId);
        setRoom(snapshot);
        setActiveTab(snapshot.activeTab ?? "code");
        setStatus("ready");
      } catch (fetchError) {
        const msg = fetchError instanceof Error ? fetchError.message : "Unable to load room";
        if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
          setStatus("not-found");
        } else {
          setError(msg);
          setStatus("error");
        }
      }
    };
    void load();
  }, [roomId]);

  const handleJoin = async (username?: string) => {
    if (!roomId) return;
    try {
      setIsJoining(true);
      const name = username ?? displayName;
      // Per-window identity:
      //   sessionStorage is per-tab and survives reload, BUT it gets COPIED
      //   when a window is duplicated ("Duplicate tab", "Open in new window",
      //   window.open inheriting context). That makes two windows share the
      //   same participantId, which makes the server treat them as one entry —
      //   refreshing one window then nukes the other window's entry from the
      //   participants list.
      //
      //   We disambiguate by tagging this window with a unique `window.name`
      //   on first load. window.name is unique per window (not copied across
      //   duplicates) and survives reload. We then key the per-room
      //   participantId by that window tag so duplicated windows get their
      //   own identity.
      if (!window.name || !window.name.startsWith("vaa-")) {
        window.name = `vaa-${nanoid(8)}`;
      }
      const storageKey = `vaartalaap:pid:${roomId}:${window.name}`;
      const stored = sessionStorage.getItem(storageKey);
      const newParticipantId = stored ?? nanoid();
      if (!stored) sessionStorage.setItem(storageKey, newParticipantId);
      const snapshot = await api.joinRoom(roomId, name || undefined, newParticipantId);
      setRoom(snapshot);
      if (name.trim()) {
        localStorage.setItem("vaartalaap:displayName", name.trim());
        setDisplayName(name.trim());
      }
      setLocalParticipantId(newParticipantId);
      setHasJoined(true);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join room");
      setStatus("error");
    } finally {
      setIsJoining(false);
    }
  };

  const participants = room?.participants ?? [];

  // Room not found — dedicated error page
  if (status === "not-found") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, bgcolor: "background.default" }}>
        <Typography variant="h5" fontWeight={700}>Room not found</Typography>
        <Typography color="text.secondary">The room <code>{roomId}</code> does not exist or has expired.</Typography>
        <Button variant="contained" startIcon={<HomeIcon />} onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </Box>
    );
  }

  // Generic error before room loaded
  if (status === "error" && error && !room) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, bgcolor: "background.default" }}>
        <Typography variant="h5" fontWeight={700}>Something went wrong</Typography>
        <Typography color="text.secondary">{error}</Typography>
        <Button variant="contained" startIcon={<HomeIcon />} onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </Box>
    );
  }

  // Lobby gate until user has joined
  if (!hasJoined) {
    return (
      <RoomLobby
        roomId={roomId ?? ""}
        onJoin={handleJoin}
        isLoading={isJoining}
        error={status === "error" ? error : null}
      />
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      {/* App Bar */}
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 52 }}>
          <Button
            color="inherit"
            onClick={() => navigate("/")}
            sx={{
              p: 0,
              minWidth: 0,
              "&:hover": { bgcolor: "transparent" },
            }}
          >
            <Typography
              component="span"
              sx={{
                fontWeight: 900,
                letterSpacing: "0.18em",
                fontSize: "0.95rem",
                background: "linear-gradient(135deg, #4f63ff 0%, #8b9eff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              VAARTALAAP
            </Typography>
          </Button>

          <Tooltip title="Click to copy room ID">
            <Chip
              label={roomId}
              size="small"
              variant="outlined"
              icon={<ContentCopyIcon sx={{ fontSize: "0.8rem !important" }} />}
              onClick={() => {
                if (!roomId) return;
                navigator.clipboard.writeText(roomId).then(
                  () => setToast({ message: "Room ID copied", severity: "success" }),
                  () => setToast({ message: "Copy failed", severity: "warning" }),
                );
              }}
              sx={{ fontFamily: "monospace", cursor: "pointer", maxWidth: 260, ml: 1 }}
            />
          </Tooltip>

          <Tooltip title="Copy invite link">
            <Chip
              label="LINK"
              size="small"
              variant="outlined"
              icon={<LinkIcon sx={{ fontSize: "0.85rem !important" }} />}
              onClick={() => {
                if (!roomId) return;
                const url = `${window.location.origin}/room/${roomId}`;
                navigator.clipboard.writeText(url).then(
                  () => setToast({ message: "Invite link copied", severity: "success" }),
                  () => setToast({ message: "Copy failed", severity: "warning" }),
                );
              }}
              sx={{ fontFamily: "monospace", cursor: "pointer", letterSpacing: "0.1em", fontWeight: 700 }}
            />
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <ExecQuotaChip />

          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mr: 1 }}>
            <FiberManualRecordIcon
              sx={{
                fontSize: "0.7rem",
                color: status === "ready" ? "success.main" : status === "error" ? "error.main" : "primary.main",
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              {status === "ready" ? `${participants.length} online` : status}
            </Typography>
          </Stack>

          <Button
            variant="outlined"
            size="small"
            startIcon={<ExitToAppIcon />}
            onClick={() => navigate("/")}
          >
            Exit
          </Button>
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, p: { xs: 1.5, md: 2.5 }, maxWidth: 1600, mx: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr minmax(300px, 340px)" },
          gap: 2,
          alignItems: "start",
        }}>
          {/* Stage */}
          <Paper
            variant="outlined"
            sx={{
              height: { xs: "75vh", md: "85vh" },
              minHeight: 400,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              bgcolor: "background.paper",
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, val: RoomTab) => setActiveTab(val)}
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                px: 1,
                minHeight: 44,
                "& .MuiTab-root": {
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  minHeight: 44,
                },
                "& .Mui-selected": {
                  color: "primary.main",
                },
              }}
            >
              <Tab label="Code" value="code" />
              <Tab label="Notes" value="notes" />
              <Tab label="Whiteboard" value="whiteboard" />
            </Tabs>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "#000" }}>
              {room ? (
                activeTab === "code" ? (
                  <CodeWorkbench
                    value={room.documents?.code ?? ""}
                    language={room.documents?.language ?? "cpp"}
                    input={room.documents?.input ?? ""}
                    output={room.documents?.output ?? ""}
                    readOnly={!hasJoined}
                    roomId={hasJoined ? roomId : undefined}
                    userName={displayName || "Guest"}
                    userColor={userColor}
                    onChange={(next) => {
                      if (!roomId || !isSocketReady || !room?.documents) return;
                      const currentLang = room.documents.language;
                      setRoom((current) => {
                        if (!current) return current;
                        return { ...current, documents: { ...current.documents, code: next, codes: { ...current.documents.codes, [currentLang]: next } } };
                      });
                      if (codeDebounce.current) clearTimeout(codeDebounce.current);
                      codeDebounce.current = setTimeout(() => {
                        getSocket().emit("room:doc-change", { roomId, patch: { code: next, codes: { [currentLang]: next } } });
                      }, 300);
                    }}
                    onLanguageChange={(next) => {
                      if (!roomId || !isSocketReady || !room?.documents) return;
                      let nextCode = room.documents.codes?.[next] || "";
                      if (!nextCode) {
                        const langConfig = languages.find((l) => l.value === next);
                        if (langConfig) nextCode = langConfig.template;
                      }
                      getSocket().emit("room:doc-change", { roomId, patch: { language: next, code: nextCode, codes: { [next]: nextCode } } });
                      setRoom((current) => {
                        if (!current) return current;
                        return { ...current, documents: { ...current.documents, language: next, code: nextCode, codes: { ...current.documents.codes, [next]: nextCode } } };
                      });
                    }}
                    onInputChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      setRoom((c) => c ? { ...c, documents: { ...c.documents, input: next } } : c);
                      if (inputDebounce.current) clearTimeout(inputDebounce.current);
                      inputDebounce.current = setTimeout(() => {
                        getSocket().emit("room:doc-change", { roomId, patch: { input: next } });
                      }, 300);
                    }}
                    onOutputChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      const capped = next.length > MAX_OUTPUT_BYTES
                        ? next.slice(0, MAX_OUTPUT_BYTES) + "\n[output truncated]"
                        : next;
                      getSocket().emit("room:doc-change", { roomId, patch: { output: capped } });
                      setRoom((c) => c ? { ...c, documents: { ...c.documents, output: capped } } : c);
                    }}
                  />
                ) : activeTab === "notes" ? (
                  <Notepad
                    value={room.documents?.notes ?? ""}
                    readOnly={!hasJoined}
                    onChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      setRoom((c) => c ? { ...c, documents: { ...c.documents, notes: next } } : c);
                      if (notesDebounce.current) clearTimeout(notesDebounce.current);
                      notesDebounce.current = setTimeout(() => {
                        getSocket().emit("room:doc-change", { roomId, patch: { notes: next } });
                      }, 300);
                    }}
                  />
                ) : (
                  <Whiteboard
                    strokes={room.documents?.whiteboard ?? []}
                    readOnly={!hasJoined}
                    onStrokesChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      setRoom((c) => c ? { ...c, documents: { ...c.documents, whiteboard: next } } : c);
                      if (whiteboardDebounce.current) clearTimeout(whiteboardDebounce.current);
                      whiteboardDebounce.current = setTimeout(() => {
                        getSocket().emit("room:doc-change", { roomId, patch: { whiteboard: next } });
                      }, 150);
                    }}
                  />
                )
              ) : (
                <Box sx={{ p: 3, color: "text.secondary" }}>Loading room…</Box>
              )}
            </Box>
          </Paper>

          {/* Sidebar */}
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "background.paper" }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mb: 1.25,
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
                Participants · {participants.length}
              </Typography>
              <List dense disablePadding>
                {participants.length === 0 && (
                  <ListItem disablePadding>
                    <ListItemText secondary="Waiting for others to join…" />
                  </ListItem>
                )}
                {participants.map((p) => {
                  const isYou = p.id === localParticipantId;
                  return (
                    <ListItem key={p.id} disablePadding sx={{ py: 0.25 }}>
                      <FiberManualRecordIcon
                        sx={{ fontSize: "0.55rem", color: "success.main", mr: 1 }}
                      />
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="baseline">
                            <Typography variant="body2" fontWeight={isYou ? 700 : 400}>
                              {p.displayName}
                            </Typography>
                            {isYou && (
                              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.05em" }}>
                                you
                              </Typography>
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Paper>

            {roomId && hasJoined && <CallPanel roomId={roomId} localDisplayName={displayName} localParticipantId={localParticipantId} participants={participants} />}
            {roomId && hasJoined && <ChatPanel roomId={roomId} localParticipantId={localParticipantId} participants={participants} />}
          </Stack>
        </Box>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)} sx={{ width: "100%" }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};
