import { useEffect, useState } from "react";
import styled from "styled-components";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ConfirmationDialog } from "./ConfirmationDialog";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  height: 100%;
  background: #050505;
  min-width: 0;
`;

const Toolbar = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  align-items: center;
  flex-wrap: wrap;
`;

const ToolButton = styled.button<{ $active?: boolean; $textColor?: string }>`
  width: 2rem;
  height: 2rem;
  border-radius: 0px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.text : "transparent")};
  background: ${({ theme, $active }) => ($active ? theme.colors.text : "transparent")};
  color: ${({ theme, $active, $textColor }) => 
    $active ? theme.colors.surface : ($textColor || theme.colors.text)};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.surfaceMuted)};
    color: ${({ theme, $active }) => ($active ? theme.colors.surface : theme.colors.text)};
    border-color: ${({ theme }) => theme.colors.textMuted};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 1.5rem;
  background: ${({ theme }) => theme.colors.border};
  margin: 0 4px;
`;

const EditorWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  cursor: text;
  min-height: 0;
  
  .ProseMirror {
    outline: none;
    min-height: 100%;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
    line-height: 1.6;
    
    > * + * {
      margin-top: 0.75em;
    }

    ul, ol {
      padding: 0 1rem;
      margin-left: 1rem;
    }

    ul {
      list-style-type: disc;
    }

    ol {
      list-style-type: decimal;
    }

    h1, h2, h3, h4, h5, h6 {
      line-height: 1.1;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    code {
      background-color: rgba(255, 255, 255, 0.1);
      color: ${({ theme }) => theme.colors.accent};
      font-family: ${({ theme }) => theme.fonts.mono};
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.85em;
    }

    pre {
      background: #0d0d0d;
      color: #fff;
      font-family: ${({ theme }) => theme.fonts.mono};
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      margin: 1em 0;
      overflow-x: auto;
      
      code {
        color: inherit;
        padding: 0;
        background: none;
        font-size: 0.8rem;
      }
    }

    blockquote {
      padding-left: 1rem;
      border-left: 3px solid ${({ theme }) => theme.colors.border};
      color: ${({ theme }) => theme.colors.textMuted};
      font-style: italic;
    }
    
    p.is-editor-empty:first-child::before {
      color: ${({ theme }) => theme.colors.textMuted};
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
      opacity: 0.5;
    }
  }
`;

const BoldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
);

const ItalicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);

const ListIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const CodeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const CopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

interface NotepadProps {
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

export const Notepad = ({ value, readOnly = false, onChange }: NotepadProps) => {
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write something...',
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Only trigger change if content is actually different to avoid loops
      // Note: This simple check might not be enough for complex HTML but works for basic cases
      if (html !== value) {
        onChange(html);
      }
    },
    onTransaction: () => {
      forceUpdate((n) => n + 1);
    },
    editorProps: {
      attributes: {
        // class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable === readOnly) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Sync external value changes (e.g. from other users)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Save cursor position if possible, but for now just simple replacement
      // Ideally we'd use Yjs for real collab, but this is a simple replacement
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value);
      // Try to restore selection if it's within bounds, otherwise end
      try {
        editor.commands.setTextSelection({ from, to });
      } catch (e) {
        editor.commands.focus('end');
      }
    }
  }, [value, editor]);

  const handleCopy = () => {
    if (editor) {
      const text = editor.getText();
      navigator.clipboard.writeText(text);
    }
  };

  const handleClear = () => {
    setIsClearDialogOpen(true);
  };

  const confirmClear = () => {
    if (editor) {
      editor.commands.clearContent();
      onChange("");
    }
    setIsClearDialogOpen(false);
  };

  if (!editor) {
    return null;
  }

  return (
    <Container>
      {!readOnly && (
        <Toolbar>
          <ToolButton 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            $active={editor.isActive('bold')}
            title="Bold"
          >
            <BoldIcon />
          </ToolButton>
          <ToolButton 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            $active={editor.isActive('italic')}
            title="Italic"
          >
            <ItalicIcon />
          </ToolButton>
          <ToolButton 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            $active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <ListIcon />
          </ToolButton>
          <ToolButton 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            $active={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <CodeIcon />
          </ToolButton>
          <Separator />
          <ToolButton onClick={handleCopy} title="Copy Text">
            <CopyIcon />
          </ToolButton>
          <ToolButton onClick={handleClear} title="Clear All" $textColor="#ff5d78">
            <TrashIcon />
          </ToolButton>
        </Toolbar>
      )}
      <EditorWrapper onClick={() => !readOnly && editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </EditorWrapper>
      <ConfirmationDialog
        open={isClearDialogOpen}
        title="Clear Notes?"
        description="This will remove all notes for everyone in the room. This action cannot be undone."
        confirmLabel="Clear Notes"
        onConfirm={confirmClear}
        onCancel={() => setIsClearDialogOpen(false)}
      />
    </Container>
  );
};
