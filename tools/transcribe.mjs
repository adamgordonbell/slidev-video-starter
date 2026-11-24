// Step 1: media/take.mp4 → media/take.words.json, the time every spoken word starts and ends.
// Uses OpenAI's Whisper (needs OPENAI_API_KEY). Any tool that gives word timestamps works: the only
// thing the rest needs is a list of { word, start, end } in seconds.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const take = "media/take.mp4";
const audio = "build/audio.mp3";
fs.mkdirSync("build", { recursive: true });
if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY first.");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", take, "-vn", "-ac", "1", "-b:a", "64k", audio]);

const form = new FormData();
form.append("file", new Blob([fs.readFileSync(audio)]), "audio.mp3");
form.append("model", "whisper-1");
form.append("response_format", "verbose_json");
form.append("timestamp_granularities[]", "word");
const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: form,
});
if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
const { words, text } = await res.json();
fs.writeFileSync("media/take.words.json", JSON.stringify(words, null, 1));
console.log(`${words.length} words → media/take.words.json\n\n${text}`);
