import { useState, useRef, useEffect, type FormEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LoginIcon from "@mui/icons-material/Login";
import { motion } from "framer-motion";

export interface RoomLobbyProps {
  roomId: string;
  onJoin: (username: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

const MotionCard = motion(Card);

export const RoomLobby = ({ roomId, onJoin, isLoading, error }: RoomLobbyProps) => {
  const [username, setUsername] = useState<string>(
    () => localStorage.getItem("vaartalaap:displayName") ?? ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return setValidationError("A handle is required to enter");
    if (/\s/.test(name)) return setValidationError("No spaces — use underscores or camelCase");
    if (name.length < 2) return setValidationError("At least 2 characters required");
    if (name.length > 32) return setValidationError("Maximum 32 characters");
    setValidationError(null);
    await onJoin(name);
  };

  const displayError = validationError ?? error;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <Box sx={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,99,255,0.07) 0%, transparent 65%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none",
      }} />

      <MotionCard
        variant="outlined"
        sx={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1, bgcolor: "background.paper" }}
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="overline" color="primary">Vaartalaap</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Joining session</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose your handle to enter the collaboration room.
          </Typography>

          <Chip
            label={`Room: ${roomId}`}
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start", fontFamily: "monospace" }}
          />

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              inputRef={inputRef}
              label="Your handle"
              placeholder="e.g. alice_dev"
              fullWidth
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.replace(/\s/g, ""));
                if (validationError) setValidationError(null);
              }}
              error={Boolean(displayError)}
              helperText={displayError ?? "No spaces — use underscores or camelCase."}
              disabled={isLoading}
              autoComplete="username"
              inputProps={{ spellCheck: false }}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={isLoading}
              startIcon={<LoginIcon />}
            >
              {isLoading ? "Joining…" : "Enter Room"}
            </Button>
          </Box>

          <Divider />

          <Stack direction="row" spacing={2} justifyContent="center">
            {["No account needed", "Peer-to-peer video", "30-day rooms"].map((rule) => (
              <Typography key={rule} variant="caption" color="text.secondary">
                · {rule}
              </Typography>
            ))}
          </Stack>
        </CardContent>
      </MotionCard>
    </Box>
  );
};

