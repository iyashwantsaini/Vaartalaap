import { Button } from "@cred/neopop-web/lib/components";
import styled from "styled-components";

interface HeroProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isCreating?: boolean;
  isJoining?: boolean;
}

const HeroSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  max-width: 720px;
  z-index: 2;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: clamp(2.5rem, 6vw, 4.8rem);
  margin: 0;
  line-height: 1.05;
  letter-spacing: -0.04em;
`;

const Copy = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.1rem;
  line-height: 1.7;
  max-width: 680px;
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.sm};
`;

export const Hero = ({ onCreateRoom, onJoinRoom, isCreating, isJoining }: HeroProps) => {
  return (
    <HeroSection>
      <Title>
        VAARTALAAP
      </Title>
      <Copy>
        Spin up a shareable room link in seconds. No login required for guests.
        Real-time code collaboration, whiteboard, and crystal clear audio/video.
      </Copy>
      <ButtonRow>
        <Button
          variant="secondary"
          kind="elevated"
          size="big"
          colorMode="dark"
          onClick={onCreateRoom}
          disabled={isCreating}
        >
          {isCreating ? "Summoning room..." : "Create luxe room"}
        </Button>
        <Button
          variant="secondary"
          kind="elevated"
          size="big"
          colorMode="dark"
          onClick={onJoinRoom}
          disabled={isJoining}
        >
          {isJoining ? "Opening portal..." : "Join with code"}
        </Button>
      </ButtonRow>
    </HeroSection>
  );
};
