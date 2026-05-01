import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import EmojiEmotionsOutlinedIcon from "@mui/icons-material/EmojiEmotionsOutlined";
import { getSocket } from "../lib/socket";
import { ChatPanel } from "./ChatPanel";

interface CallPanelProps {
  roomId: string;
  participants?: { id: string; displayName: string }[];
  localParticipantId?: string;
  localDisplayName?: string;
  // socket.id -> participantId mapping if available; not required
}

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "😂", "🔥", "🤔"] as const;

interface FloatingReaction {
  id: string;
  emoji: string;
  from: string; // display label
  /** horizontal anchor 0-100 (% of container width) */
  x: number;
}

const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free TURN via Open Relay — enables connections behind symmetric NAT / corporate VPNs
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const ReactionsButton = ({ onSend }: { onSend: (emoji: string) => void }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title="Send a reaction">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            bgcolor: anchor ? "primary.main" : "rgba(255,255,255,0.08)",
            color: "white",
            width: 44,
            height: 44,
            "&:hover": { bgcolor: anchor ? "primary.dark" : "rgba(255,255,255,0.16)" },
          }}
        >
          <EmojiEmotionsOutlinedIcon />
        </IconButton>
      </Tooltip>
      {anchor && (
        <Box
          onMouseLeave={() => setAnchor(null)}
          sx={{
            position: "fixed",
            zIndex: 1400,
            left: anchor.getBoundingClientRect().left + anchor.offsetWidth / 2,
            bottom: window.innerHeight - anchor.getBoundingClientRect().top + 8,
            transform: "translateX(-50%)",
            display: "flex",
            gap: 0.5,
            bgcolor: "rgba(20,20,28,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            px: 1,
            py: 0.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <IconButton
              key={emoji}
              onClick={() => {
                onSend(emoji);
                setAnchor(null);
              }}
              sx={{
                fontSize: "1.4rem",
                width: 40,
                height: 40,
                color: "white",
                "&:hover": { transform: "scale(1.25)", bgcolor: "rgba(255,255,255,0.08)" },
                transition: "transform 0.12s ease",
              }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      )}
    </>
  );
};

const VideoStream = ({
  stream,
  isLocal = false,
  mirrored = false,
  muted = false,
  label,
  isYou = false,
  videoOff = false,
  fitContain = false,
  flexFill = false,
  badge,
  children,
}: {
  stream: MediaStream | null;
  isLocal?: boolean;
  mirrored?: boolean;
  muted?: boolean;
  label?: string;
  isYou?: boolean;
  videoOff?: boolean;
  fitContain?: boolean;
  /** When true, the wrapper fills its parent without forcing a 16:9 aspect.
   *  Use for spotlight / alone-in-call so the camera feed centers naturally. */
  flexFill?: boolean;
  badge?: string;
  children?: React.ReactNode;
}) => {
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && stream) {
      node.srcObject = stream;
      if (node.paused) node.play().catch((e) => console.warn("[webrtc] play failed", e));
    } else if (node) {
      // Detach when stream becomes null so audio stops immediately
      node.srcObject = null;
    }
  }, [stream]);

  // Force `contain` whenever the tile fills (no aspect constraint) — otherwise
  // a 4:3 webcam in a 16:9 wrapper would crop faces.
  const useContain = fitContain || flexFill;

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2,
        bgcolor: "#0b0b10",
        overflow: "hidden",
        ...(flexFill
          ? { width: "100%", height: "100%" }
          : { aspectRatio: "16/9", width: "100%", height: "100%" }),
        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover .video-overlay": { opacity: 1 },
      }}
    >
      <Box
        component="video"
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted}
        sx={{
          width: "100%",
          height: "100%",
          objectFit: useContain ? "contain" : "cover",
          backgroundColor: useContain ? "#000" : "transparent",
          transform: mirrored ? "scaleX(-1)" : "none",
          display: videoOff ? "none" : "block",
        }}
      />
      {videoOff && (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PersonIcon sx={{ fontSize: 36, color: "white" }} />
          </Box>
        </Box>
      )}
      {badge && (
        <Box sx={{ position: "absolute", top: 8, left: 8, px: 1, py: 0.25, bgcolor: "primary.main", borderRadius: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "white", animation: "pulse 1.5s infinite" }} />
          <Typography variant="caption" sx={{ color: "white", fontWeight: 700, letterSpacing: "0.05em" }}>
            {badge}
          </Typography>
        </Box>
      )}
      {label && (
        <Box sx={{ position: "absolute", bottom: 8, left: 8, px: 1, py: 0.25, bgcolor: "rgba(0,0,0,0.6)", borderRadius: 1, backdropFilter: "blur(4px)" }}>
          <Typography variant="caption" sx={{ color: "white", fontWeight: 600 }}>
            {label}{isYou ? " (you)" : ""}
          </Typography>
        </Box>
      )}
      {children}
    </Box>
  );
};

export const CallPanel = ({ roomId, localDisplayName, participants = [], localParticipantId }: CallPanelProps) => {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([]);
  // Maps a peer's socket.id to its participantId so we can look up display names
  const [peerParticipantIds, setPeerParticipantIds] = useState<Record<string, string>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Tile id of the pinned/spotlighted participant. "local" or a peer socketId.
  // null = no pin (grid mode). Auto-set when a peer (or local) starts sharing.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Set of peer socketIds currently sharing their screen
  const [sharingPeers, setSharingPeers] = useState<Set<string>>(new Set());
  // Live floating reactions overlaid on the call surface (auto-expire after ~3s)
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);

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
    setRemoteStreams((prev) => {
      const target = prev.find((p) => p.peerId === peerId);
      // Stop every track on the remote stream so audio playback halts immediately
      target?.stream.getTracks().forEach((t) => t.stop());
      return prev.filter((p) => p.peerId !== peerId);
    });
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
        addRemoteStream(peerId, remoteStream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.warn(`[webrtc] ice ${pc.iceConnectionState} for peer ${peerId}`);
      }
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

  const handleUserJoined = useCallback(async ({ socketId, participantId }: { socketId: string; participantId?: string }) => {
    if (!localStreamRef.current) return;

    if (participantId) {
      setPeerParticipantIds((prev) => ({ ...prev, [socketId]: participantId }));
    }

    if (peersRef.current.has(socketId)) {
      const pc = peersRef.current.get(socketId);
      if (pc && pc.connectionState !== "closed" && pc.connectionState !== "failed") {
        return;
      }
      pc?.close();
      peersRef.current.delete(socketId);
      removeRemoteStream(socketId);
    }

    createPeer(socketId, true, localStreamRef.current);
  }, [createPeer, removeRemoteStream]);

  const handleCallRoster = useCallback((roster: { socketId: string; participantId: string }[]) => {
    if (!Array.isArray(roster)) return;
    setPeerParticipantIds((prev) => {
      const next = { ...prev };
      for (const r of roster) next[r.socketId] = r.participantId;
      return next;
    });
  }, []);

  const handleOffer = useCallback(async ({ from, to, sdp }: { from: string; to?: string; sdp: RTCSessionDescriptionInit }) => {
    // Ignore offers not addressed to us (defensive guard for broadcast fallback)
    if (to && to !== socket.id) return;
    if (!localStreamRef.current) return;

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
          return;
        }

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
    const pc = peersRef.current.get(from);
    if (pc) {
      try {
        if (pc.signalingState === "stable") {
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
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
    }
    removeRemoteStream(socketId);
    setPeerParticipantIds((prev) => {
      if (!(socketId in prev)) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setSharingPeers((prev) => {
      if (!prev.has(socketId)) return prev;
      const next = new Set(prev);
      next.delete(socketId);
      return next;
    });
    setPinnedId((curr) => (curr === socketId ? null : curr));
  }, [removeRemoteStream]);

  useEffect(() => {
    socket.on("room:call-user-joined", handleUserJoined);
    socket.on("room:call-user-left", handleUserLeft);
    socket.on("room:call-roster", handleCallRoster);
    socket.on("room:rtc-offer", handleOffer);
    socket.on("room:rtc-answer", handleAnswer);
    socket.on("room:rtc-ice", handleIce);

    const handleScreenShare = ({ socketId, sharing }: { socketId: string; sharing: boolean }) => {
      setSharingPeers((prev) => {
        const next = new Set(prev);
        if (sharing) next.add(socketId); else next.delete(socketId);
        return next;
      });
      // Auto-pin the new sharer; auto-unpin when they stop
      setPinnedId((curr) => {
        if (sharing) return socketId;
        if (curr === socketId) return null;
        return curr;
      });
    };
    socket.on("room:screen-share", handleScreenShare);

    const handleReaction = (payload: { id: string; socketId: string; participantId: string; emoji: string }) => {
      const fromName =
        payload.participantId === localParticipantId
          ? "You"
          : participants.find((p) => p.id === payload.participantId)?.displayName ?? "Someone";
      const x = 15 + Math.random() * 70; // 15% .. 85%
      const reaction: FloatingReaction = { id: payload.id, emoji: payload.emoji, from: fromName, x };
      setReactions((prev) => [...prev.slice(-15), reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    };
    socket.on("room:reaction", handleReaction);

    return () => {
      socket.off("room:call-user-joined", handleUserJoined);
      socket.off("room:call-user-left", handleUserLeft);
      socket.off("room:call-roster", handleCallRoster);
      socket.off("room:rtc-offer", handleOffer);
      socket.off("room:rtc-answer", handleAnswer);
      socket.off("room:rtc-ice", handleIce);
      socket.off("room:screen-share", handleScreenShare);
      socket.off("room:reaction", handleReaction);
    };
  }, [socket, handleUserJoined, handleUserLeft, handleCallRoster, handleOffer, handleAnswer, handleIce, localParticipantId, participants]);

  const sendReaction = (emoji: string) => {
    socket.emit("room:reaction", { roomId, emoji });
  };

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
    // Stop screen share if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    cameraVideoTrackRef.current = null;
    setIsSharingScreen(false);

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    // Stop tracks on every remote stream before dropping them so speakers go silent
    setRemoteStreams((prev) => {
      prev.forEach(({ stream }) => stream.getTracks().forEach((t) => t.stop()));
      return [];
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    setInCall(false);
    setIsExpanded(false);
    setPeerParticipantIds({});
    setSharingPeers(new Set());
    setPinnedId(null);
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

  const replaceVideoTrackOnPeers = (track: MediaStreamTrack | null) => {
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        sender.replaceTrack(track).catch((e) => console.warn("[webrtc] replaceTrack failed", e));
      }
    });
  };

  const stopScreenShare = useCallback(() => {
    const screen = screenStreamRef.current;
    if (screen) {
      screen.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    // Restore camera video track on all peers and on the local preview
    const camTrack = cameraVideoTrackRef.current;
    replaceVideoTrackOnPeers(camTrack ?? null);
    if (localStreamRef.current && camTrack) {
      // Swap the video track inside the local stream so the local preview shows the camera again
      const localStreamObj = localStreamRef.current;
      localStreamObj.getVideoTracks().forEach((t) => {
        if (t !== camTrack) localStreamObj.removeTrack(t);
      });
      if (!localStreamObj.getVideoTracks().includes(camTrack)) {
        localStreamObj.addTrack(camTrack);
      }
      // Force a new stream reference so React re-renders the <video>
      const refreshed = new MediaStream(localStreamObj.getTracks());
      localStreamRef.current = refreshed;
      setLocalStream(refreshed);
    }
    setIsSharingScreen(false);
    setPinnedId((curr) => (curr === "local" ? null : curr));
    socket.emit("room:screen-share", { roomId, sharing: false });
  }, [roomId, socket]);

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = display;
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;

      // Save current camera track so we can restore it later
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0] ?? null;
        cameraVideoTrackRef.current = camTrack;
      }

      // Replace track for all peer connections
      replaceVideoTrackOnPeers(screenTrack);

      // Update the local preview stream
      if (localStreamRef.current) {
        const localStreamObj = localStreamRef.current;
        localStreamObj.getVideoTracks().forEach((t) => localStreamObj.removeTrack(t));
        localStreamObj.addTrack(screenTrack);
        const refreshed = new MediaStream(localStreamObj.getTracks());
        localStreamRef.current = refreshed;
        setLocalStream(refreshed);
      }

      // When the user clicks the browser's "Stop sharing" button
      screenTrack.onended = () => stopScreenShare();
      setIsSharingScreen(true);
      setPinnedId("local");
      socket.emit("room:screen-share", { roomId, sharing: true });
    } catch (err) {
      console.warn("[screen-share] cancelled or failed", err);
    }
  };

  const renderVideos = () => {
    // When alone in the compact view, prefer `contain` so a 4:3 webcam shows
    // the full face (with light letterboxing) instead of being cropped.
    const aloneInCompact = remoteStreams.length === 0;
    return (
    <>
      <VideoStream
        stream={localStream}
        isLocal
        mirrored={!isSharingScreen}
        label={localDisplayName || "You"}
        isYou
        videoOff={!camEnabled && !isSharingScreen}
        fitContain={isSharingScreen || aloneInCompact}
        badge={isSharingScreen ? "SHARING" : undefined}
      />
      {remoteStreams.map(({ peerId, stream }) => {
        const pid = peerParticipantIds[peerId];
        const name = participants.find((p) => p.id === pid)?.displayName ?? "Guest";
        return (
          <VideoStream key={peerId} stream={stream} muted={!speakerEnabled} label={name} />
        );
      })}
    </>
    );
  };

  const totalTiles = remoteStreams.length + 1;
  // Choose grid columns based on tile count for a Meet-like layout
  const expandedColumns =
    totalTiles === 1 ? "1fr"
      : totalTiles === 2 ? "repeat(2, 1fr)"
        : totalTiles <= 4 ? "repeat(2, 1fr)"
          : totalTiles <= 9 ? "repeat(3, 1fr)"
            : "repeat(4, 1fr)";

  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1, bgcolor: "background.paper" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography
          variant="caption"
          sx={{
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
          Live Call
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {inCall && <Chip label={`${totalTiles} on call`} size="small" variant="outlined" />}
          {inCall && (
            <Tooltip title="Expand View">
              <IconButton size="small" onClick={() => setIsExpanded(true)}><OpenInFullIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {inCall ? (
        <>
          {!isExpanded && (
            <>
              <Box sx={{
                display: "grid",
                gridTemplateColumns: totalTiles === 1 ? "1fr" : "repeat(2, 1fr)",
                gap: 0.75,
              }}>
                {renderVideos()}
              </Box>
              <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ pt: 0.75 }}>
                <Tooltip title={micEnabled ? "Mute mic" : "Unmute mic"}>
                  <IconButton size="small" onClick={toggleMic} sx={{ bgcolor: micEnabled ? "action.hover" : "error.main", color: micEnabled ? "text.primary" : "white", "&:hover": { bgcolor: micEnabled ? "action.selected" : "error.dark" } }}>
                    {micEnabled ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={camEnabled ? "Stop camera" : "Start camera"}>
                  <IconButton size="small" onClick={toggleCam} sx={{ bgcolor: camEnabled ? "action.hover" : "error.main", color: camEnabled ? "text.primary" : "white", "&:hover": { bgcolor: camEnabled ? "action.selected" : "error.dark" } }}>
                    {camEnabled ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={isSharingScreen ? "Stop sharing" : "Share screen"}>
                  <IconButton size="small" onClick={toggleScreenShare} sx={{ bgcolor: isSharingScreen ? "primary.main" : "action.hover", color: isSharingScreen ? "white" : "text.primary", "&:hover": { bgcolor: isSharingScreen ? "primary.dark" : "action.selected" } }}>
                    {isSharingScreen ? <StopScreenShareIcon fontSize="small" /> : <ScreenShareIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={speakerEnabled ? "Mute speaker" : "Unmute speaker"}>
                  <IconButton size="small" onClick={toggleSpeaker} sx={{ bgcolor: "action.hover", color: speakerEnabled ? "text.primary" : "error.main", "&:hover": { bgcolor: "action.selected" } }}>
                    {speakerEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Leave call">
                  <IconButton size="small" onClick={endCall} sx={{ bgcolor: "error.main", color: "white", "&:hover": { bgcolor: "error.dark" }, ml: 0.5 }}>
                    <CallEndIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </>
          )}
          {isExpanded && createPortal(
            <Box sx={{ position: "fixed", inset: 0, bgcolor: "#000", zIndex: 1300, display: "flex", flexDirection: "column" }}>
              {/* Top bar */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, py: 1.5, color: "white", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Typography variant="subtitle1" fontWeight={700}>Live call</Typography>
                  <Chip size="small" label={`${totalTiles} on call`} sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "white" }} />
                  {isSharingScreen && (
                    <Chip size="small" color="primary" label="You're sharing your screen" />
                  )}
                </Stack>
                <IconButton onClick={() => setIsExpanded(false)} sx={{ color: "white" }}><CloseIcon /></IconButton>
              </Stack>

              {/* Body: spotlight + filmstrip OR grid, then optional chat sidebar */}
              <Box sx={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
                {/* Floating reactions overlay */}
                <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden",
                  "@keyframes vaaReactionFloat": {
                    "0%": { transform: "translate(-50%, 0) scale(0.6)", opacity: 0 },
                    "15%": { transform: "translate(-50%, -10%) scale(1.1)", opacity: 1 },
                    "100%": { transform: "translate(-50%, -120%) scale(1)", opacity: 0 },
                  },
                }}>
                  {reactions.map((r) => (
                    <Box
                      key={r.id}
                      sx={{
                        position: "absolute",
                        bottom: 0,
                        left: `${r.x}%`,
                        animation: "vaaReactionFloat 3s ease-out forwards",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <Box sx={{ fontSize: "3rem", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))" }}>{r.emoji}</Box>
                      <Box sx={{ px: 1, py: 0.25, bgcolor: "rgba(0,0,0,0.6)", borderRadius: 1, color: "white", fontSize: "0.7rem", fontWeight: 600 }}>
                        {r.from}
                      </Box>
                    </Box>
                  ))}
                </Box>
                {(() => {
                  // Build tile descriptors for the expanded view.
                  // In expanded mode we always use `contain` (via fitContain) so
                  // a 4:3 webcam never crops the user's face inside our 16:9
                  // wrapper. Screen-share tiles already need contain anyway.
                  type Tile = { id: string; label: string; isYou: boolean; stream: MediaStream | null; mirrored: boolean; videoOff: boolean; muted: boolean; fitContain: boolean; badge?: string };
                  const tiles: Tile[] = [
                    {
                      id: "local",
                      label: localDisplayName || "You",
                      isYou: true,
                      stream: localStream,
                      mirrored: !isSharingScreen,
                      videoOff: !camEnabled && !isSharingScreen,
                      muted: false,
                      fitContain: true,
                      badge: isSharingScreen ? "SHARING" : undefined,
                    },
                    ...remoteStreams.map(({ peerId, stream }) => {
                      const pid = peerParticipantIds[peerId];
                      const isSharing = sharingPeers.has(peerId);
                      return {
                        id: peerId,
                        label: participants.find((p) => p.id === pid)?.displayName ?? "Guest",
                        isYou: false,
                        stream,
                        mirrored: false,
                        videoOff: false,
                        muted: !speakerEnabled,
                        fitContain: true,
                        badge: isSharing ? "SHARING" : undefined,
                      };
                    }),
                  ];

                  const pinned = pinnedId ? tiles.find((t) => t.id === pinnedId) : null;
                  const others = pinned ? tiles.filter((t) => t.id !== pinned.id) : tiles;

                  const renderTile = (t: Tile, opts: { large?: boolean }) => (
                    <Box key={t.id} sx={{ position: "relative", width: "100%", height: "100%" }}>
                      <VideoStream
                        stream={t.stream}
                        isLocal={t.isYou}
                        mirrored={t.mirrored}
                        muted={t.muted}
                        label={t.label}
                        isYou={t.isYou}
                        videoOff={t.videoOff}
                        fitContain={t.fitContain}
                        flexFill={opts.large}
                        badge={t.badge}
                      />
                      <Tooltip title={pinnedId === t.id ? "Unpin" : "Pin to spotlight"}>
                        <IconButton
                          size="small"
                          onClick={() => setPinnedId((curr) => (curr === t.id ? null : t.id))}
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            bgcolor: pinnedId === t.id ? "primary.main" : "rgba(0,0,0,0.55)",
                            color: "white",
                            "&:hover": { bgcolor: pinnedId === t.id ? "primary.dark" : "rgba(0,0,0,0.8)" },
                          }}
                        >
                          {pinnedId === t.id ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  );

                  if (pinned) {
                    return (
                      <Box sx={{ flex: 1, display: "flex", overflow: "hidden", p: 1.5, gap: 1.5 }}>
                        {/* Spotlight */}
                        <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Box sx={{ width: "100%", height: "100%" }}>
                            {renderTile(pinned, { large: true })}
                          </Box>
                        </Box>
                        {/* Filmstrip */}
                        {others.length > 0 && (
                          <Box sx={{
                            width: 240,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            overflowY: "auto",
                            flexShrink: 0,
                          }}>
                            {others.map((t) => (
                              <Box key={t.id} sx={{ aspectRatio: "16/9", width: "100%" }}>
                                {renderTile(t, {})}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  }

                  // Single tile (alone in call) — render as a centered spotlight
                  // that fills the available area without forcing 16:9, so the
                  // user's webcam shows naturally instead of being cropped.
                  if (tiles.length === 1) {
                    return (
                      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 1.5, md: 3 } }}>
                        <Box sx={{ width: "100%", height: "100%", maxWidth: 1400 }}>
                          {renderTile(tiles[0], { large: true })}
                        </Box>
                      </Box>
                    );
                  }

                  // Default grid layout when nothing is pinned
                  return (
                    <Box sx={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: expandedColumns,
                      gap: 1.5,
                      p: 2,
                      overflow: "hidden",
                      alignContent: "center",
                      justifyContent: "center",
                      placeItems: "center",
                    }}>
                      {tiles.map((t) => (
                        <Box key={t.id} sx={{ width: "100%", aspectRatio: "16/9" }}>
                          {renderTile(t, {})}
                        </Box>
                      ))}
                    </Box>
                  );
                })()}

                {isChatOpen && (
                  <Box sx={{
                    width: { xs: "100%", sm: 340 },
                    borderLeft: "1px solid rgba(255,255,255,0.08)",
                    bgcolor: "#0b0b10",
                    display: "flex",
                    flexDirection: "column",
                    p: 1.5,
                  }}>
                    <ChatPanel
                      roomId={roomId}
                      localParticipantId={localParticipantId}
                      participants={participants}
                      fullHeight
                    />
                  </Box>
                )}
              </Box>

              {/* Bottom control bar */}
              <Stack direction="row" spacing={1.25} justifyContent="center" alignItems="center" sx={{ py: 2, px: 2, borderTop: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(0,0,0,0.6)" }}>
                <Tooltip title={micEnabled ? "Mute mic" : "Unmute mic"}>
                  <IconButton onClick={toggleMic} sx={{ bgcolor: micEnabled ? "rgba(255,255,255,0.08)" : "error.main", color: "white", width: 44, height: 44, "&:hover": { bgcolor: micEnabled ? "rgba(255,255,255,0.16)" : "error.dark" } }}>
                    {micEnabled ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={camEnabled ? "Stop camera" : "Start camera"}>
                  <IconButton onClick={toggleCam} sx={{ bgcolor: camEnabled ? "rgba(255,255,255,0.08)" : "error.main", color: "white", width: 44, height: 44, "&:hover": { bgcolor: camEnabled ? "rgba(255,255,255,0.16)" : "error.dark" } }}>
                    {camEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={isSharingScreen ? "Stop sharing" : "Share screen"}>
                  <IconButton onClick={toggleScreenShare} sx={{ bgcolor: isSharingScreen ? "primary.main" : "rgba(255,255,255,0.08)", color: "white", width: 44, height: 44, "&:hover": { bgcolor: isSharingScreen ? "primary.dark" : "rgba(255,255,255,0.16)" } }}>
                    {isSharingScreen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={isChatOpen ? "Hide chat" : "Show chat"}>
                  <IconButton onClick={() => setIsChatOpen((v) => !v)} sx={{ bgcolor: isChatOpen ? "primary.main" : "rgba(255,255,255,0.08)", color: "white", width: 44, height: 44, "&:hover": { bgcolor: isChatOpen ? "primary.dark" : "rgba(255,255,255,0.16)" } }}>
                    <ForumOutlinedIcon />
                  </IconButton>
                </Tooltip>
                <ReactionsButton onSend={sendReaction} />
                <Tooltip title={speakerEnabled ? "Mute speaker" : "Unmute speaker"}>
                  <IconButton onClick={toggleSpeaker} sx={{ bgcolor: "rgba(255,255,255,0.08)", color: speakerEnabled ? "white" : "error.main", width: 44, height: 44, "&:hover": { bgcolor: "rgba(255,255,255,0.16)" } }}>
                    {speakerEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
                  </IconButton>
                </Tooltip>
                <Box sx={{ width: "1px", height: 28, bgcolor: "rgba(255,255,255,0.12)", mx: 0.5, flexShrink: 0 }} />
                <Tooltip title="Leave call">
                  <IconButton onClick={endCall} sx={{ bgcolor: "error.main", color: "white", width: 64, height: 44, borderRadius: "22px", "&:hover": { bgcolor: "error.dark" } }}>
                    <CallEndIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>,
            document.body
          )}
        </>
      ) : (
        <Button variant="contained" fullWidth onClick={startCall}>
          Join Call
        </Button>
      )}
    </Paper>
  );
};
