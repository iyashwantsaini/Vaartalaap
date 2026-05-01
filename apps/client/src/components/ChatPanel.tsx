import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/Send";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { getSocket } from "../lib/socket";

interface ChatMessage {
  id: string;
  from: string; // participantId
  text: string;
  at: number;
}

interface ChatPanelProps {
  roomId: string;
  localParticipantId?: string;
  participants: { id: string; displayName: string }[];
  fullHeight?: boolean;
}

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const ChatPanel = ({ roomId, localParticipantId, participants, fullHeight = false }: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("room:chat-message", handler);
    return () => {
      socket.off("room:chat-message", handler);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    getSocket().emit("room:chat-message", { roomId, text });
    setDraft("");
  };

  const nameFor = (pid: string) =>
    participants.find((p) => p.id === pid)?.displayName ?? "Anonymous";

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        ...(fullHeight
          ? { flex: 1, minHeight: 0, height: "100%" }
          : { maxHeight: 320 }),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
        <ForumOutlinedIcon fontSize="small" color="primary" />
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}
        >
          Room chat
        </Typography>
      </Stack>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2,
          py: 1.5,
          minHeight: 120,
          ...(fullHeight ? {} : { maxHeight: 220 }),
        }}
      >
        {messages.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No messages yet. Say hi to your peers.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {messages.map((m) => {
              const isYou = m.from === localParticipantId;
              return (
                <Box key={m.id}>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="caption" sx={{ fontWeight: 700, color: isYou ? "primary.main" : "text.primary" }}>
                      {isYou ? "You" : nameFor(m.from)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      {formatTime(m.at)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ wordBreak: "break-word", mt: 0.25 }}>
                    {m.text}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ p: 1, borderTop: 1, borderColor: "divider" }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Send a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <IconButton color="primary" onClick={send} disabled={!draft.trim()}>
          <SendIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
};
