import { useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (displayName: string) => void;
}

export const CreateDialog = ({ open, onClose, onSubmit }: CreateDialogProps) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setName("");
        setError(null);
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!name.trim()) return setError("Enter your display name");
    onSubmit(name.trim());
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create a new room</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>Enter your name to start hosting a session.</DialogContentText>
        <TextField
          inputRef={inputRef}
          label="Your Name"
          fullWidth
          value={name}
          onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
          error={Boolean(error)}
          helperText={error ?? " "}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          autoComplete="off"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Create room</Button>
      </DialogActions>
    </Dialog>
  );
};
