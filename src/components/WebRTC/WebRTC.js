import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import "./WebRTC.css";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import { serverurl } from "../../config";
import Grid from "@material-ui/core/Grid";
// import Button from "@material-ui/core/Button";
// import VideoCallIcon from "@material-ui/icons/VideoCall";
// import GraphicEqIcon from "@material-ui/icons/GraphicEq";

const Video = (props) => {
  const ref = useRef();
  useEffect(() => {
    props.peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [props]);
  return <video className="video-box" playsInline autoPlay ref={ref} />;
};

const Room = () => {
  const [peers, setPeers] = useState([]);
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const { roomID } = useParams();
  // const [videoStatus, setVideoStatus] = useState(true);
  // const [audioStatus, setAudioStatus] = useState(true);

  useEffect(() => {
    socketRef.current = io(serverurl);
    const videoStatus = true;
    const audioStatus = true;
    if (videoStatus || audioStatus) {
      navigator.mediaDevices
        .getUserMedia({ video: videoStatus, audio: audioStatus })
        .then((stream) => {
          userVideo.current.srcObject = stream;
          socketRef.current.emit("join-video-room", roomID);
          socketRef.current.on("all-users-in-room", (users) => {
            const peers = [];
            users.forEach((userID) => {
              const peer = createPeer(userID, socketRef.current.id, stream);
              peersRef.current.push({
                peerID: userID,
                peer,
              });
              peers.push({
                peerID: userID,
                peer,
              });
            });
            setPeers(peers);
          });

          socketRef.current.on("user-joined", (payload) => {
            const peer = addPeer(payload.signal, payload.callerID, stream);
            peersRef.current.push({
              peerID: payload.callerID,
              peer,
            });

            const peerObj = {
              peerID: payload.callerID,
              peer,
            };
            setPeers((users) => [...users, peerObj]);
          });

          socketRef.current.on("receiving-returned-signal", (payload) => {
            const item = peersRef.current.find((p) => p.peerID === payload.id);
            item.peer.signal(payload.signal);
          });

          socketRef.current.on("user-left", (id) => {
            const peerObj = peersRef.current.find((p) => p.peerID === id);
            if (peerObj) {
              peerObj.peer.destroy();
            }
            const peers = peersRef.current.filter((p) => p.peerID !== id);
            peersRef.current = peers;
            setPeers(peers);
          });
        });
    }
  }, [roomID]);

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("sending-signal", {
        userToSignal,
        callerID,
        signal,
      });
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("returning-signal", { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  };

  // const videoToggleHandler = () => {
  //   setVideoStatus(!videoStatus);
  // };
  // const audioToggleHandler = () => {
  //   setAudioStatus(!audioStatus);
  // };

  return (
    <React.Fragment>
      
      {/* <div className="button">
        <Button
          variant="contained"
          color="primary"
          startIcon={<VideoCallIcon />}
          onClick={videoToggleHandler}
        >
          Video Toggle
        </Button>
      </div>
      <div className="button">
        <Button
          variant="contained"
          color="primary"
          startIcon={<GraphicEqIcon />}
          onClick={audioToggleHandler}
        >
          Audio Toggle
        </Button>
      </div> */}

      <Grid container spacing={0}>
        <Grid item xs={12} sm={12}>
          <video
            className="video-box"
            muted
            ref={userVideo}
            autoPlay
            playsInline
          />
        </Grid>
        {peers.map((peer) => {
          return (
            <Grid item xs={12} sm={12}>
              <Video key={peer.peerID} peer={peer.peer} />
            </Grid>
          );
        })}
      </Grid>
    </React.Fragment>
  );
};

export default Room;
