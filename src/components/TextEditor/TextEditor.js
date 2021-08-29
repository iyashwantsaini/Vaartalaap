import React, { useCallback, useEffect, useRef, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import "./TextEditor.css";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { serverurl } from "../../config";

// text editor configuration
var Size = Quill.import("attributors/style/size");
Size.whitelist = ["8px", "10px", "12px", "14px", "16px", "18px"];
Quill.register(Size, true);
const SAVE_INTERVAL_MS = 2000;
const TOOLBAR_OPTIONS = [
  [{ script: "sub" }, { script: "super" }],
  ["image", "blockquote", "code-block"],
  ["bold", "italic", "underline", "strike"], // toggled buttons
  [{ header: 1 }, { header: 2 }], // custom button values
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }], // outdent/indent
  [{ direction: "rtl" }], // text direction
  [
    {
      size: [
        "huge",
        "large",
        "small",
        "8px",
        "10px",
        "12px",
        "14px",
        "16px",
        "18px",
      ],
    },
  ], // custom dropdown
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ color: [] }, { background: [] }], // dropdown with defaults from theme
  [{ font: [] }],
  [{ align: [] }],
  ["clean"], // remove formatting button
];

const TextEditor = () => {
  const socketRef = useRef();
  const [quill, setQuill] = useState();
  const { roomID } = useParams();

  useEffect(() => {
    socketRef.current = io(serverurl);
    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socketRef.current == null || quill == null) return;
    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socketRef.current.emit("send-text-changes", delta);
    };
    quill.on("text-change", handler);
    return () => {
      quill.off("text-change", handler);
    };
  }, [socketRef, quill]);

  useEffect(() => {
    if (socketRef.current == null || quill == null) return;
    const handler = (delta) => {
      quill.updateContents(delta);
    };
    socketRef.current.on("receive-text-changes", handler);
    return () => {
      socketRef.current.off("receive-text-changes", handler);
    };
  }, [socketRef, quill]);

  useEffect(() => {
    if (socketRef.current == null || quill == null) return;
    socketRef.current.once("load-text-editor-data", (quillDataObject) => {
      quill.setContents(quillDataObject);
      quill.enable();
    });
    socketRef.current.emit("get-text-editor-data", roomID);
  }, [socketRef, quill, roomID]);

  useEffect(() => {
    if (socketRef.current == null || quill == null) return;
    const interval = setInterval(() => {
      socketRef.current.emit("save-text-editor-data", quill.getContents());
    }, SAVE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [socketRef, quill]);

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    });
    q.disable();
    q.setText("loading.....");
    setQuill(q);
  }, []);
  return <div className="container-quill" ref={wrapperRef}></div>;
};

export default TextEditor;
