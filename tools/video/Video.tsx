// The whole video. Remotion draws nothing of its own here except the speaker's circle: it plays the
// recording, and under it the deck clip the timeline says is showing.
//
//   build/timeline.json     what shows when (from the slide notes, by tools/align.mjs)
//   build/public/deck/      one clip + one still per slide change or click (tools/record-deck.mjs)
//   media/take.mp4          the recording: picture for the speaker, sound for everything
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile } from "remotion";
import timeline from "../../build/timeline.json";
import deck from "../../build/public/deck/index.json";
import { Speaker } from "./Speaker";

export const FPS = 30;
export type Corner = "br" | "bl" | "tr" | "tl";
export interface Mark {
  atMs: number;
  show: string; // "head" | "deck"
  slide?: number;
  click?: number;
  pip?: string;
}
const marks: Mark[] = timeline.events;
const frameOf = (ms: number) => Math.round((ms * FPS) / 1000);
const total = frameOf(timeline.durationMs);
const fill = { width: "100%", height: "100%" } as const;

// One slide change or click: its clip plays, then its last frame holds until the next mark.
const DeckMark = ({ name, length }: { name: string; length: number }) => {
  const frames = (deck as Record<string, { frames: number }>)[name].frames;
  return (
    <>
      <Img src={staticFile(`deck/${name}.jpg`)} style={fill} />
      {frames > 0 && (
        <Sequence durationInFrames={Math.min(frames, length)}>
          <OffthreadVideo src={staticFile(`deck/${name}.mp4`)} style={fill} muted />
        </Sequence>
      )}
    </>
  );
};

export const Video = () => (
  <AbsoluteFill style={{ background: "#231f33" }}>
    {marks.map((m, i) => {
      if (m.show === "head") return null; // the speaker covers the frame
      const from = frameOf(m.atMs);
      const length = (i + 1 < marks.length ? frameOf(marks[i + 1].atMs) : total) - from;
      return (
        <Sequence key={i} from={from} durationInFrames={length}>
          <DeckMark name={`s${m.slide}-c${m.click}`} length={length} />
        </Sequence>
      );
    })}
    <Speaker marks={marks} />
  </AbsoluteFill>
);
