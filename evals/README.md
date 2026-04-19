# Evals Suite

Five reproducible evals measuring different dimensions of the Claude Code stack.
All results are in `results/` as JSON — portable, diffable, open to replication.

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

44 tools across 6 MCP servers. 50 gold-labeled queries. 7 models compared.  
Categories: clear_single, multi_tool, ambiguous, no_tool, adversarial, param_precision  
Headline: Opus 4.7 = Sonnet 4.6 = 97.7% (large tier). GPT-5 Mini 90.9%. GPT-5 63.6%.

See `results/mcp-tool-selection-v2.json` for full leaderboard.

```bash
cd /path/to/mcp-tool-selection-eval
pnpm eval
```

---

## yt-tldr-eval

**100-video summarization bake-off across 5 models.**

Metrics: faithfulness / compression ratio / key-point coverage / style fit + hallucination list  
Judge: Claude Opus 4.7  
Cost: ~$0.40 for a full 100-video run with caching

```bash
source ~/.config/your-env.env
~/.claude/skills/yt-tldr-eval/eval.py --videos 20
```

---

## Leaderboard

See `results/leaderboard.json` for aggregated scores across all evals.
