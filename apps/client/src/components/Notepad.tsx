import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ConfirmationDialog } from "./ConfirmationDialog";

const editorStyles = {
  "& .ProseMirror": {
    outline: "none",
    minHeight: "100%",
    color: "text.primary",
    fontFamily: "inherit",
    lineHeight: 1.6,
    p: 2,
    "& > * + *": { mt: "0.75em" },
    "& ul, & ol": { pl: "1rem", ml: "1rem" },
    "& ul": { listStyleType: "disc" },
    "& ol": { listStyleType: "decimal" },
    "& h1, & h2, & h3": { lineHeight: 1.1, fontWeight: 700, mt: "1.5em", mb: "0.5em" },
    "& code": { bgcolor: "action.selected", color: "primary.main", fontFamily: "monospace", px: "0.4em", py: "0.2em", borderRadius: "4px", fontSize: "0.85em" },
    "& pre": { bgcolor: "action.hover", color: "text.primary", fontFamily: "monospace", p: "0.75rem 1rem", borderRadius: "0.5rem", my: "1em", overflowX: "auto", border: "1px solid", borderColor: "divider" },
    "& blockquote": { pl: 2, borderLeft: "3px solid", borderColor: "divider", color: "text.secondary", fontStyle: "italic" },
    "& p.is-editor-empty:first-child::before": { color: "text.disabled", content: "attr(data-placeholder)", float: "left", height: 0, pointerEvents: "none", opacity: 0.5 },
  },
};

interface NotepadProps {
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

export const Notepad = ({ value, readOnly = false, onChange }: NotepadProps) => {
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Write something..." })],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== value) onChange(html);
    },
    onTransaction: () => forceUpdate((n) => n + 1),
  });

  useEffect(() => {
    if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value);
      try { editor.commands.setTextSelection({ from, to }); }
      catch { editor.commands.focus("end"); }
    }
  }, [value, editor]);

  if (!editor) return null;

  const handleCopy = () => navigator.clipboard.writeText(editor.getText());
  const confirmClear = () => { editor.commands.clearContent(); onChange(""); setIsClearDialogOpen(false); };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", bgcolor: "background.default", minWidth: 0 }}>
      {!readOnly && (
        <Box sx={{ display: "flex", gap: 0.5, p: 0.5, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", alignItems: "center", flexWrap: "wrap" }}>
          <Tooltip title="Bold">
            <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} color={editor.isActive("bold") ? "primary" : "default"}>
              <FormatBoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Italic">
            <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} color={editor.isActive("italic") ? "primary" : "default"}>
              <FormatItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bullet List">
            <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} color={editor.isActive("bulletList") ? "primary" : "default"}>
              <FormatListBulletedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Code Block">
            <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCodeBlock().run()} color={editor.isActive("codeBlock") ? "primary" : "default"}>
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Copy Text">
            <IconButton size="small" onClick={handleCopy}><ContentCopyIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Clear All">
            <IconButton size="small" onClick={() => setIsClearDialogOpen(true)} sx={{ color: "error.main" }}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      )}
      <Box
        sx={{ flex: 1, overflowY: "auto", cursor: "text", minHeight: 0, ...editorStyles }}
        onClick={() => !readOnly && editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </Box>
      <ConfirmationDialog
        open={isClearDialogOpen}
        title="Clear Notes?"
        description="This will remove all notes for everyone in the room. This action cannot be undone."
        confirmLabel="Clear Notes"
        onConfirm={confirmClear}
        onCancel={() => setIsClearDialogOpen(false)}
      />
    </Box>
  );
};

