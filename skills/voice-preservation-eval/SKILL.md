---
name: voice-preservation-eval
description: Measure whether a model holds Param's voice after N rewrites. Seeds from the 12-essay corpus (or any supplied text), runs a sequential rewrite chain per model (gen_i = model.rewrite(gen_{i-1})), and uses Opus-4.7 as judge to score voice drift each iteration on fingerprint, coined phrases, banned phrases, and the swap test. Use when the user says "voice eval", "voice drift", "does model X hold my voice", "how many rewrites before slop", "run voice preservation on essay Y", or asks how robust a model is at paraphrasing while staying in-voice. Triggers on `/voice-preservation-eval`.
---

# voice-preservation-eval

How many paraphrase iterations until the voice collapses? This is the answer.

Each model runs its own sequential chain: `gen_i = model.rewrite(gen_{i-1}, "preserve voice exactly")`. After N iterations, Opus-4.7 judges every rewrite against the original seed on 5 dimensions. The chain is what makes this hard — a model that paraphrases cleanly once often drifts on iteration 3.

## When to invoke

User says:

- "voice eval on <essay>" / "run voice-preservation"
- "does <model> hold my voice?" / "how many rewrites before it breaks?"
- "which model paraphrases best without losing voice?"
- Asks for a rewrite-robustness benchmark
- Pastes an essay and asks "how fast does this drift?"

## What it does

1. Resolve seed — either a numbered piece from `~/.claude/skills/param-voice/references/corpus.md` (1-12), a keyword lookup (`--essay oracle`), a file path (`--file draft.md`), or a random pick. By default it uses the opening paragraph of the piece, not the full post — shorter = faster chain, same drift signal.
2. For each model (opus, sonnet, haiku, gpt, gemini — all 5 by default, subset via `--only`), run N sequential rewrites (default 5). Chains are parallelized across models.
3. Opus-4.7 judges every iteration against the seed:
   - `fingerprint` (1-10): sentence rhythm, punctuation use, paragraph shape
   - `coined_phrases` (1-10): signature phrases preserved / still load-bearing
   - `banned_phrase_avoidance` (1-10): penalty for banned moves from voice-rules.md
   - `swap_test` (1-10): would a regular reader notice this is a different author?
   - `overall` (1-10): weighted voice preservation
   - `banned_found`: list of banned phrases detected
   - `leaks`: up to 3 pull-quotes + diagnosis of voice drift
4. Render a summary table (start→end score, drop, half-life, first leak, cost) + per-model drift table + leak log + final-iteration pull-quotes.

## How to run

```bash
# Default: random corpus piece, N=5, all 5 models
source ~/.config/inbox-triage.env && ~/.claude/skills/voice-preservation-eval/eval.py

# Specific essay, 7-iteration chain
~/.claude/skills/voice-preservation-eval/eval.py --essay 1 -n 7

# Keyword match against corpus titles
~/.claude/skills/voice-preservation-eval/eval.py --essay oracle -n 5

# Your own draft
~/.claude/skills/voice-preservation-eval/eval.py --file drafts/keep-launch.md -n 5

# Subset of models (claude family + gpt)
~/.claude/skills/voice-preservation-eval/eval.py --only claude,gpt -n 5

# Save a full report for later reference
~/.claude/skills/voice-preservation-eval/eval.py -n 7 --save reports/voice-drift-$(date +%F).md

# Table only, no full texts
~/.claude/skills/voice-preservation-eval/eval.py --no-texts
```

Aliases for `--only`: `opus`, `sonnet`, `haiku`, `claude`/`anthropic`, `gpt`/`openai`, `gemini`/`google`.

## Requirements

Same env as eval-this — `~/.config/inbox-triage.env` with:

```
export ANTHROPIC_API_KEY=sk-ant-...   # required for judge, and opus/sonnet/haiku chains
export OPENAI_API_KEY=sk-...          # required for gpt chain
export GEMINI_API_KEY=...             # required for gemini chain
```

Sandbox blocks `~/.config/*.env` auto-reads when invoked from Claude Code's Bash tool — source the file inline:

```bash
source ~/.config/inbox-triage.env && ~/.claude/skills/voice-preservation-eval/eval.py
```

## Output shape

```
# voice-preservation-eval

**Seed:** 1. The Oracle Problem Is Solved
**Chain length:** 5
**Models:** opus, sonnet, haiku, gpt, gemini

## Summary — drift across models

| Model  | Start | End | Drop | Half-life | First leak            | Total cost |
|--------|-------|-----|------|-----------|-----------------------|------------|
| opus   | 9     | 7   | +2   | —         | —                     | $0.34      |
| sonnet | 9     | 6   | +3   | iter 4    | —                     | $0.07      |
| haiku  | 8     | 4   | +4   | iter 3    | iter 2: "delve into"  | $0.02      |
| gpt    | 8     | 5   | +3   | iter 4    | iter 3: "leverage"    | $0.04      |
| gemini | 7     | 4   | +3   | iter 3    | iter 1: "holistic"    | $0.05      |

## opus (claude-opus-4-7)

| It | Fing | Coin | Banned | Swap | Overall | Avg | Latency | Cost | Banned found |
...

### Leak log — opus
- _iter 3_ — "...navigate the complexities..." — **AI slop phrase inserted**
- _iter 4_ — "It could be argued..." — **hedging replaced Param's declarative**
...
```

## Output interpretation

- **Drop** = start score minus end score. 0 = voice held. 3+ = collapsed.
- **Half-life** = first iteration where overall drops below 7. "—" means the model never dropped below 7.
- **First leak** = earliest iteration that introduced any banned phrase from voice-rules.md.
- **ROI for model choice:** cheaper models with low drop are the win. Opus holding 9→8 is not worth 10x cost if Sonnet holds 8→8.

## When results are surprising

Small text, low-temperature models can hit ceiling effects on iteration 1 and look better than they are — check the actual rewrite in the "Final-iteration texts" section. A model that stays at 9/10 but turned Param's contrarian prose into neutral reportage has cheated the rubric. Read the final-iteration pull-quotes before trusting the table.
