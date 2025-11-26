import { useState } from "react";
import styled from "styled-components";

const PreviewCard = styled.article`
  position: relative;
  padding: 1.75rem;
  border-radius: 0px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
  height: 420px;
  display: flex;
  flex-direction: column;
`;

const TabStrip = styled.div`
  display: flex;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
  flex-shrink: 0;
`;

const Tab = styled.button<{ $active?: boolean }>`
  flex: 1;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
  padding: 0.6rem 0.8rem;
  border-radius: 0px;
  background: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.surfaceMuted)};
  color: ${({ theme, $active }) => ($active ? "#000" : theme.colors.textMuted)};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.82rem;
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? "800" : "400")};
  box-shadow: ${({ $active }) => ($active ? "2px 2px 0px #fff" : "none")};
  transform: ${({ $active }) => ($active ? "translate(-1px, -1px)" : "none")};
  transition: all 0.2s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const ContentArea = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const CodePanel = styled.pre`
  margin: 0;
  border-radius: 0px;
  background: ${({ theme }) => theme.colors.surfaceMuted};
  padding: 1.2rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.accentSoft};
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: auto;
`;

const NotesPanel = styled.div`
  margin: 0;
  border-radius: 0px;
  background: ${({ theme }) => theme.colors.surfaceMuted};
  padding: 1.2rem;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text};
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: auto;

  h1 { font-size: 1.1rem; margin-top: 0; color: ${({ theme }) => theme.colors.accent}; }
  ul { padding-left: 1.2rem; }
  li { margin-bottom: 0.5rem; }
`;

const WhiteboardPanel = styled.div`
  margin: 0;
  border-radius: 0px;
  background: ${({ theme }) => theme.colors.surfaceMuted};
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Glow = styled.div`
  position: absolute;
  inset: -40% auto auto -40%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.18), transparent 60%);
  filter: blur(40px);
  opacity: 0.5;
  pointer-events: none;
`;

const StatusBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.25rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  flex-shrink: 0;
`;

const StatusChip = styled.span`
  padding: 0.4rem 0.7rem;
  border-radius: 0px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
`;

export const RoomPreview = () => {
  const [activeTab, setActiveTab] = useState<"code" | "notes" | "whiteboard">("code");

  return (
    <PreviewCard>
      <Glow />
      <TabStrip>
        <Tab $active={activeTab === "code"} onClick={() => setActiveTab("code")}>Code Pair</Tab>
        <Tab $active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>Notes</Tab>
        <Tab $active={activeTab === "whiteboard"} onClick={() => setActiveTab("whiteboard")}>Whiteboard</Tab>
      </TabStrip>
      
      <ContentArea>
        {activeTab === "code" && (
          <CodePanel>
{`function alignExpectations(candidate, panel) {
  const agenda = ["warm up", "code", "system", "wrap"];
  return agenda.map((step, index) => ({
    step,
    owner: index % 2 === 0 ? "candidate" : "panel",
  }));
}`}
          </CodePanel>
        )}

        {activeTab === "notes" && (
          <NotesPanel>
            <h1>Interview Notes</h1>
            <ul>
              <li>Candidate showed strong understanding of systems.</li>
              <li>Solved the algorithmic problem efficiently.</li>
              <li>Good communication skills.</li>
            </ul>
          </NotesPanel>
        )}

        {activeTab === "whiteboard" && (
          <WhiteboardPanel>
            <svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
              <path d="M40,120 Q150,40 260,120" fill="none" stroke="#3d5afe" strokeWidth="3" strokeLinecap="round" />
              <rect x="60" y="50" width="50" height="50" fill="none" stroke="#00bfa5" strokeWidth="3" rx="2" />
              <circle cx="210" cy="130" r="25" fill="none" stroke="#ff5d78" strokeWidth="3" />
            </svg>
          </WhiteboardPanel>
        )}
      </ContentArea>

      <StatusBar>
        <StatusChip>
          {activeTab === "code" ? "Piston runner • idle" : 
           activeTab === "notes" ? "Markdown • synced" : "Canvas • active"}
        </StatusChip>
        <span>Tab synced just now</span>
      </StatusBar>
    </PreviewCard>
  );
};
