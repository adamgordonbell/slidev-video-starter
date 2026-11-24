// Step 3: the deck → one small video per slide change or click, in build/public/deck/.
//
// Opens the deck in a headless browser, and for every deck mark in timeline.json goes to that slide
// and click and saves the motion that follows, frame by frame, until the slide stops moving (or the
// next mark arrives). Each clip also gets a still of its last frame, which holds until the next mark.
//
// The browser runs on a clock this script controls (CLOCK below), not the real one: a frame is what
// the slide shows exactly k/30 s after the click, however long the screenshot took. That is what
// makes the clips smooth and the same on every run.
import { chromium } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const FPS = 30, W = 1920, H = 1080, MAX_FRAMES = FPS * 6;
const OUT = "build/public/deck", TMP = "build/frames";
const { events } = JSON.parse(fs.readFileSync("build/timeline.json", "utf8"));
const frameOf = (ms) => Math.round((ms * FPS) / 1000);

// Runs in the page before the deck does. Timers, requestAnimationFrame, Date and performance.now
// read `now`, which only moves when advance() is called; CSS and Web animations are paused and set
// to that same time before each screenshot.
const CLOCK = `(() => {
  const RealDate = Date, epoch = RealDate.now(), realTimeout = setTimeout;
  let now = 0, seq = 1;
  const timers = new Map(), rafs = new Map();
  window.setTimeout = (fn, ms, ...a) => { const id = seq++; timers.set(id, { at: now + Math.max(0, +ms || 0), fn, a, every: 0 }); return id; };
  window.setInterval = (fn, ms, ...a) => { const id = seq++; const every = Math.max(1, +ms || 0); timers.set(id, { at: now + every, fn, a, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { const id = seq++; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  performance.now = () => now;
  window.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(epoch + now); }
    static now() { return epoch + now; }
  };
  const flush = () => new Promise((r) => realTimeout(r, 0));
  const seek = () => {
    for (const a of document.getAnimations()) {
      if (a.__t0 === undefined) { a.__t0 = now; a.pause(); }
      a.currentTime = now - a.__t0;
    }
  };
  const call = (fn, a) => { try { fn(...a); } catch (e) { console.error(e); } };
  // A <video> plays on the real clock whatever this script does, so it is never allowed to play: each
  // one a slide has started (deck/components/Clip.vue marks when) is set to where it would be by now.
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  const started = () => [...document.querySelectorAll('video[data-started-at]')];
  const videoTime = (v) => Math.min((now - +v.dataset.startedAt) / 1000, Math.max(0, v.duration - 0.02));
  const seekVideos = () => Promise.all(started().map((v) => new Promise((done) => {
    const t = videoTime(v) + 1 / 120; // just inside the frame, not on its edge
    if (Math.abs(v.currentTime - t) < 1e-4) return done();
    v.addEventListener('seeked', done, { once: true });
    realTimeout(done, 2000);
    v.currentTime = t;
  })));
  window.__clock = {
    flush, seek, seekVideos,
    // move the clock on by dt ms: fire the timers that come due, in order, then one animation frame
    async advance(dt) {
      const end = now + dt;
      for (;;) {
        let next = null;
        for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break;
        const [id, t] = next;
        now = Math.max(now, t.at);
        if (t.every) t.at += t.every; else timers.delete(id);
        call(t.fn, t.a);
        await flush(); seek();
      }
      now = end;
      const due = [...rafs.values()]; rafs.clear();
      for (const fn of due) call(fn, [now]);
      await flush(); seek();
    },
    // is anything still moving?
    busy() {
      const anims = document.getAnimations().some((a) => now - (a.__t0 ?? now) < (a.effect?.getComputedTiming().endTime ?? 0));
      const timeouts = [...timers.values()].some((t) => !t.every);
      const videos = started().some((v) => (now - +v.dataset.startedAt) / 1000 < v.duration);
      return anims || rafs.size > 0 || timeouts || videos;
    },
  };
})();`;

// the deck, served by Slidev itself, on a port nothing else is using
const PORT = await new Promise((done) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => done(port)); });
});
const server = spawn("npx", ["slidev", "slides.md", "--port", String(PORT)], { cwd: "deck", stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);
const url = `http://localhost:${PORT}`;
for (let i = 0; ; i++) {
  if (await fetch(url).then((r) => r.ok, () => false)) break;
  if (i > 120) throw new Error("Slidev didn't start. Try `npm run slides` to see why.");
  await new Promise((r) => setTimeout(r, 500));
}

// Your installed Chrome, not the browser Playwright can download: that one can't play H.264, which is
// what most screen recordings are. --disable-threaded-animation: every animation runs where the clock
// can pause it.
const browser = await chromium.launch({ channel: "chrome", args: ["--disable-threaded-animation"] }).catch((e) => {
  throw new Error(`Couldn't start Google Chrome (it needs to be installed): ${e.message}`);
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => e.message.includes("Wake Lock") || console.error("page error:", e.message));
// installed Chrome takes some of the window for itself: make the page exactly the video's size
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await page.addInitScript(CLOCK);
await page.goto(`${url}/1`);
if (!(await page.title()).includes("Slidev video starter")) throw new Error(`${url} is serving some other deck`);
const advance = (ms) => page.evaluate((ms) => window.__clock.advance(ms), ms);
const busy = () => page.evaluate(() => window.__clock.busy());
// let Slidev start: run the clock alongside real time until its navigation exists (deck/setup/root.ts)
for (let i = 0; i < 600; i++) {
  await advance(20);
  if (i > 50 && (await page.evaluate(() => !!window.__nav))) break;
  await page.waitForTimeout(10);
}
if (!(await page.evaluate(() => !!window.__nav))) throw new Error("The deck never exposed window.__nav (see deck/setup/root.ts).");
await page.evaluate(() => document.fonts.ready);
// Slidev's own controls have no place in a video
await page.addStyleTag({ content: "#slidev-goto-dialog, .slidev-nav, .slidev-icon-btn { display: none !important; }" });
const settle = async () => { for (let i = 0; i < 600 && ((await busy()) || i < 5); i++) await advance(20); };
// Go to a slide and click. Slidev loads a slide's content when it is first needed, and that takes
// real time, so wait (with the clock stopped) until the slide is really there: a recording must not
// start on "Loading slide...".
const go = async (slide, click) => {
  await page.evaluate(([slide, click]) => { window.__nav.go(slide, click); }, [slide, click]);
  for (let i = 0; ; i++) {
    const there = await page.evaluate(async (slide) => {
      await window.__clock.flush();
      const el = document.querySelector(`.slidev-page-${slide}`);
      const videos = [...(el?.querySelectorAll("video") ?? [])].every((v) => v.readyState >= 2);
      return !!el?.querySelector(".slidev-layout") && !el.innerText.includes("Loading slide") && videos;
    }, slide);
    if (there) break;
    if (i > 400) throw new Error(`Slide ${slide} never loaded.`);
    await page.waitForTimeout(25);
  }
  await page.evaluate(() => window.__clock.seek());
};
// visit every slide once up front, so its code is already loaded when the recording gets to it
for (const slide of [...new Set(events.filter((e) => e.show === "deck").map((e) => e.slide))]) {
  await go(slide, 0);
  await settle();
}
const shot = async (file) => {
  await page.evaluate(() => window.__clock.seekVideos());
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 95 });
  fs.writeFileSync(file, Buffer.from(data, "base64"));
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const index = {};
let onScreen = false; // was the deck showing just before this mark?
for (let i = 0; i < events.length; i++) {
  const e = events[i];
  if (e.show !== "deck") { onScreen = false; continue; }
  const name = `s${e.slide}-c${e.click}`;
  const next = events[i + 1];
  const gap = next ? frameOf(next.atMs) - frameOf(e.atMs) : MAX_FRAMES;
  const dir = path.join(TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let frames = 0;
  if (!onScreen) {
    // The deck comes on from the speaker or a clip: it arrives already settled, so the viewer doesn't
    // see it leaving a slide they never saw. One still, no motion.
    await go(e.slide, e.click);
    await settle();
  } else {
    await go(e.slide, e.click);
    // record until the slide is still, or the next mark is due (that mark then picks up mid-motion)
    for (; frames < Math.min(gap, MAX_FRAMES); frames++) {
      await shot(path.join(dir, `${String(frames).padStart(4, "0")}.jpg`));
      await advance(1000 / FPS);
      if (frames > 2 && !(await busy())) { frames++; break; }
    }
    if (next?.show !== "deck") await settle();
    else if (frames === gap && (await busy())) console.log(`  ${name}: still moving when the next mark lands (${gap} frames later); the next clip carries on from there`);
  }
  await shot(path.join(OUT, `${name}.jpg`));
  if (frames > 1) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(dir, "%04d.jpg"),
      "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, `${name}.mp4`)]);
  }
  index[name] = { frames: frames > 1 ? frames : 0 };
  console.log(`${name}  ${frames > 1 ? `${frames} frames` : "still"}`);
  onScreen = true;
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
await browser.close();
stop();
process.exit(0);
