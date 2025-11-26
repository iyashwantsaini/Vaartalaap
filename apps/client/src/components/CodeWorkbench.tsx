import { useMemo, useState, useEffect } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import styled from "styled-components";
import { languages } from "../lib/languages";

const customDarkTheme = EditorView.theme({
  "&": {
    backgroundColor: "#050505 !important",
  },
  ".cm-gutters": {
    backgroundColor: "#050505 !important",
    borderRight: "1px solid #1a1a1a"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.04) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.04) !important",
  }
});

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
  min-width: 0;
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Select = styled.select`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  color: ${({ theme }) => theme.colors.text};
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  border-radius: 0px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 2px 2px 0px ${({ theme }) => theme.colors.accent};
  }

  &:hover {
    border-color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Label = styled.span`
  font-size: 0.75rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.textMuted};
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: '';
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.success};
    box-shadow: 0 0 8px ${({ theme }) => theme.colors.success};
  }
`;

const RunButton = styled.button`
  background: ${({ theme }) => theme.colors.accent};
  color: #000;
  border: 1px solid ${({ theme }) => theme.colors.accent};
  padding: 0.35rem 1rem;
  font-size: 0.85rem;
  font-weight: 800;
  font-family: ${({ theme }) => theme.fonts.mono};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  border-radius: 0px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: #fff;
    border-color: #fff;
    box-shadow: 4px 4px 0px #fff;
    transform: translate(-2px, -2px);
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

const EditorShell = styled.div`
  flex: 1;
  overflow: hidden;
  background: #000;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;

  .cm-editor {
    height: 100%;
    font-family: ${({ theme }) => theme.fonts.mono} !important;
  }

  .cm-scroller {
    overflow: auto !important;
  }
`;

const IOPanel = styled.div`
  height: 200px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  display: flex;
  min-width: 0;
  resize: vertical;
  overflow: hidden;
  min-height: 100px;
`;

const IOSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  resize: horizontal;
  
  &:last-child {
    border-right: none;
    resize: none;
  }
`;

const IOContent = styled.div`
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  & > div {
    flex: 1;
    height: 100%;
  }

  .cm-editor {
    height: 100%;
  }

  .cm-scroller {
    overflow: auto !important;
  }
`;

const IOHeader = styled.div`
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ToolbarLeft = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const EditorContainer = styled.div`
  flex: 1;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  
  & > div {
    flex: 1;
    height: 100%;
  }
`;

interface CodeWorkbenchProps {
  value: string;
  language: typeof languages[number]["value"];
  input: string;
  output: string;
  readOnly?: boolean;
  onChange: (next: string) => void;
  onLanguageChange: (next: typeof languages[number]["value"]) => void;
  onInputChange: (next: string) => void;
  onOutputChange: (next: string) => void;
}

export const CodeWorkbench = ({ 
  value, 
  language, 
  input,
  output,
  readOnly = false,
  onChange, 
  onLanguageChange,
  onInputChange,
  onOutputChange
}: CodeWorkbenchProps) => {
  const [isRunning, setIsRunning] = useState(false);

  const extensions = useMemo(() => {
    const preset = languages.find((entry) => entry.value === language) ?? languages[0];
    return [preset.extension];
  }, [language]);

  const baseTheme = useMemo(() => EditorView.theme({
    "&": {
      backgroundColor: "transparent",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "#fff",
      fontFamily: "inherit",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
    }
  }), []);

  useEffect(() => {
    if (!value) {
      const langConfig = languages.find((l) => l.value === language);
      if (langConfig) {
        onChange(langConfig.template);
      }
    }
  }, [language, value, onChange]);

  const handleRun = async () => {
    setIsRunning(true);
    onOutputChange("Running...");
    
    try {
      const langConfig = languages.find(l => l.value === language);
      const response = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: langConfig?.piston || language,
          version: "*",
          files: [{ content: value }],
          stdin: input,
        }),
      });

      const data = await response.json();
      
      if (data.run) {
        onOutputChange(data.run.output);
      } else {
        onOutputChange(data.message || "Unknown error occurred");
      }
    } catch (error) {
      onOutputChange("Failed to execute code. Please try again.");
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Wrapper>
      <Toolbar>
        <ToolbarLeft>
          <Label>Language</Label>
          <Select 
            aria-label="Select Language"
            title="Select Language"
            value={language} 
            disabled={readOnly}
            onChange={(event) => {
              const newLang = event.target.value as CodeWorkbenchProps["language"];
              onLanguageChange(newLang);
            }}
          >
            {languages.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </ToolbarLeft>
        <RunButton onClick={handleRun} disabled={isRunning || readOnly}>
          {isRunning ? (
            <>
              <span className="animate-spin">⟳</span> Running...
            </>
          ) : (
            <>
              <span>▶</span> Run Code
            </>
          )}
        </RunButton>
      </Toolbar>
      <EditorShell>
        <EditorContainer>
          <CodeMirror
            value={value}
            height="100%"
            theme={oneDark}
            extensions={[...extensions, customDarkTheme]}
            editable={!readOnly}
            basicSetup={{ lineNumbers: true, autocompletion: true }}
            onChange={(next) => onChange(next)}
          />
        </EditorContainer>
        <IOPanel>
          <IOSection>
            <IOHeader>Input (stdin)</IOHeader>
            <IOContent>
              <CodeMirror
                value={input}
                height="100%"
                theme={baseTheme}
                editable={!readOnly}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                onChange={(val) => onInputChange(val)}
                placeholder="Enter input for your program here..."
              />
            </IOContent>
          </IOSection>
          <IOSection>
            <IOHeader>Output</IOHeader>
            <IOContent>
              <CodeMirror
                value={output}
                height="100%"
                theme={baseTheme}
                editable={false}
                basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
                placeholder="Output will appear here..."
              />
            </IOContent>
          </IOSection>
        </IOPanel>
      </EditorShell>
    </Wrapper>
  );
};
