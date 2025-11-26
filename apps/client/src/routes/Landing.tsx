import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { nanoid } from "nanoid";
import { Hero } from "../components/Hero";
import { JoinDialog } from "../components/JoinDialog";
import { RoomPreview } from "../components/RoomPreview";
import { api } from "../lib/api";

const Shell = styled.main`
  min-height: 100vh;
  width: 100%;
  padding: clamp(1.5rem, 4vw, 4rem);
  background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), transparent 45%),
    radial-gradient(circle at 80% 0%, rgba(167, 149, 255, 0.15), transparent 40%),
    #040405;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const Grid = styled.div`
  position: relative;
  width: min(1200px, 100%);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: clamp(2rem, 3vw, 3.5rem);
  z-index: 2;
`;

const AccentColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InsightPanel = styled.section`
  padding: 1.75rem;
  border-radius: 0px;
  background: rgba(9, 9, 10, 0.85);
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: grid;
  gap: 1.1rem;
`;

const InsightTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
  border-left: 3px solid ${({ theme }) => theme.colors.accent};
  padding-left: 0.75rem;
`;

const InsightDescriptor = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text};
  font-size: 1.2rem;
  line-height: 1.6;
`;

const AccentList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const AccentChip = styled.li`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.95rem;
  &:before {
    content: "";
    width: 0; 
    height: 0; 
    border-left: 6px solid ${({ theme }) => theme.colors.accent};
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }
`;

const ActiveRoomChip = styled.div`
  align-self: flex-start;
  padding: 0.55rem 1rem;
  border-radius: 0px;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.surface};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
  box-shadow: 4px 4px 0px ${({ theme }) => theme.colors.accent};
`;

const Toast = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 0px;
  background: #000;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.95rem;
  box-shadow: 8px 8px 0px ${({ theme }) => theme.colors.accent};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: translateY(${({ $visible }) => ($visible ? "0" : "15px")});
  transition: opacity 180ms ease, transform 180ms ease;
  pointer-events: none;
`;

const Glow = styled.div`
  position: absolute;
  inset: auto -20% 10% auto;
  width: 420px;
  height: 420px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15), transparent 70%);
  filter: blur(60px);
  opacity: 0.5;
  pointer-events: none;
`;

export const LandingRoute = () => {
  const navigate = useNavigate();
  const [isJoinOpen, setJoinOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"join" | "create">("join");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const pushToast = (message: string) => {
    setToastMessage(message);
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimer.current = null;
    }, 3600);
  };

  const handleCreateClick = () => {
    setDialogMode("create");
    setJoinOpen(true);
  };

  const handleJoinClick = () => {
    setDialogMode("join");
    setJoinOpen(true);
  };

  const handleDialogSubmit = async (roomCode: string, displayName: string) => {
    if (dialogMode === "create") {
      try {
        setIsCreating(true);
        const snapshot = await api.createRoom(displayName);
        setLastRoomCode(snapshot.roomId);
        await navigator.clipboard?.writeText(snapshot.roomId).catch(() => undefined);
        
        if (displayName) {
          localStorage.setItem("vaartalaap:displayName", displayName);
        }

        // The host is the first participant
        const hostParticipant = snapshot.participants[0];

        pushToast(`Room minted • ${snapshot.roomId}`);
        navigate(`/room/${snapshot.roomId}`, { 
          state: { 
            joined: true, 
            participantId: hostParticipant?.id,
            displayName: displayName
          } 
        });
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Unable to create room");
      } finally {
        setIsCreating(false);
      }
    } else {
      try {
        setIsJoining(true);
        const participantId = nanoid();
        const snapshot = await api.joinRoom(roomCode, displayName, participantId);
        setLastRoomCode(snapshot.roomId);
        
        if (displayName) {
          localStorage.setItem("vaartalaap:displayName", displayName);
        }

        pushToast(`Room ready • ${snapshot.roomId}`);
        navigate(`/room/${snapshot.roomId}`, { 
          state: { 
            joined: true, 
            participantId: participantId,
            displayName: displayName
          } 
        });
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Room lookup failed");
      } finally {
        setIsJoining(false);
      }
    }
  };

  return (
    <Shell>
      <Glow />
      <Grid>
        <div>
          <Hero
            onCreateRoom={handleCreateClick}
            onJoinRoom={handleJoinClick}
            isCreating={isCreating}
            isJoining={isJoining}
          />
          {lastRoomCode && <ActiveRoomChip>Active code · {lastRoomCode}</ActiveRoomChip>}
        </div>
        <AccentColumn>
          <RoomPreview />

        </AccentColumn>
      </Grid>
      <JoinDialog 
        open={isJoinOpen} 
        mode={dialogMode}
        onClose={() => setJoinOpen(false)} 
        onSubmit={handleDialogSubmit} 
      />
      <Toast $visible={Boolean(toastMessage)} aria-live="polite">
        {toastMessage ?? ""}
      </Toast>
    </Shell>
  );
};
