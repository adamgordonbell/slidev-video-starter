// The speaker: one video, playing for the whole length (it is also the sound). On a "head" mark it
// fills the frame; on any other mark it shrinks into a circle in a corner. Moving between the two is
// the same element changing shape, so the picture never jumps.
import { Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { FPS, type Mark } from "./Video";

// Where the face is in the recording (0–1 across, 0–1 down), and how the circle looks.
// Change FACE for a different camera framing.
const FACE = { x: 0.595, y: 0.33 };
const SIZE = 300; // the circle's diameter, px
const MARGIN = 48; // gap from the frame's edge
const ZOOM = 0.46; // the recording's scale inside the circle
const MOVE = 14; // frames a change of shape or corner takes
const W = 1920, H = 1080;

interface Box { x: number; y: number; w: number; h: number; r: number; vw: number; vx: number; vy: number; ring: number }
const FULL: Box = { x: 0, y: 0, w: W, h: H, r: 0, vw: W, vx: 0, vy: 0, ring: 0 };
const circle = (corner: string): Box => ({
  x: corner.endsWith("l") ? MARGIN : W - MARGIN - SIZE,
  y: corner.startsWith("t") ? MARGIN : H - MARGIN - SIZE,
  w: SIZE, h: SIZE, r: SIZE / 2,
  vw: W * ZOOM, vx: SIZE / 2 - FACE.x * W * ZOOM, vy: SIZE / 2 - FACE.y * H * ZOOM,
  ring: 1,
});
const boxOf = (m: Mark) => (m.show === "head" ? FULL : circle(m.pip ?? "br"));

export const Speaker = ({ marks }: { marks: Mark[] }) => {
  const frame = useCurrentFrame();
  const starts = marks.map((m) => Math.round((m.atMs * FPS) / 1000));
  let i = 0;
  while (i + 1 < marks.length && starts[i + 1] <= frame) i++;
  const to = boxOf(marks[i]);
  const from = i > 0 ? boxOf(marks[i - 1]) : to;
  const p = interpolate(frame - starts[i], [0, MOVE], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
  });
  const mix = (k: keyof Box) => from[k] + (to[k] - from[k]) * p;
  return (
    <div
      style={{
        position: "absolute", left: mix("x"), top: mix("y"), width: mix("w"), height: mix("h"),
        borderRadius: mix("r"), overflow: "hidden",
        boxShadow: `0 0 0 ${5 * mix("ring")}px #a697fc, 0 16px 44px rgba(0, 0, 0, ${0.5 * mix("ring")})`,
      }}
    >
      <OffthreadVideo
        src={staticFile("media/take.mp4")}
        style={{ position: "absolute", left: mix("vx"), top: mix("vy"), width: mix("vw"), maxWidth: "none" }}
      />
    </div>
  );
};
