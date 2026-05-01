import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import CodeIcon from "@mui/icons-material/Code";
import VideocamIcon from "@mui/icons-material/Videocam";
import BrushIcon from "@mui/icons-material/Brush";
import LockIcon from "@mui/icons-material/Lock";
import GroupIcon from "@mui/icons-material/Group";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import LoginIcon from "@mui/icons-material/Login";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { ColorModeToggle } from "../components/ColorModeToggle";

const MotionTypography = motion(Typography);
const MotionStack = motion(Stack);

const FEATURES = [
  { icon: <CodeIcon fontSize="small" />, label: "Multi-language editor" },
  { icon: <VideocamIcon fontSize="small" />, label: "Mesh video calls" },
  { icon: <BrushIcon fontSize="small" />, label: "Collaborative whiteboard" },
  { icon: <GroupIcon fontSize="small" />, label: "No account needed" },
  { icon: <LockIcon fontSize="small" />, label: "30-day auto-expiry" },
];

export const LandingRoute = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [isWaking, setIsWaking] = useState(false);

  // Pre-warm the API on mount so the user's first interaction is snappy.
  // If the ping takes >3s, surface a banner so they know we're waking the
  // free-tier dyno (cold-start is ~30-50s on Render free).
  useEffect(() => {
    let cancelled = false;
    const wakeTimer = window.setTimeout(() => {
      if (!cancelled) setIsWaking(true);
    }, 3000);
    api
      .pingHealth()
      .catch(() => {
        /* swallow — real errors will surface on the user's first action */
      })
      .finally(() => {
        window.clearTimeout(wakeTimer);
        if (!cancelled) setIsWaking(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(wakeTimer);
    };
  }, []);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const room = await api.createRoom();
      navigate(`/room/${room.roomId}`);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Failed to create room");
      setIsCreating(false);
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim();
    if (!code) { setJoinError("Enter a room code to join"); return; }
    navigate(`/room/${code}`);
  };

  const handleJoinCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setJoinCode(e.target.value);
    if (joinError) setJoinError(null);
  };

  const handleJoinKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default", position: "relative", overflow: "hidden" }}>
      {/* Background glow orbs */}
      <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <Box sx={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,99,255,0.1) 0%, transparent 70%)", top: -200, left: -200 }} />
        <Box sx={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,158,255,0.07) 0%, transparent 70%)", bottom: -100, right: -100 }} />
      </Box>

      {/* Nav */}
      <AppBar position="static" elevation={0} sx={{ zIndex: 1 }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: "0.2em", fontSize: "1rem" }}>
            VAARTALAAP
          </Typography>
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      {/* Hero */}
      <Container
        maxWidth="md"
        sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: { xs: 6, md: 10 }, position: "relative", zIndex: 1, textAlign: "center" }}
      >
        <Collapse in={isWaking} sx={{ width: "100%", maxWidth: 520, mb: 3 }}>
          <Alert severity="info" variant="outlined">
            Waking up the server… first request may take ~30 s on free tier.
          </Alert>
        </Collapse>

        <Typography variant="overline" color="primary" sx={{ mb: 2 }}>
          Interview &amp; learning platform
        </Typography>

        <MotionTypography
          variant="h1"
          sx={{
            fontSize: { xs: "3rem", md: "5.5rem", lg: "7rem" },
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            mb: 3,
            "& span": {
              background: "linear-gradient(135deg, #4f63ff 0%, #8b9eff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            },
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Code together.<br /><span>Learn together.</span>
        </MotionTypography>

        <MotionTypography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 520, lineHeight: 1.7, mb: 5, fontSize: "1.1rem" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          A live workspace for DSA, system design, and mock interviews —
          shared code editor, whiteboard, notes, and mesh video calls in one
          room. No account required.
        </MotionTypography>

        <MotionStack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ width: "100%", maxWidth: 700 }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          {/* Create card */}
          <MuiCard variant="outlined" sx={{ flex: 1, bgcolor: "background.paper", transition: "border-color 0.2s, transform 0.2s", "&:hover": { borderColor: "primary.main", transform: "translateY(-3px)" } }}>
            <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography variant="overline" color="primary">New session</Typography>
              <Typography variant="h5">Create a Room</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Generate a shareable room link instantly. Set your handle on the next screen.
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<MeetingRoomIcon />}
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? "Spinning up…" : "Create Room"}
              </Button>
            </CardContent>
          </MuiCard>

          {/* Join card */}
          <MuiCard variant="outlined" sx={{ flex: 1, bgcolor: "background.paper", transition: "border-color 0.2s, transform 0.2s", "&:hover": { borderColor: "primary.main", transform: "translateY(-3px)" } }}>
            <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography variant="overline" color="primary">Enter existing</Typography>
              <Typography variant="h5">Join a Room</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Have a room code? Paste it below and drop straight in.
              </Typography>
              <TextField
                fullWidth
                size="medium"
                placeholder="Room ID or code"
                value={joinCode}
                onChange={handleJoinCodeChange}
                onKeyDown={handleJoinKeyDown}
                error={Boolean(joinError)}
                helperText={joinError ?? " "}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button variant="contained" size="small" onClick={handleJoin} startIcon={<LoginIcon />}>
                          Join
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </CardContent>
          </MuiCard>
        </MotionStack>
      </Container>

      {/* Feature bar */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", py: 1.5, position: "relative", zIndex: 1 }}>
        <Stack direction="row" sx={{ justifyContent: "center", flexWrap: "wrap" }} divider={<Divider orientation="vertical" flexItem />}>
          {FEATURES.map(({ icon, label }) => (
            <Stack key={label} direction="row" spacing={0.75} sx={{ alignItems: "center", px: 2.5, py: 0.75, color: "text.secondary" }}>
              <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
              <Typography variant="caption" sx={{ fontSize: "0.78rem" }}>{label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};


