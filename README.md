# Slidev video starter

A 52-second example of a talking-head video where the graphics are slides. The speaker reads the
slides' notes to camera. The code, diagrams and callouts are a [Slidev](https://sli.dev) deck. A script
records each slide click as a small video, and [Remotion](https://remotion.dev) plays those clips
on the words they belong to, with the speaker in a corner circle.

`out/example.mp4` is the finished example, at reduced quality. `npm run all` makes the full one,
`out/video.mp4`.

## What's where

| Folder | | What's in it |
|---|---|---|
| `deck/` | **you write** | `slides.md`: the slides, and under each one its speaker notes, which are the script. `style.css` is the look. Screen recordings go in `deck/public/clips/` and play on a slide |
| `media/` | **you provide** | `take.mp4`, the recording of you reading the notes. `take.words.json` is its transcript (made by `npm run words`) |
| `out/` | **you get** | `video.mp4` |
| `tools/` | the machinery | Three scripts and the Remotion project (`tools/video/`) |
| `build/` | scratch | Everything worked out along the way: the timeline and the deck clips. Safe to delete |

## Run it

Needs Node 20+, `ffmpeg` on the path, and Google Chrome installed (the deck is recorded in it).

    npm install        # also installs the deck's packages

    npm run all        # → out/video.mp4 (about two minutes)
    npm run slides     # look at the deck in a browser, click through it
    npm run preview    # the video in Remotion Studio: scrub and tweak (after `npm run all`)

`npm run all` is three steps, which also run alone:

| Step | Reads | Writes |
|---|---|---|
| `npm run align` | the notes in `deck/slides.md`, `media/take.words.json` | `build/timeline.json`: what shows when |
| `npm run deck` | `deck/`, `build/timeline.json` | `build/public/deck/`: a clip and a still per slide change or click |
| `npm run render` | `media/take.mp4`, `build/` | `out/video.mp4` |

## Make your own

1. **Build the deck** in `deck/slides.md` (`npm run slides`). One slide per idea, one click per
   thing you'll point at. Slidev does the code: stepped line highlights, one block morphing into
   another, callouts popping in. A screen recording is a slide too: `<Clip src="name.mp4" />` plays
   a file from `deck/public/clips/`, and `at="1"` starts it on a click. The five slides here show each.
2. **Write what you'll say as each slide's notes:** the comment at the end of the slide. Put
   `[click]` in front of each word that should advance the slide. This is Slidev's own notation,
   so presenter view (the speaker icon in `npm run slides`) shows your script and follows the
   clicks: you can read from it.
3. **Record yourself** reading the notes. Cut the mistakes in any editor and export one file to
   `media/take.mp4`.
4. **Get the word timings:** `OPENAI_API_KEY=… npm run words` (OpenAI's Whisper; the only step
   that needs a key). It prints what it heard. Make
   the notes say the same words (the marks are matched to them).
5. **Add the other marks** where you need them:

   | Mark | What it does |
   |---|---|
   | (none) | The slide comes on at the first word of its notes |
   | `[show]` | The slide comes on here instead, when its notes start before it should appear |
   | `[click]` | The slide's next click |
   | `[head]` | The speaker, full frame |

   The speaker's circle sits bottom right. `pip: tr` in a slide's frontmatter moves it for that
   slide (`tl`, `tr`, `bl`, `br`).

6. **`npm run all`** aligns the marks, records the deck clips and renders the video.

To change a timing, move a mark in the notes and run `npm run all` again. To change a slide, edit
it and do the same. Nothing holds a time by hand.

## How the deck gets recorded

`tools/record-deck.mjs` opens the deck in a headless browser and, for each deck mark in order,
goes to that slide and click and takes a screenshot per frame until the slide stops moving. The
browser runs on a clock the script controls, so each frame is exactly 1/30 s after the last
however long the screenshot took. Three things follow from recording in order:

- A clip starts from wherever the mark before it left the slide.
- If the next mark lands before a slide has stopped moving, the clip ends there and the next one
  carries on from that point, so fast clicks don't snap.
- When the deck comes on after the speaker was full frame, it arrives already settled.

A screen recording on a slide is stepped the same way, one frame per screenshot, so it stays in
sync with everything else on the slide.

## Things to change first

- **Your face in the circle:** `FACE`, `ZOOM` and `SIZE` at the top of `tools/video/Speaker.tsx`.
- **The look:** colours and fonts in `deck/style.css`.
- **The label at the top left of each slide** (`<div class="feat">`) names the Slidev technique
  the slide shows. Delete them in a real video.

## Not in here

Name cards, end cards, captions, zooms on screen recordings, colour grading and sound clean-up.
The example is the middle of a longer video, so it starts and ends mid-thought.
