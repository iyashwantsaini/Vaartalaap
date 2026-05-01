import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import type { Extension } from "@codemirror/state";
import { acquireYDoc } from "../lib/yjs";

interface CollabCodeEditorProps {
  roomId: string;
  // The doc name partition (e.g. "code:cpp"). Different docNames give
  // independent histories — switching language switches Y.Doc.
  docName: string;
  // Language-specific CodeMirror extension (lang-cpp(), lang-python(), …)
  languageExtension: Extension;
  // Read-only mode (e.g. before user has joined the room)
  readOnly?: boolean;
  // Local user identity surfaced on remote cursors as a label + colour.
  userName: string;
  userColor: string;
  // Called whenever the document content changes (origin-agnostic). Parent
  // uses this to back up the latest plain-text into the Mongo room snapshot
  // so room loading via REST still returns code, and so users without Yjs
  // (e.g. an initial REST fetch) see something. Debounced by parent.
  onTextChange?: (text: string) => void;
  // Optional extra extensions (custom theme, keymap, etc.)
  extraExtensions?: Extension[];
  // Initial seed text to use ONLY if the Y.Doc is empty (first user in the
  // room). Subsequent users get the doc state via Yjs sync. We never touch
  // the Y.Text after init — that would clobber concurrent edits.
  seedIfEmpty?: string;
}

const blackTheme = EditorView.theme({
  "&.cm-focused": { outline: "none" },
});

/**
 * A CodeMirror editor whose text is a Yjs Y.Text — concurrent edits from any
 * peer in the same room merge automatically (CRDT) and remote cursors render
 * inline with their owner's name and colour.
 *
 * The (roomId, docName) pair is reference-counted across mounts — multiple
 * components can share the same doc cheaply.
 */
export const CollabCodeEditor = ({
  roomId,
  docName,
  languageExtension,
  readOnly = false,
  userName,
  userColor,
  onTextChange,
  extraExtensions = [],
  seedIfEmpty,
}: CollabCodeEditorProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Holds the live EditorView so we can dispose it on unmount / docName change.
  const viewRef = useRef<EditorView | null>(null);
  // The y-doc lease for this mount — released on unmount.
  const leaseRef = useRef<ReturnType<typeof acquireYDoc> | null>(null);
  // Latest text-change callback so the Y.Text observer always sees the most
  // recent props without re-binding the editor.
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  useEffect(() => {
    if (!hostRef.current) return;

    // Acquire (or reuse) the shared Y.Doc + Awareness for this slot.
    const lease = acquireYDoc(roomId, docName);
    leaseRef.current = lease;
    const ytext = lease.doc.getText("content");

    // Surface the local user on awareness so peers can label our cursor.
    lease.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
      colorLight: `${userColor}55`, // ~33% alpha background for selection
    });

    // First-user seeding: only after we've heard back from the server's
    // initial sync, so we don't race with persisted state and end up
    // The doc is seeded with the language template ONLY if the server's
    // canonical Y.Doc is currently empty. We DO NOT insert locally — when
    // two tabs open the same fresh room simultaneously, both would find
    // ytext empty after their initial sync (server has nothing to give)
    // and both would insert the template, leaving a duplicated buffer
    // after CRDT merge. Instead we delegate to the server, whose in-memory
    // Y.Doc serialises the empty-check + insert atomically and broadcasts
    // the resulting update to every peer (including us).
    let cancelled = false;
    if (!readOnly && seedIfEmpty) {
      void lease.synced.then(() => {
        if (cancelled) return;
        if (ytext.length !== 0) return;
        // Doc-level guard so a fast remount of the same component doesn't
        // re-emit the seed request once we've already attempted it for
        // this Y.Doc instance.
        const meta = lease.doc.getMap("__meta__");
        if (meta.get("seedRequested")) return;
        meta.set("seedRequested", true);
        lease.socket.emit(
          "yjs:seed-if-empty",
          { roomId, docName, textKey: "content", text: seedIfEmpty }
        );
      });
    }

    // Notify parent on every text change — origin-agnostic so Mongo backup
    // stays in sync with both local typing and remote ops.
    const observer = () => {
      onTextChangeRef.current?.(ytext.toString());
    };
    ytext.observe(observer);

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        languageExtension,
        blackTheme,
        ...extraExtensions,
        // yCollab provides:
        //  - bidirectional binding between the editor doc and the Y.Text
        //  - remote cursor decorations driven by `awareness`
        //  - undo manager scoped to local edits (so Ctrl+Z doesn't undo
        //    other people's typing)
        yCollab(ytext, lease.awareness),
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        keymap.of([]),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      cancelled = true;
      ytext.unobserve(observer);
      view.destroy();
      viewRef.current = null;
      // Clear local awareness so peers see us disappear immediately.
      lease.awareness.setLocalState(null);
      lease.release();
      leaseRef.current = null;
    };
    // We intentionally rebuild the editor when (roomId, docName) changes —
    // each docName is a separate Y.Doc lease.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, docName]);

  // Update awareness when the user's display name / colour changes mid-session.
  useEffect(() => {
    const lease = leaseRef.current;
    if (!lease) return;
    lease.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
      colorLight: `${userColor}55`,
    });
  }, [userName, userColor]);

  // Toggle read-only without rebuilding the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [],
    });
    // The simplest way to flip editable is to reconfigure the compartment,
    // but to keep this component small we rely on the props change triggering
    // the main effect when needed. For now editable is fixed at mount; if you
    // toggle readOnly mid-session, remount via key prop.
  }, [readOnly]);

  return (
    <div
      ref={hostRef}
      style={{ height: "100%", width: "100%" }}
    />
  );
};
