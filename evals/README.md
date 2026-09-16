# Evals Suite

Five harnesses measuring different dimensions of the Claude Code stack.
`results/leaderboard.json` holds scored runs for three of them. `eval-this` and
`yt-tldr-eval` ship the harness and no committed results — run them yourself.

---

## eval-this

**Multi-model prompt bake-off.** One prompt → 5 frontier models → scored table.

Models: Claude Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-5, Gemini 2.5 Pro  
Judge: Opus 4.7 scores accuracy / clarity / depth / style (1–10)  
Output: markdown table + full responses

```bash
source ~/.config/your-env.env
~/.claude/skills/eval-this/eval.py "your prompt here"
```

---

## voice-preservation-eval

**How many rewrites before a model loses Param's voice?**

N-iteration rewrite chain per model, Opus 4.7 judges voice drift vs seed essay.  
Scores: fingerprint match / coined-phrase survival / banned-phrase leak / swap-test pass rate  
Seeds: 12-essay corpus in `skills/param-voice/references/`

```bash
source ~/.config/your-env.env
~/.claude/skills/voice-preservation-eval/eval.py -n 5 --essay 1
```

---

## claude-code-hook-eval

**Measure wall-clock time saved by each Claude Code hook.**

Parses `~/.claude/settings.json`, mines transcript JSONLs for fire counts,
benchmarks real execution latency, applies a class-aware savings model.  
Classes: formatter / guard / notify / logger / custom  
Output: per-hook latency, fires/week, seconds saved/spent/net, ROI, verdict

```bash
~/.claude/skills/claude-code-hook-eval/eval.py --days 14
```

---

## mcp-tool-selection-eval

**Does the model pick the right MCP tool on the first call?**

77 tools in one menu (`tools.json`). 31 gold-labeled cases (`testcases.jsonl`).  
Categories: direct (7), semantic (12), ambiguous (7), negative (5)  
Result of the shipped run, in `skills/mcp-tool-selection-eval/run1-report.md`:
Sonnet 4.6 77%, Haiku 4.5 71%, Opus 4.7 68%, GPT-5 61%, Gemini 2.5 Pro 42%.

Every model scored 5/5 on the negative cases and lost most of its points on
semantic matches. Opus finishing below Haiku on 31 cases is inside the noise —
it is not evidence that Haiku is better, it is evidence that 31 cases is too few.

```bash
source ~/.config/your-env.env
~/.claude/skills/mcp-tool-selection-eval/eval.py
```

---

## yt-tldr-eval

**Multi-video summarization bake-off across 5 models.**

Metrics: faithfulness / compression ratio / key-point coverage / style fit + hallucination list  
Judge: Claude Haiku 4.5 — `eval.py:81`, despite what `SKILL.md` says about Opus  
`--videos` is required and no video list is committed. Build one with
`build_video_list.sh` first. Budget ~$40 for 100 videos across all 5 models.

```bash
source ~/.config/your-env.env
~/.claude/skills/yt-tldr-eval/build_video_list.sh > videos.json
~/.claude/skills/yt-tldr-eval/eval.py --videos videos.json
```

---

## Leaderboard

`results/leaderboard.json` aggregates three of the five. Its
`mcp_tool_selection_v2` block records an earlier 44-tool / 50-query run that the
harness in this repo does not reproduce — `run1-report.md` is the run you can
actually re-execute from these files.
