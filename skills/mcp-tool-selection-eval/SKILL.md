---
name: mcp-tool-selection-eval
description: Measure how accurately frontier models pick the correct MCP tool from a crowded menu (~78 tools) mirroring Param's actual stack — Notion, Gmail, Calendar, Todoist, Linear, Slack, Figma, Whoop, Bluesky, Chrome, computer-use. Scores across direct-match, semantic-match, ambiguous (disambiguation), and negative (refusal) categories with Opus-4.7 as judge for ambiguous. Use when the user says "mcp eval", "tool selection eval", "which model picks tools best", "tool soup eval", "disambiguation eval", "does model X pick the right MCP", or asks how tool count degrades routing accuracy. Also triggers on `/mcp-tool-selection-eval`.
---

# mcp-tool-selection-eval

Tool-routing benchmark for the "tool soup" problem. One fat menu (~78 tools) mirroring Param's MCP stack → 30 testcases → 5 frontier models → accuracy table, disambiguation inspector, per-failure breakdown.

## When to invoke

User says:

- "mcp eval" / "tool selection eval" / "tool soup eval"
- "which model picks MCP tools best?"
- "run the disambiguation eval"
- "how bad is routing accuracy at 80 tools?"
- "does GPT-5 still pick the right tool when there are 60 options?"
- "/mcp-tool-selection-eval"

## What it measures

Given a user utterance + a realistic tool menu, does the model call the correct tool on the first try?

Four scoring categories:

- **direct** — user named the tool by name. Exact-match scored.
- **semantic** — user described a capability. Exact-match against the one right answer.
- **ambiguous** — multiple tools could plausibly fit. Opus-4.7 judges whether the model disambiguated correctly (with notes explaining the trap, e.g. `list-tasks` vs `filter-tasks`, `notion-search` vs `notion-fetch`).
- **negative** — no tool applies. Reward "no tool called"; penalize any hallucinated call.

## Models

Runs all five in parallel (same set as `eval-this`):

- `claude-opus-4-7`
- `claude-sonnet-4-6`
- `claude-haiku-4-5-20251001`
- `gpt-5`
- `gemini-2.5-pro`

## How to run

```bash
# Full eval — all 30 cases × 5 models + judge
source ~/.config/inbox-triage.env && ~/.claude/skills/mcp-tool-selection-eval/eval.py

# Smoke test — 2 cases on Haiku only (cheap)
source ~/.config/inbox-triage.env && \
  ~/.claude/skills/mcp-tool-selection-eval/eval.py \
  --only haiku --ids direct-01,negative-01

# Category subset
source ~/.config/inbox-triage.env && \
  ~/.claude/skills/mcp-tool-selection-eval/eval.py --categories ambiguous

# Limit per category + skip judge to stay cheap
source ~/.config/inbox-triage.env && \
  ~/.claude/skills/mcp-tool-selection-eval/eval.py --limit 2 --no-judge

# Save report to disk
source ~/.config/inbox-triage.env && \
  ~/.claude/skills/mcp-tool-selection-eval/eval.py --save ~/Desktop/mcp-eval.md
```

## Flags

| Flag                  | Effect                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `--only <aliases>`    | Comma-separated model subset: `opus,sonnet,haiku,gpt,gemini`      |
| `--categories <cats>` | `direct,semantic,ambiguous,negative` — any subset                 |
| `--ids <ids>`         | Specific case IDs (e.g. `direct-01,ambiguous-03`) for smoke-tests |
| `--limit N`           | Max cases per category                                            |
| `--no-judge`          | Skip Opus-4.7 judge for ambiguous cases (scores them fail-fast)   |
| `--tools <path>`      | Override the tool menu (defaults to `tools.json` in this skill)   |
| `--cases <path>`      | Override testcases (defaults to `testcases.jsonl`)                |
| `--save <path>`       | Write markdown report to path in addition to stdout               |

## Requirements

Environment variables (load via `source ~/.config/inbox-triage.env`):

- `ANTHROPIC_API_KEY` — required (also used for the judge)
- `OPENAI_API_KEY` — required for GPT-5
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` — required for Gemini

Missing keys → that model shows `api error: no *_API_KEY` in the failure inspector; the rest still run.

## Fixtures

- `tools.json` — 78-tool menu: Notion (14), Gmail (6), Calendar (8), Todoist (11), Slack (4), Linear (4), Figma (5), Whoop (11), Bluesky (3), Chrome (4), computer-use (3), Drive (3). Tuned with adversarially similar pairs — `notion-search` vs `notion-fetch`, `todoist-list-tasks` vs `todoist-filter-tasks`, `todoist-close-task` vs `todoist-delete-task`, `calendar-create-event` vs `todoist-create-task`, `chrome-get-page-text` vs `computer-screenshot` — to probe disambiguation.
- `testcases.jsonl` — 30 cases: 7 direct, 12 semantic, 7 ambiguous, 5 negative. All utterances terse and in Param's voice.

Extend either file to re-run the eval without touching `eval.py`.

## Output shape

```
# mcp-tool-selection-eval

**Tool menu:** 78 tools
**Testcases:** 30
**Models:** opus, sonnet, haiku, gpt, gemini

## Accuracy by category

| Model  | Direct     | Semantic    | Ambiguous  | Negative  | Overall      |
|--------|------------|-------------|------------|-----------|--------------|
| opus   | 7/7 (100%) | 12/12 (100%)| 6/7 (86%)  | 5/5 (100%)| 30/31 (97%)  |
| sonnet | 7/7 (100%) | 11/12 (92%) | 5/7 (71%)  | 5/5 (100%)| 28/31 (90%)  |
| haiku  | 7/7 (100%) | 10/12 (83%) | 3/7 (43%)  | 3/5 (60%) | 23/31 (74%)  |
| gpt    | 7/7 (100%) | 12/12 (100%)| 4/7 (57%)  | 4/5 (80%) | 27/31 (87%)  |
| gemini | 6/7 (86%)  | 11/12 (92%) | 5/7 (71%)  | 5/5 (100%)| 27/31 (87%)  |

## Performance

| Model  | Calls | Avg latency | Total tokens (in/out) | Total cost |
|--------|-------|-------------|-----------------------|------------|
| ...                                                                        |

## Failures — per-case inspector

| Model | Case | Category | Expected | Got | Reason |
|-------|------|----------|----------|-----|--------|
| haiku | `ambiguous-01` | ambiguous | `todoist-filter-tasks` | `todoist-list-tasks` | used list instead of smart-filter |
| ... |
```

## Design decisions Param should know

- **No tool schema args required.** Fixtures carry only `name` + `description`. Models can only select a tool based on descriptions — which is the realistic setting when MCP servers ship with loose schemas. Input JSON is collected but ignored by the scorer.
- **Gemini's tool names are snake-cased** at API boundary (it rejects dashes in some SDK versions) and mapped back for scoring.
- **Ambiguous cases always go through Opus judge** unless `--no-judge`. Direct/semantic/negative are deterministic to avoid wasting tokens.
- **Negative cases reward text-only responses.** If the model emits a tool call at all for a negative prompt, that's a fail — hallucinated routing is the worst failure mode.
- **Cost footprint.** Full run ≈ 150 primary calls + ~7 judge calls ≈ well under $1 total at current pricing (Haiku + Gemini are the heaviest). Use `--limit 2 --no-judge` for a ~$0.05 smoke pass.

## Execution

Run the script directly via Bash. It uses `uv` inline-script deps so it bootstraps its env the first time.

After the tables print, do not add a trailing summary — the tables are the deliverable. If the user asked a targeted question (e.g. "is Haiku usable for routing?"), add a single-paragraph pick below the tables grounded in the scores.
