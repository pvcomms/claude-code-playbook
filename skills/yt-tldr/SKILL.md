---
name: yt-tldr
description: Summarize a YouTube video from its transcript. Trigger when the user pastes any YouTube URL (youtube.com/watch, youtu.be/, youtube.com/shorts/, /live/, /embed/) and asks for a TLDR, ELI5, summary, recap, explanation, key points, or "what's this video about". Also trigger when the user shares a YouTube link without explicit ask — default to summarizing. Do NOT trigger for non-YouTube video URLs (Vimeo, Twitch, etc.).
---

# yt-tldr

Given a YouTube URL, fetch the transcript and produce a four-part digest.

## How to run

1. Extract the YouTube URL from the user's message. Accept any of: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/live/`, `youtube.com/embed/`. Strip surrounding quotes/whitespace. If multiple URLs, process the first; mention the others were ignored.
2. Run the fetcher:
   ```bash
   python3 ~/.claude/skills/yt-tldr/fetch_transcript.py "<URL>"
   ```
   Stdout is a JSON object: `{title, channel, duration, url, transcript, word_count}`.
3. If the fetcher exits non-zero, report the stderr message verbatim and stop. Common causes: no English captions, private/age-gated video, network error. Do not fall back to guessing — say you couldn't get the transcript and ask the user to try a different video or paste the transcript directly.
4. Read the `transcript` field and produce the output below. Do NOT dump the raw transcript back to the user.

## Output format

Use this exact structure, no preamble:

```
**<title>** — <channel> · <mm:ss or h:mm:ss>

### TL;DR
<1–2 sentences. The single sharpest takeaway. No hedging.>

### ELI5
<2–4 sentences in plain language. Use a concrete analogy if the topic is abstract. No jargon; if a term is unavoidable, define it inline.>

### Summary
<5–9 tight bullets tracing the video's actual arc. Each bullet is one idea, ≤20 words. Preserve the speaker's claims — don't editorialize. If the video makes numeric claims, keep the numbers.>

### Key takeaways
<3–5 bullets: what to remember / what to do with this. Actionable > descriptive.>

### Worth watching?
<One line. Who should watch it in full vs. who can stop here. Be honest — if it's padded or shallow, say so.>
```

## Rules

- Match the language of the transcript for the body. If the transcript is non-English, produce output in that language AND English. If no English captions exist, the fetcher will fail — don't try to translate from nothing.
- Music-only / lyric videos: note that the "transcript" is lyrics and give a one-paragraph vibe summary instead of the full structure.
- Shorts (<90s): collapse to just TL;DR + one-line "why it's interesting". Skip the rest.
- Long videos (>1hr): the Summary section can grow to 10–14 bullets but should still be scannable.
- No emojis. No trailing "hope this helps". No meta-commentary about the summary itself.
- Duration formatting: `mm:ss` under an hour, `h:mm:ss` over.

## Dependencies

Requires `yt-dlp` on PATH (installed via `brew install yt-dlp`). If the fetcher reports `yt-dlp: command not found`, tell the user to install it and stop.
