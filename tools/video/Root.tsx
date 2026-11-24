import { Composition } from "remotion";
import timeline from "../../build/timeline.json";
import { FPS, Video } from "./Video";

export const Root = () => (
  <Composition
    id="Video"
    component={Video}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={Math.round((timeline.durationMs * FPS) / 1000)}
  />
);
