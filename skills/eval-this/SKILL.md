---
name: eval-this
description: Run a prompt against Claude Opus 4.7, Sonnet 4.6, Haiku 4.5, OpenAI GPT-5, and Google Gemini 2.5 Pro in parallel, score each output with an Opus-as-judge rubric, and print a comparison table with latency, tokens, cost, and quality scores. Use when the user says "eval this", "eval this prompt", "compare models on X", "run this through all models", "which model is best for Y", "benchmark this prompt", or pastes a prompt and asks for a multi-model bake-off. Also trigger on `/eval-this` slash form.
---

# eval-this

Multi-model prompt bake-off. One prompt → 5 frontier models → scored comparison table.

## When to invoke

User says:

- "eval this: <prompt>" / "eval this prompt"
- "compare models on <task>"
- "run this through Opus, Sonnet, Haiku, GPT, and Gemini"
- "which model handles X best?"
- "benchmark this prompt"
- Pastes a prompt + asks for a model comparison

## What it does

1. Sends the same prompt in parallel to:
   - `claude-opus-4-7` (Anthropic)
   - `claude-sonnet-4-6` (Anthropic)
   - `claude-haiku-4-5-20251001` (Anthropic)
   - `gpt-5` (OpenAI)
   - `gemini-2.5-pro` (Google)
2. Captures latency, input/output tokens, and USD cost per call
3. Uses Opus 4.7 as judge to score each response on accuracy, clarity, depth, style (1-10) with a one-line verdict
4. Prints a markdown table, then the full outputs below

## How to run

The script is self-contained via `uv` inline deps — no venv setup needed.

```bash
# Positional arg
~/.claude/skills/eval-this/eval.py "your prompt here"

# From stdin
echo "your prompt" | ~/.claude/skills/eval-this/eval.py

# From file
~/.claude/skills/eval-this/eval.py --file prompt.txt

# Skip judge (just run the models)
~/.claude/skills/eval-this/eval.py --skip-judge "prompt"

# Hide full outputs, show table only
~/.claude/skills/eval-this/eval.py --no-outputs "prompt"

# Subset of models
~/.claude/skills/eval-this/eval.py --only anthropic "prompt"
~/.claude/skills/eval-this/eval.py --only opus,sonnet,gpt "prompt"
```

## Requirements

Environment variables:

- `ANTHROPIC_API_KEY` — required (also used for the judge)
- `OPENAI_API_KEY` — required for GPT
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` — required for Gemini

Missing keys: the corresponding model shows `ERROR: no API key` in its row, rest still run.

Param keeps keys in `~/.config/inbox-triage.env`. The script auto-reads that file when run directly from a terminal. **When invoking from Claude Code's Bash tool, sandbox blocks the auto-read — source the file inline instead:**

```bash
source ~/.config/inbox-triage.env && ~/.claude/skills/eval-this/eval.py "your prompt"
```

Keys needed in `~/.config/inbox-triage.env`:

```
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
```

## Output shape

```
# eval-this results

**Prompt:** <first 200 chars>

| Model | Latency | Tokens (in/out) | Cost | Acc | Clr | Dep | Sty | Avg | Verdict |
|-------|---------|-----------------|------|-----|-----|-----|-----|-----|---------|
| claude-opus-4-7     | 3.2s | 42/512 | $0.0390 | 9 | 9 | 9 | 8 | 8.8 | sharp, well-structured |
| claude-sonnet-4-6   | 1.8s | 42/487 | $0.0074 | 8 | 9 | 8 | 8 | 8.3 | near-parity, cheaper  |
| claude-haiku-4-5    | 0.9s | 42/421 | $0.0021 | 7 | 8 | 6 | 7 | 7.0 | fast, a touch shallow |
| gpt-5              | 2.1s | 45/498 | $0.0051 | 8 | 9 | 7 | 7 | 7.8 | clean, generic voice  |
| gemini-2.5-pro      | 2.6s | 45/534 | $0.0054 | 8 | 7 | 8 | 7 | 7.5 | thorough, verbose     |

---

## claude-opus-4-7
<full response>

## claude-sonnet-4-6
<full response>
...
```

## Execution

Run the script directly via Bash. The script uses `uv`'s inline-script deps so it bootstraps its own env the first time. After the table prints, do not add a trailing summary — the table is the deliverable.

If the user asked about a specific aspect (e.g. "which is best for essay voice?"), add a one-paragraph pick below the table naming the winner and why, grounded in the scores and verdicts.
