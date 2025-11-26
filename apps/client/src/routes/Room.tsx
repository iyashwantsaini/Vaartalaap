import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styled from "styled-components";
import { nanoid } from "nanoid";
import { Button } from "@cred/neopop-web/lib/components";
import type { RoomSnapshot } from "@vaartalaap/shared";
import { api } from "../lib/api";
import { getSocket, disconnectSocket } from "../lib/socket";
import { languages } from "../lib/languages";
import { CodeWorkbench } from "../components/CodeWorkbench";
import { Whiteboard } from "../components/Whiteboard";
import { CallPanel } from "../components/CallPanel";
import { Notepad } from "../components/Notepad";

const Canvas = styled.main`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  padding: clamp(1.25rem, 3vw, 2.5rem);
  color: ${({ theme }) => theme.colors.text};
`;

const RoomShell = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
`;

const Header = styled.header`
  display: flex;
  height: 72px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid ${({ theme }) => theme.colors.border};
  margin: 0 -clamp(1.25rem, 3vw, 2.5rem);
  padding: 0 clamp(1.25rem, 3vw, 2.5rem);
  background: ${({ theme }) => theme.colors.surface};
  margin-bottom: 1rem;
  flex-wrap: wrap;
  box-shadow: ${({ theme }) => theme.shadows.elevated};

  @media (max-width: 768px) {
    height: auto;
    padding: 0.75rem 1rem;
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: 0;
  flex: 1;
  margin-right: 1rem;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
    margin-right: 0;
  }
`;

const LogoButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.heading};
  font-weight: 800;
  font-size: 1.25rem;
  cursor: pointer;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: opacity 0.2s;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const RoomIdContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  min-width: 0;
  flex: 1;

  & > span {
    flex-shrink: 0;
    @media (max-width: 1024px) {
      display: none;
    }
  }
`;

const RoomIdChip = styled.button`
  background: ${({ theme }) => theme.colors.surfaceMuted};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 0px;
  padding: 0.35rem 0.75rem;
  color: ${({ theme }) => theme.colors.text};
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  overflow: hidden;
  max-width: 100%;
  min-width: 0;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: 2px 2px 0px ${({ theme }) => theme.colors.accent};
    transform: translate(-1px, -1px);
  }

  svg {
    opacity: 0.5;
    flex-shrink: 0;
  }

  &:hover svg {
    opacity: 1;
  }
  
  /* Truncate text inside */
  white-space: nowrap;
  text-overflow: ellipsis;
  
  @media (max-width: 768px) {
    max-width: 160px;
    font-size: 0.75rem;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    padding-top: 0.75rem;
  }
`;

const StatusIndicator = styled.div<{ $status: "loading" | "ready" | "error" }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $status, theme }) => 
      $status === "ready" ? theme.colors.success : 
      $status === "error" ? "#ff5d78" : 
      theme.colors.accent};
    box-shadow: 0 0 8px ${({ $status, theme }) => 
      $status === "ready" ? theme.colors.success : 
      $status === "error" ? "#ff5d78" : 
      theme.colors.accent};
  }
`;

const ContentGrid = styled.section`
  display: grid;
  grid-template-columns: 1fr minmax(320px, 360px);
  gap: clamp(1.25rem, 3vw, 2rem);
  align-items: start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Panel = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.75rem;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  font-weight: 800;
  border-bottom: 2px solid ${({ theme }) => theme.colors.accent};
  padding-bottom: 0.5rem;
  display: inline-block;
  align-self: flex-start;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const Label = styled.label`
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 600;
`;

const Input = styled.input`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  color: ${({ theme }) => theme.colors.text};
  padding: 0.85rem 1rem;
  font-size: 1rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 4px 4px 0px ${({ theme }) => theme.colors.accent};
    transform: translate(-2px, -2px);
  }
`;

const ParticipantList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
`;

const Participant = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.95rem;
`;

const ParticipantRole = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: #333;
  padding: 2px 6px;
`;

const Stage = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  padding: clamp(1.5rem, 3vw, 2.5rem);
  height: 85vh;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: ${({ theme }) => theme.shadows.card};
  min-width: 0;

  @media (max-width: 768px) {
    min-height: 400px;
    height: 75vh;
    padding: 1rem;
    gap: 1rem;
  }
`;

const TabStrip = styled.div`
  display: flex;
  gap: 0.5rem;
  
  @media (max-width: 768px) {
    gap: 0.25rem;
  }
`;

const StageTab = styled.button`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 0.85rem 1rem;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: 600;

  @media (max-width: 768px) {
    padding: 0.6rem 0.25rem;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  &[data-active="true"] {
    border: 1px solid ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.accent};
    color: #000;
    font-weight: 800;
    box-shadow: 4px 4px 0px #fff;
    transform: translate(-2px, -2px);
  }
  
  &:hover:not([data-active="true"]) {
    border-color: ${({ theme }) => theme.colors.text};
    color: ${({ theme }) => theme.colors.text};
    background: rgba(255, 255, 255, 0.05);
  }
`;

const StageBody = styled.div`
  flex: 1;
  background: #000;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.95rem;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
`;

const ErrorState = styled.div`
  padding: 1.5rem;
  border: 2px solid #ff5d78;
  background: rgba(255, 93, 120, 0.1);
  color: #ff5d78;
  font-size: 0.95rem;
  box-shadow: 4px 4px 0px #ff5d78;
`;

const JoinSessionWrapper = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 0.5rem;
`;

const JoinSessionButton = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.accent};
  color: #000;
  padding: 0.85rem 1rem;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 800;
  box-shadow: 4px 4px 0px #fff;
  transform: translate(-2px, -2px);

  &:hover {
    background: #fff;
    border-color: #fff;
    box-shadow: 4px 4px 0px ${({ theme }) => theme.colors.accent};
  }

  &:active {
    transform: translate(0, 0);
    box-shadow: none;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const JoinedName = styled.div`
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
`;

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

export const RoomRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams<{ roomId: string }>();
  const state = location.state as { joined?: boolean; participantId?: string; displayName?: string } | null;
  
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>(() => {
    if (state?.displayName) return state.displayName;
    return `Guest ${Math.floor(Math.random() * 10000)}`;
  });
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(state?.joined ?? false);
  const [localParticipantId, setLocalParticipantId] = useState<string | undefined>(state?.participantId);
  const [isSocketReady, setIsSocketReady] = useState(false);

  // Clear history state on mount so that a refresh treats the user as new
  useEffect(() => {
    if (state?.joined) {
      window.history.replaceState({}, "");
    }
  }, []);

  // Attach socket.io for realtime updates
  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();

    const joinPayload = { roomId, participantId: localParticipantId };

    const handleConnect = () => {
      // client log for debugging socket join
      console.log("[socket] connect, joining room", joinPayload);
      socket.emit("room:join", joinPayload);
      setIsSocketReady(true);
    };

    const handleDocumentsUpdated = (payload: { roomId: string; documents?: RoomSnapshot["documents"] }) => {
      if (!payload || !payload.documents) {
        console.warn("[socket] room:documents-updated with no documents payload", payload);
        return;
      }

      const nextDocuments = payload.documents;

      console.log("[socket] room:documents-updated", payload.roomId, {
        hasCode: Boolean(nextDocuments.code),
        hasNotes: Boolean(nextDocuments.notes),
        strokes: nextDocuments.whiteboard?.length ?? 0,
      });

      setRoom((current) => {
        if (!current || current.roomId !== payload.roomId) return current;
        return { ...current, documents: nextDocuments };
      });
    };

    const handleParticipantsUpdated = (participants: RoomSnapshot["participants"]) => {
      setRoom((current) => {
        if (!current) return current;
        return { ...current, participants };
      });
    };

    socket.on("connect", handleConnect);
    socket.on("room:documents-updated", handleDocumentsUpdated);
    socket.on("room:participants-update", handleParticipantsUpdated);

    // Always attempt join once when effect runs, even if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room:documents-updated", handleDocumentsUpdated);
      socket.off("room:participants-update", handleParticipantsUpdated);
      setIsSocketReady(false);
      disconnectSocket();
    };
  }, [roomId, localParticipantId]);

  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      try {
        setStatus("loading");
        const snapshot = await api.fetchRoom(roomId);
        setRoom(snapshot);
        setStatus("ready");
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load room");
        setStatus("error");
      }
    };
    void load();
  }, [roomId]);

  const handleJoin = async () => {
    if (!roomId) return;
    try {
      setIsJoining(true);
      const newParticipantId = nanoid();
      const snapshot = await api.joinRoom(roomId, displayName || undefined, newParticipantId);
      setRoom(snapshot);
      if (displayName.trim()) {
        localStorage.setItem("vaartalaap:displayName", displayName.trim());
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

  return (
    <Canvas>
      <RoomShell>
        <Header>
          <HeaderLeft>
            <LogoButton onClick={() => navigate("/")}>
              VAARTALAAP
            </LogoButton>
            <Divider />
            <RoomIdContainer>
              <span>Room ID</span>
              <RoomIdChip
                onClick={() => {
                  if (roomId) navigator.clipboard.writeText(roomId);
                }}
                title="Copy Room ID"
              >
                {roomId}
                <CopyIcon />
              </RoomIdChip>
            </RoomIdContainer>
          </HeaderLeft>
          
          <HeaderRight>
            <StatusIndicator $status={status}>
              {status === "ready" ? `${participants.length} Active` : status}
            </StatusIndicator>
            <Button
              variant="secondary"
              kind="flat"
              size="small"
              colorMode="dark"
              onClick={() => navigate("/")}
            >
              Exit
            </Button>
          </HeaderRight>
        </Header>

        {status === "error" && error ? <ErrorState>{error}</ErrorState> : null}

        <ContentGrid>
          <Stage>
            <TabStrip>
              {(["code", "notes", "whiteboard"] as const).map((tabKey) => (
                <StageTab
                  key={tabKey}
                  data-active={room?.activeTab === tabKey ? "true" : "false"}
                  onClick={() => {
                    if (!roomId || !room || room.activeTab === tabKey) return;
                    
                    // Allow local tab switching for guests
                    setRoom({ ...room, activeTab: tabKey });

                    // Only emit change if joined
                    if (isSocketReady && hasJoined) {
                      const socket = getSocket();
                      socket.emit("room:tab-change", { roomId, tab: tabKey });
                    }
                  }}
                >
                  {tabKey === "code" ? "Code" : tabKey === "notes" ? "Notes" : "Whiteboard"}
                </StageTab>
              ))}
            </TabStrip>
            <StageBody>
              {room ? (
                room.activeTab === "code" ? (
                  <CodeWorkbench
                    value={room.documents?.code ?? ""}
                    language={room.documents?.language ?? "cpp"}
                    input={room.documents?.input ?? ""}
                    output={room.documents?.output ?? ""}
                    readOnly={!hasJoined}
                    onChange={(next) => {
                      if (!roomId || !isSocketReady || !room?.documents) return;
                      const socket = getSocket();
                      const currentLang = room.documents.language;
                      
                      console.log("[socket] emit room:doc-change code", roomId);
                      socket.emit("room:doc-change", {
                        roomId,
                        patch: { 
                          code: next,
                          codes: { [currentLang]: next }
                        },
                      });
                      setRoom((current) => {
                        if (!current) return current;
                        return {
                          ...current,
                          documents: {
                            ...current.documents,
                            code: next,
                            codes: {
                              ...current.documents.codes,
                              [currentLang]: next,
                            },
                          },
                        };
                      });
                    }}
                    onLanguageChange={(next) => {
                      if (!roomId || !isSocketReady || !room?.documents) return;
                      
                      const nextLang = next;
                      let nextCode = room.documents.codes?.[nextLang] || "";
                      
                      if (!nextCode) {
                          const langConfig = languages.find(l => l.value === nextLang);
                          if (langConfig) nextCode = langConfig.template;
                      }

                      const socket = getSocket();
                      console.log("[socket] emit room:doc-change language", roomId, next);
                      socket.emit("room:doc-change", {
                        roomId,
                        patch: { 
                            language: nextLang,
                            code: nextCode,
                            codes: { [nextLang]: nextCode }
                        },
                      });
                      setRoom((current) => {
                        if (!current) return current;
                        return { 
                            ...current, 
                            documents: { 
                                ...current.documents, 
                                language: nextLang,
                                code: nextCode,
                                codes: {
                                    ...current.documents.codes,
                                    [nextLang]: nextCode
                                }
                            } 
                        };
                      });
                    }}
                    onInputChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      const socket = getSocket();
                      console.log("[socket] emit room:doc-change input", roomId);
                      socket.emit("room:doc-change", {
                        roomId,
                        patch: { input: next },
                      });
                      setRoom((current) =>
                        current ? { ...current, documents: { ...current.documents, input: next } } : current,
                      );
                    }}
                    onOutputChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      const socket = getSocket();
                      console.log("[socket] emit room:doc-change output", roomId);
                      socket.emit("room:doc-change", {
                        roomId,
                        patch: { output: next },
                      });
                      setRoom((current) =>
                        current ? { ...current, documents: { ...current.documents, output: next } } : current,
                      );
                    }}
                  />
                ) : room.activeTab === "notes" ? (
                  <Notepad
                    value={room.documents?.notes ?? ""}
                    readOnly={!hasJoined}
                    onChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      const socket = getSocket();
                      console.log("[socket] emit room:doc-change notes", roomId);
                      socket.emit("room:doc-change", {
                        roomId,
                        patch: { notes: next },
                      });
                      setRoom((current) =>
                        current ? { ...current, documents: { ...current.documents, notes: next } } : current,
                      );
                    }}
                  />
                ) : (
                  <Whiteboard
                    strokes={room.documents?.whiteboard ?? []}
                    readOnly={!hasJoined}
                    onStrokesChange={(next) => {
                      if (!roomId || !isSocketReady) return;
                      const socket = getSocket();
                      console.log("[socket] emit room:doc-change whiteboard", roomId, "strokes", next.length);
                      socket.emit("room:doc-change", {
                        roomId,
                        patch: { whiteboard: next },
                      });
                      setRoom((current) =>
                        current ? { ...current, documents: { ...current.documents, whiteboard: next } } : current,
                      );
                    }}
                  />
                )
              ) : (
                <p>Loading room telemetry...</p>
              )}
            </StageBody>
          </Stage>

          <Sidebar>
            <Panel>
              <PanelTitle>Identity</PanelTitle>
              {!hasJoined ? (
                <>
                  <Field>
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="e.g. PRINCIPAL CANDIDATE"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </Field>
                  <JoinSessionWrapper>
                    <JoinSessionButton
                      onClick={handleJoin}
                      disabled={isJoining || !roomId}
                    >
                      {isJoining ? "Joining room..." : "Join session"}
                    </JoinSessionButton>
                  </JoinSessionWrapper>
                </>
              ) : (
                <Field>
                  <Label>Joined as</Label>
                  <JoinedName>
                    {displayName || "Guest"}
                  </JoinedName>
                </Field>
              )}
            </Panel>

            <Panel>
              <PanelTitle>Participants</PanelTitle>
              <ParticipantList>
                {participants.length === 0 && <Participant>Room is empty</Participant>}
                {participants.map((participant) => (
                  <Participant key={participant.id}>
                    <span>{participant.displayName}</span>
                  </Participant>
                ))}
              </ParticipantList>
            </Panel>

            {roomId && hasJoined && <CallPanel roomId={roomId} />}
          </Sidebar>
        </ContentGrid>
      </RoomShell>
    </Canvas>
  );
};
