import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { Button } from "@cred/neopop-web/lib/components";
import { getSocket } from "../lib/socket";

const Panel = styled.div`
  margin-top: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: #000;
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Title = styled.div`
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 800;
`;

const TitleControls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const MaximizeButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    opacity: 0.8;
  }
`;

const VideoRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
`;

const VideoShell = styled.div`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.text};
  background: #202124;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  width: 100%;
  max-width: 80vh;
  margin: 0 auto;
  
  &:hover .video-overlay {
    opacity: 1;
  }
`;

const Video = styled.video<{ $mirrored?: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: ${({ $mirrored }) => ($mirrored ? "scaleX(-1)" : "none")};
`;

const VideoOverlay = styled.div`
  position: absolute;
  bottom: 0.5rem;
  left: 0;
  width: 100%;
  padding: 0.25rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  z-index: 10;
  flex-wrap: wrap;
`;

const Status = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ExpandedOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  padding: 2rem;
`;

const ExpandedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  color: #fff;
`;

const ExpandedGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  flex: 1;
  overflow-y: auto;
  align-content: center;
  padding: 1rem;
`;

interface CallPanelProps {
  roomId: string;
}

const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const VideoStream = ({ 
  stream, 
  isLocal = false, 
  mirrored = false,
  muted = false,
  children 
}: { 
  stream: MediaStream | null;
  isLocal?: boolean;
  mirrored?: boolean;
  muted?: boolean;
  children?: React.ReactNode;
}) => {
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && stream) {
      node.srcObject = stream;
      // Only try to play if paused to avoid interruption errors
      if (node.paused) {
        node.play().catch(e => console.warn("[webrtc] play failed", e));
      }
    }
  }, [stream]);
  
  return (
    <VideoShell>
      <Video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={isLocal || muted} 
        $mirrored={mirrored} 
      />
      {children}
    </VideoShell>
  );
};

// Icons
const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
);
const SpeakerOffIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
);
const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
);
const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02 5.02L19.06 20.1l1.27-1.27L2.97 1.5 1.7 2.77l3.36 3.36C4.2 7.6 3.69 9.24 3.69 11h1.7c0-1.3.4-2.5 1.08-3.48l2.52 2.52V11c0 1.66 1.34 3 3 3 .1 0 .2-.01.29-.02l2.74 2.74zM12 14c-1.66 0-3-1.34-3-3V6.48l4.43 4.43c-.14 1.73-1.59 3.09-3.43 3.09zm7.04-9.11l-1.27-1.27-2.49 2.49c-.5-.2-1.05-.31-1.62-.31-2.48 0-4.5 2.02-4.5 4.5V11l2.49 2.49V6.8c0-1.1.9-2 2-2s2 .9 2 2v1.17l3.39 3.39V4.89z"/></svg>
);
const CamIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
);
const CamOffIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
);
const PhoneIcon = styled.svg`
  transform: rotate(135deg);
  width: 20px;
  height: 20px;
  fill: currentColor;
`;

const MaximizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PhoneIconPath = () => (
  <PhoneIcon viewBox="0 0 24 24">
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
  </PhoneIcon>
);

const JoinWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  width: 100%;
`;

const JoinButton = styled.button`
  background: ${({ theme }) => theme.colors.accent};
  color: #ffffff;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 800;
  font-family: ${({ theme }) => theme.fonts.mono};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  border-radius: 0px;
  transition: all 0.2s;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    background: #ffffff;
    border-color: #ffffff;
    color: #000000;
    box-shadow: 4px 4px 0px #ffffff;
    transform: translate(-2px, -2px);
  }

  &:active {
    transform: translate(0, 0);
    box-shadow: none;
  }
`;

const LeaveButton = styled.button`
  background: ${({ theme }) => theme.colors.error};
  color: #ffffff;
  border: 1px solid ${({ theme }) => theme.colors.error};
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 0px;
  transition: all 0.2s;

  &:hover {
    background: #ff5252;
    border-color: #ff5252;
    box-shadow: 2px 2px 0px #ffffff;
    transform: translate(-1px, -1px);
  }

  &:active {
    transform: translate(0, 0);
    box-shadow: none;
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const ControlButton = styled.button<{ $active?: boolean }>`
  background: ${({ theme, $active }) => $active ? theme.colors.surface : theme.colors.surfaceMuted};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.text};
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 0px;
  transition: all 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.text};
    color: ${({ theme }) => theme.colors.surface};
    box-shadow: 2px 2px 0px ${({ theme }) => theme.colors.highlight};
    transform: translate(-1px, -1px);
  }

  &:active {
    transform: translate(0, 0);
    box-shadow: none;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

export const CallPanel = ({ roomId }: CallPanelProps) => {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const socket = getSocket();

  const addRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => {
      const existing = prev.find((p) => p.peerId === peerId);
      if (existing) {
        // If we already have this stream, don't update state to avoid re-renders/reloads
        if (existing.stream.id === stream.id) return prev;
        
        // If it's a new stream for the same peer, update it
        return prev.map(p => p.peerId === peerId ? { peerId, stream } : p);
      }
      return [...prev, { peerId, stream }];
    });
  }, []);

  const removeRemoteStream = useCallback((peerId: string) => {
    setRemoteStreams((prev) => prev.filter((p) => p.peerId !== peerId));
  }, []);

  const createPeer = useCallback((peerId: string, initiator: boolean, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers });
    peersRef.current.set(peerId, pc);

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("room:rtc-ice", {
          roomId,
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        console.log(`[webrtc] received remote stream from ${peerId}`, remoteStream.id);
        addRemoteStream(peerId, remoteStream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[webrtc] ice state for ${peerId}: ${pc.iceConnectionState}`);
    };

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit("room:rtc-offer", {
            roomId,
            to: peerId,
            sdp: pc.localDescription,
          });
        })
        .catch((err) => console.error("Error creating offer", err));
    }

    return pc;
  }, [roomId, socket, addRemoteStream]);

  const handleUserJoined = useCallback(async ({ socketId }: { socketId: string }) => {
    if (!localStreamRef.current) return;
    console.log("[webrtc] user joined call", socketId);
    
    if (peersRef.current.has(socketId)) {
      const pc = peersRef.current.get(socketId);
      if (pc && pc.connectionState !== "closed" && pc.connectionState !== "failed") {
        console.warn(`[webrtc] peer ${socketId} already exists and is active, ignoring join event`);
        return;
      }
      // If peer exists but is closed/failed, clean it up before creating new one
      pc?.close();
      peersRef.current.delete(socketId);
      removeRemoteStream(socketId);
    }

    createPeer(socketId, true, localStreamRef.current);
  }, [createPeer, removeRemoteStream]);

  const handleOffer = useCallback(async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
    if (!localStreamRef.current) return;
    console.log("[webrtc] handleOffer", from);
    
    let pc = peersRef.current.get(from);
    if (!pc) {
      pc = createPeer(from, false, localStreamRef.current);
    }

    try {
      // If we are already stable and receive an offer, it's a renegotiation.
      // If we are in have-local-offer, it's a glare.
      
      const isStable = pc.signalingState === "stable" || pc.signalingState === "have-remote-offer";
      
      // Glare detection
      if (!isStable && pc.signalingState === "have-local-offer") {
        const socketId = socket.id;
        const isPolite = socketId ? socketId < from : true;

        if (!isPolite) {
          console.warn(`[webrtc] Glare detected with ${from}, I am impolite (ignoring offer)`);
          return;
        }

        console.log(`[webrtc] Glare detected with ${from}, I am polite (rolling back and accepting)`);
        await pc.setLocalDescription({ type: "rollback" });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("room:rtc-answer", {
        roomId,
        to: from,
        sdp: answer,
      });
    } catch (err) {
      console.error("Error handling offer", err);
    }
  }, [roomId, socket, createPeer]);

  const handleAnswer = useCallback(async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
    console.log("[webrtc] handleAnswer", from);
    const pc = peersRef.current.get(from);
    if (pc) {
      try {
        if (pc.signalingState === "stable") {
          console.warn(`[webrtc] received answer while stable for ${from}, ignoring`);
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Error handling answer", err);
      }
    }
  }, []);

  const handleIce = useCallback(async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
    const pc = peersRef.current.get(from);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error handling ice", err);
      }
    }
  }, []);

  const handleUserLeft = useCallback(({ socketId }: { socketId: string }) => {
    console.log("[webrtc] user left call", socketId);
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
    }
    removeRemoteStream(socketId);
  }, [removeRemoteStream]);

  useEffect(() => {
    socket.on("room:call-user-joined", handleUserJoined);
    socket.on("room:call-user-left", handleUserLeft);
    socket.on("room:rtc-offer", handleOffer);
    socket.on("room:rtc-answer", handleAnswer);
    socket.on("room:rtc-ice", handleIce);

    return () => {
      socket.off("room:call-user-joined", handleUserJoined);
      socket.off("room:call-user-left", handleUserLeft);
      socket.off("room:rtc-offer", handleOffer);
      socket.off("room:rtc-answer", handleAnswer);
      socket.off("room:rtc-ice", handleIce);
    };
  }, [socket, handleUserJoined, handleUserLeft, handleOffer, handleAnswer, handleIce]);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setInCall(true);
      
      socket.emit("room:join-call", { roomId });
    } catch (error) {
      console.error("Failed to start call", error);
    }
  };

  const endCall = () => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setRemoteStreams([]);
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    
    setInCall(false);
    setIsExpanded(false);
    socket.emit("room:leave-call", { roomId });
  };

  const toggleMic = () => {
    const enabled = !micEnabled;
    setMicEnabled(enabled);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    }
  };

  const toggleCam = () => {
    const enabled = !camEnabled;
    setCamEnabled(enabled);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = enabled;
      });
    }
  };

  const toggleSpeaker = () => {
    setSpeakerEnabled(!speakerEnabled);
  };

  const renderVideos = () => (
    <>
      <VideoStream stream={localStream} isLocal mirrored>
        <VideoOverlay className="video-overlay">
          <ControlButton
            onClick={toggleMic}
            title={micEnabled ? "Mute Mic" : "Unmute Mic"}
            $active={!micEnabled}
          >
            {micEnabled ? <MicIcon /> : <MicOffIcon />}
          </ControlButton>
          <ControlButton
            onClick={toggleCam}
            title={camEnabled ? "Turn Camera Off" : "Turn Camera On"}
            $active={!camEnabled}
          >
            {camEnabled ? <CamIcon /> : <CamOffIcon />}
          </ControlButton>
          <ControlButton
            onClick={toggleSpeaker}
            title={speakerEnabled ? "Mute Speaker" : "Unmute Speaker"}
            $active={!speakerEnabled}
          >
            {speakerEnabled ? <SpeakerIcon /> : <SpeakerOffIcon />}
          </ControlButton>
          <LeaveButton onClick={endCall} title="Leave Call">
            <PhoneIconPath />
          </LeaveButton>
        </VideoOverlay>
      </VideoStream>
      {remoteStreams.map(({ peerId, stream }) => (
        <VideoStream key={peerId} stream={stream} muted={!speakerEnabled} />
      ))}
    </>
  );

  return (
    <Panel>
      <Title>
        <span>Interview Call</span>
        <TitleControls>
          {inCall && <Status>{remoteStreams.length + 1} Active</Status>}
          {inCall && (
            <MaximizeButton onClick={() => setIsExpanded(true)} title="Expand View">
              <MaximizeIcon />
            </MaximizeButton>
          )}
        </TitleControls>
      </Title>
      
      {inCall ? (
        <>
          {!isExpanded && (
            <VideoRow>
              {renderVideos()}
            </VideoRow>
          )}
          {isExpanded && createPortal(
            <ExpandedOverlay>
              <ExpandedHeader>
                <h2>Interview Call ({remoteStreams.length + 1} Active)</h2>
                <MaximizeButton onClick={() => setIsExpanded(false)}>
                  <CloseIcon />
                </MaximizeButton>
              </ExpandedHeader>
              <ExpandedGrid>
                {renderVideos()}
              </ExpandedGrid>
            </ExpandedOverlay>,
            document.body
          )}
        </>
      ) : (
        <JoinWrapper>
          <JoinButton onClick={startCall}>
            Join Call
          </JoinButton>
        </JoinWrapper>
      )}
    </Panel>
  );
};
