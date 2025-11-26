import styled, { keyframes } from "styled-components";
import { Button } from "@cred/neopop-web/lib/components";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
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
  width: min(420px, 100%);
  border-radius: 0px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 2rem;
  box-shadow: ${({ theme }) => theme.shadows.card};
  animation: ${rise} 220ms ease forwards;
`;

const Title = styled.h2`
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
`;

const Description = styled.p`
  margin: 0 0 1.5rem;
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.6;
  font-size: 1rem;
`;

const Actions = styled.div`
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`;

export const ConfirmationDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) => {
  if (!open) return null;

  return (
    <Backdrop $open={open} role="dialog" aria-modal="true">
      <Dialog>
        <Title>{title}</Title>
        <Description>{description}</Description>
        <Actions>
          <Button variant="secondary" kind="flat" colorMode="dark" size="medium" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" kind="elevated" colorMode="dark" size="medium" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};
