---
name: yt-tldr-eval
description: Multi-video benchmark of yt-tldr summarization across Claude Opus/Sonnet/Haiku, GPT-5, and Gemini 2.5 Pro — with Opus-as-judge scoring faithfulness, compression, coverage, and style. Extends eval-this and yt-tldr. Triggers on "yt-tldr-eval", "benchmark yt summaries", "which model summarizes YouTube best", "run 100 videos through all models", or when the user asks to grade models on long-form transcript compression. Also on `/yt-tldr-eval`.
---

# yt-tldr-eval

YouTube summarization bake-off across 5 frontier models. Built on top of `yt-tldr` (transcript fetch + summary structure) and `eval-this` (multi-model + Opus judge pattern).

## When to invoke

- "run yt-tldr-eval"
- "benchmark yt summaries"
- "which model summarizes youtube best"
- "100 videos, claude vs gpt vs gemini"
- "grade models on yt transcripts"
- `/yt-tldr-eval`

## What it does

1. Loads a list of YouTube URLs (`videos.json`)
2. **Phase 1**: fetches transcripts via `yt-dlp` (parallel, resumable)
3. **Phase 2**: sends each transcript + the yt-tldr prompt to 5 models in parallel
   - `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
   - `gpt-5`
   - `gemini-2.5-pro`
4. **Phase 3**: Opus 4.7 judges each summary against the transcript on 4 dimensions
   - **faithfulness**: zero hallucination, load-bearing claims match transcript
   - **compression**: signal-to-noise, ruthless condensation without losing content
   - **coverage**: hits the video's key arc, numbers, and named entities
   - **style**: crisp prose, follows the requested structure
   - also returns an array of specific hallucinations and missed points
5. **Phase 4**: aggregates into a markdown report:
   - leaderboard (avg scores)
   - reliability (error rates)
   - cost breakdown
   - faithfulness by video length (short/medium/long)
   - sample hallucinations per model
   - per-video score matrix

## How to run

```bash
# Default: 100-video benchmark with all 5 models + Opus judge
source ~/.config/inbox-triage.env && \
  ~/.claude/skills/yt-tldr-eval/eval.py \
    --videos /Users/p/Code/yt-tldr-eval/videos.json \
    --out    /Users/p/Code/yt-tldr-eval/run_$(date +%Y%m%d_%H%M%S)

# Smoke test (5 videos)
~/.claude/skills/yt-tldr-eval/eval.py --videos videos.json --out smoke --limit 5

# Only Claude models (skip GPT and Gemini)
~/.claude/skills/yt-tldr-eval/eval.py --videos videos.json --out run --models opus,sonnet,haiku

# Skip judging (phases 1+2 only)
~/.claude/skills/yt-tldr-eval/eval.py --videos videos.json --out run --skip-judge

# Fetch transcripts only (phase 1)
~/.claude/skills/yt-tldr-eval/eval.py --videos videos.json --out run --transcripts-only
```

### Background (overnight) run

```bash
source ~/.config/inbox-triage.env && \
  nohup ~/.claude/skills/yt-tldr-eval/eval.py \
    --videos /Users/p/Code/yt-tldr-eval/videos.json \
    --out    /Users/p/Code/yt-tldr-eval/run1 \
    > /Users/p/Code/yt-tldr-eval/run1.stdout 2>&1 &
echo "PID: $!"
```

Check progress: `tail -f /Users/p/Code/yt-tldr-eval/run1/run.log`

## Regenerating the 100-video list

`videos.json` is sourced from 20 curated channels × 5 most-recent videos each. To refresh:

```bash
~/.claude/skills/yt-tldr-eval/build_video_list.sh > /Users/p/Code/yt-tldr-eval/videos.json
```

Channels cover AI/ML (Lex Fridman, Dwarkesh, AI Explained, Two Minute Papers, Machine Learning Street Talk), startup (YC, 20VC, a16z, All-In), explainers (Veritasium, Kurzgesagt, 3b1b, CGP Grey), product (MKBHD, Wendover), culture (Philosophy Tube, Vox, How Money Works), and long-form (SmarterEveryDay, Tom Scott).

## Design decisions

- **Opus as judge, same as eval-this.** The judge sees the raw transcript as ground truth (truncated to 8k words for cost) and grades against it. This is the whole point — a faithfulness check needs access to truth.
- **Transcripts truncated to 12k words for summarizer input** (~16k tokens). Covers ~95% of YT videos whole; longer videos get head-2/3 + tail-1/3 with an explicit `[...TRUNCATED...]` marker.
- **GPT-5 gets 6000 max_completion_tokens** because hidden reasoning eats 1-3k tokens before visible output starts. Claude and Gemini cap at 1500 visible.
- **Resumable everywhere.** Transcripts, summaries, and scores each serialize to `transcripts/`, `summaries/`, `scores/` as `<video_id>__<model>.json`. Re-run to continue where it left off. Errored summaries are NOT cached (so re-runs retry them); successful summaries ARE cached (so re-runs don't re-bill).
- **Not cached: judge verdicts for errored summaries.** So fix the model call, re-run, judge runs cleanly.

## Requirements

Same as eval-this:

- `ANTHROPIC_API_KEY` (also used for judge)
- `OPENAI_API_KEY`
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

Plus `yt-dlp` on PATH (`brew install yt-dlp`).

Keys live in `~/.config/inbox-triage.env`. Source inline when running through Claude Code:

```bash
source ~/.config/inbox-triage.env && ~/.claude/skills/yt-tldr-eval/eval.py ...
```

## Cost ballpark

- 100 videos × 5 models × avg 12k in + 500 out tokens = ~$40 across all 5 models
- 500 judge calls on Opus × avg 10k in + 400 out = ~$80
- **Grand total: ~$120** for the full 100-video benchmark

For smaller runs, cost scales roughly linearly. Smoke test (5 videos) ~$6.

## Output shape

`<out>/report.md` — human-readable leaderboard + reliability + hallucination samples + per-video matrix.
`<out>/summary.json` — machine-readable scores.
`<out>/run.log` — timestamped phase log.
`<out>/transcripts/*.json`, `<out>/summaries/*.json`, `<out>/scores/*.json` — every raw artifact, reusable.

## After the run

Do not add a trailing summary — the report is the deliverable. If the user asked a specific question ("which model was best for long interviews?", "how bad are haiku's hallucinations?"), answer it in one paragraph below the report, grounded in the score tables.
