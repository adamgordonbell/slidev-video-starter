// Step 2: the deck's speaker notes + media/take.words.json → build/timeline.json.
// The script is the notes under each slide in deck/slides.md: the words said while that slide is the
// current one, with marks in square brackets in front of the word they fire on. This finds each
// mark's word in the recording and writes down when it is said. Re-run after any change to the notes
// or a new recording; nothing else holds a time.
//
//   (no mark)   the slide comes on at the first word of its notes...
//   [show]      ...or here instead, when the notes start before the slide should appear
//   [click]     the slide's next click (Slidev's own notation: presenter view follows it too)
//   [head]      the speaker, full frame
// A slide's frontmatter can say which corner the speaker's circle sits in: `pip: tr` (or tl, bl, br).
import fs from "node:fs";
import path from "node:path";

const LEAD_MS = 150; // a visual lands slightly before its word, never after
const words = JSON.parse(fs.readFileSync("media/take.words.json", "utf8"));
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
// Slidev's own parser reads the deck, so a note here is exactly what presenter view shows
const { parse } = await import("../deck/node_modules/@slidev/parser/dist/index.mjs");
const deck = await parse(fs.readFileSync("deck/slides.md", "utf8"), "deck/slides.md");

// the notes as one list of words and marks, in order
const tokens = [];
const pipOf = {}; // slide number → the circle's corner
deck.slides.forEach((s, i) => {
  pipOf[i + 1] = s.frontmatter?.pip ?? "br";
  const note = s.note ?? "";
  const found = [...note.matchAll(/\[([^\]]+)\]|(\S+)/g)]
    .map((m) => (m[1] ? { mark: m[1].trim() } : { word: norm(m[2]) }))
    .filter((t) => t.mark || t.word)
    .map((t) => (t.mark?.split(/\s+/)[0] === "show" ? { mark: t.mark.replace(/^show/, `slide ${i + 1}`) } : t));
  if (found.length && !found.some((t) => t.mark?.startsWith("slide "))) found.unshift({ mark: `slide ${i + 1}` });
  tokens.push(...found);
});

const events = [];
let wi = 0; // next spoken word to match
let slide = 0, click = 0, pending = [];
for (const t of tokens) {
  if (t.mark) { pending.push(t.mark); continue; }
  // the script's word must be the next spoken word, or within a few of it (a filler word, a slip)
  let at = -1;
  for (let k = wi; k < Math.min(wi + 4, words.length); k++) if (norm(words[k].word) === t.word) { at = k; break; }
  if (at < 0) {
    if (pending.length) throw new Error(`Can't find "${t.word}" in the recording (for [${pending[0]}]). Heard near there: "${words.slice(wi, wi + 6).map((w) => w.word).join(" ")}"`);
    continue; // a word in the script that wasn't said: fine unless a mark sits on it
  }
  for (const mark of pending) {
    const [verb, n] = mark.split(/\s+/);
    const atMs = Math.max(0, Math.round(words[at].start * 1000) - LEAD_MS);
    const base = { atMs, word: words[at].word };
    if (verb === "head") events.push({ ...base, show: "head" });
    else if (verb === "slide") { slide = +n; click = 0; events.push({ ...base, show: "deck", slide, click, pip: pipOf[slide] }); } // from [show], or a slide's first word
    else if (verb === "click") { click += 1; events.push({ ...base, show: "deck", slide, click, pip: pipOf[slide] }); }
    else throw new Error(`Unknown mark [${mark}]`);
  }
  pending = [];
  wi = at + 1;
}
if (events[0]) events[0].atMs = 0;
for (let i = 1; i < events.length; i++)
  if (events[i].atMs <= events[i - 1].atMs) throw new Error(`[${JSON.stringify(events[i])}] is not after the mark before it`);

const durationMs = Math.round(words.at(-1).end * 1000) + 600;
fs.mkdirSync("build/public", { recursive: true });
fs.writeFileSync("build/timeline.json", JSON.stringify({ durationMs, events }, null, 1));
// Remotion plays files from one folder, build/public: link media/ into it (the deck's clips go beside it)
fs.rmSync("build/public/media", { force: true });
fs.symlinkSync(path.resolve("media"), "build/public/media");
for (const e of events) console.log(`${(e.atMs / 1000).toFixed(2).padStart(6)}s  ${e.show === "deck" ? `slide ${e.slide}:${e.click}` : "head"}  ← "${e.word}"`);
