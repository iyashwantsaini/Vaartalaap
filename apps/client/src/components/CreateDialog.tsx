import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { Button } from "@cred/neopop-web/lib/components";

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (displayName: string) => void;
}

const Backdrop = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(4, 4, 5, 0.85);
  backdrop-filter: blur(14px);
  display: ${({ $open }) => ($open ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 30;
  padding: 1.5rem;
`;

const rise = keyframes`
  from { opacity: 0; transform: translateY(30px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const Dialog = styled.div`
  width: min(480px, 100%);
  border-radius: 0px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 2rem;
  box-shadow: ${({ theme }) => theme.shadows.card};
  animation: ${rise} 220ms ease forwards;
`;

const Title = styled.h2`
  margin: 0 0 0.75rem;
  font-size: 1.8rem;
  letter-spacing: -0.02em;
  border-left: 4px solid ${({ theme }) => theme.colors.accent};
  padding-left: 1rem;
`;

const Description = styled.p`
  margin: 0 0 1.5rem;
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.6;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.95rem 1.15rem;
  border-radius: 0px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  color: ${({ theme }) => theme.colors.text};
  font-size: 1rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 4px 4px 0px ${({ theme }) => theme.colors.accent};
    transform: translate(-2px, -2px);
  }
`; 

const Actions = styled.div`
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`;

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
    if (!name.trim()) {
      return setError("Enter your display name");
    }
    onSubmit(name.trim());
    onClose();
  };

  return (
    <Backdrop $open={open} role="dialog" aria-modal="true">
      <Dialog>
        <Title>Create a new room</Title>
        <Description>Enter your name to start hosting a session.</Description>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your Name" />
        </div>
        {error && <Description style={{ color: "#f27272", marginTop: "0.65rem" }}>{error}</Description>}
        <Actions>
          <Button variant="secondary" kind="flat" colorMode="dark" size="medium" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" kind="elevated" colorMode="dark" size="medium" onClick={handleSubmit}>
            Create room
          </Button>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};
