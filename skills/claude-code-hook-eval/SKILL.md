---
name: claude-code-hook-eval
description: Measure the actual wall-clock time saved by each hook in ~/.claude/settings.json. Parses hook config, mines ~/.claude/projects/**/*.jsonl transcripts to count how often each matcher has fired, benchmarks real execution latency with synthetic payloads, and applies a class-aware savings model (formatter/guard/notify/custom). Outputs a markdown report with per-hook latency, fires-per-week, seconds saved/spent/net, ROI, and a keep/tune/drop verdict. Use when the user says "hook eval", "measure my hooks", "are my hooks worth it", "is prettier hook slow", "time saved per hook", "audit my Claude Code hooks". Triggers on `/claude-code-hook-eval`.
---

# claude-code-hook-eval

Meta-eval of your own Claude Code harness. For every hook in `settings.json`, it tells you:

- How often this hook actually fires, based on the last N days of transcripts
- How long the hook's command takes per fire, measured against a synthetic stdin payload
- How many seconds per fire the hook likely saves (with every assumption surfaced and overridable)
- Net weekly time saved minus time spent, and an ROI ratio
- A keep / tune / drop verdict

No magic. Every number comes from a measurement or a labeled assumption you can override with flags.

## When to invoke

User says:

- "hook eval" / "audit my hooks" / "claude-code-hook-eval"
- "which hooks are worth keeping?" / "is the prettier hook too slow?"
- "time saved per hook" / "ROI of my formatter"
- After configuring a new hook: "is my new hook actually helping?"
- Before shipping an article on hooks: needs measured numbers

## What it does

1. **Load** — parses `~/.claude/settings.json` (plus any extra files via `--extra`). Extracts every hook entry with event, matcher, command, and hook type.
2. **Classify** — each hook is tagged `formatter` (prettier/eslint/biome/ruff/rubocop), `guard` (exit-2 blockers on destructive commands), `notify` (afplay/osascript notification/say/terminal-notifier), `logger` (append-to-log patterns), or `custom`.
3. **Mine frequency** — walks `~/.claude/projects/**/*.jsonl` transcripts modified within `--days` (default 7). Counts `tool_use` blocks in assistant messages matching each hook's matcher. Projects to fires/week.
4. **Benchmark latency** — runs the hook's command `--runs` times (default 5) against a synthetic JSON payload that mirrors Claude Code's stdin contract (`tool_input`, `event`, `tool_name`). For formatter hooks the payload points at a temp scratch file so prettier/eslint actually execute end-to-end.
5. **Apply savings model** — per class:
   - `formatter` — `formatter_save_s × fires/week` (default 15s/fire: manual run + eyeball)
   - `guard` — `guard_save_s × guard_hit_rate × fires/week` (default 120s × 2% hit rate)
   - `notify` — `notify_save_s × notify_rate × fires/week` (default 8s × 60% away rate)
   - `logger` — 0 (loggers enable later audit, not current time save)
   - `custom` — `--custom-save-s` if supplied, else 0 (verdict reads "unknown")
6. **Render** — markdown report with summary table, per-hook detail (command, samples, assumptions), totals, and a methodology section.

## How to run

```bash
# Default: all hooks in ~/.claude/settings.json, 7-day lookback, 5 benchmark runs
~/.claude/skills/claude-code-hook-eval/eval.py

# Broader window, more runs for tighter latency CI
~/.claude/skills/claude-code-hook-eval/eval.py --days 14 --runs 10

# Include a project-level settings file
~/.claude/skills/claude-code-hook-eval/eval.py --extra ~/Code/keep/.claude/settings.json

# Tune the savings assumptions (e.g. you think formatter saves 30s, not 15s)
~/.claude/skills/claude-code-hook-eval/eval.py --formatter-save-s 30

# Be stricter on guards (hit rate 0.5%, not 2%)
~/.claude/skills/claude-code-hook-eval/eval.py --guard-hit-rate 0.005

# Skip latency benchmarks (frequency + savings only)
~/.claude/skills/claude-code-hook-eval/eval.py --no-bench

# Save report to disk
~/.claude/skills/claude-code-hook-eval/eval.py --save reports/hook-eval-$(date +%F).md
```

All override flags (with defaults):

| Flag                 | Default | Meaning                                       |
| -------------------- | ------- | --------------------------------------------- |
| `--formatter-save-s` | 15.0    | Seconds saved per formatter fire              |
| `--guard-save-s`     | 120.0   | Cost of a disaster averted                    |
| `--guard-hit-rate`   | 0.02    | Fraction of matched fires that would be bad   |
| `--notify-save-s`    | 8.0     | Switching cost saved per notification fire    |
| `--notify-rate`      | 0.6     | Fraction of fires where the user was away     |
| `--custom-save-s`    | 0.0     | Seconds saved per fire for unclassified hooks |

## Output shape

```
# claude-code-hook-eval

**Window:** last 7 days of transcripts
**Hooks measured:** 3

## Summary

| Hook                                  | Kind      | Fires/wk | Lat mean | p95   | Saved/fire | Spent/wk | Saved/wk | Net/wk  | Verdict                |
|---------------------------------------|-----------|---------:|---------:|------:|-----------:|---------:|---------:|--------:|------------------------|
| PostToolUse[Write|Edit] — prettier    | formatter |   2858.3 |  1059ms  | 1400  | 15.0s      | 50.4m    | 714.6m   | 664.2m  | keep — clear time-save |
| PreToolUse[Bash] — destructive guard  | guard     |   6209.0 |    17ms  |   22  |  2.4s      |  1.7m    | 248.4m   | 246.6m  | keep — clear time-save |
| Stop[*] — Glass.aiff                  | notify    |   1673.0 |  2404ms  | 2800  |  4.8s      | 67.0m    | 133.8m   |  66.8m  | keep — clear time-save |

**Totals per week** — saved 1096.8m, spent 119.2m, net 977.6m.

## Per-hook detail
[command, latency samples, fires/week, assumptions, savings, cost, net, ROI, verdict]

## Methodology & caveats
[how frequency is counted, what the synthetic payload looks like, how to argue with the numbers]
```

## When to trust (and not trust) the verdict

**Trust:**

- Fires/week — directly mined from transcripts with no modeling.
- Latency mean/p95 — actually measured against a real payload.
- Verdict when the delta is clearly lopsided (ROI > 5x or < 0.5x).

**Don't trust blindly:**

- Savings per fire — these are class-level heuristics. Override them. A prettier hook saves more than 15s if it stops you going into a debugging spiral on a syntax error, and saves less if you were going to git-commit anyway.
- Notify hooks — `async: true` notifications don't actually block the turn, but the script still benchmarks them synchronously. The "spent" number overstates the real cost.
- Complex regex matchers — the script approximates matcher semantics with pipe-splitting. A matcher like `Write|Edit|MultiEdit` counts correctly; one with capture groups may under-count.

The whole point: **you can argue with every cell in the table because every input is labelled**. This is what eval tools should look like.

## Publishable angle

If the user is writing about hooks (blog post, essay, conference talk), run this first. Real numbers — "my prettier hook fires 2,858 times a week and saves 11.9 hours" — beat vibes-based hook advocacy. The measured ROI table is the deliverable.
