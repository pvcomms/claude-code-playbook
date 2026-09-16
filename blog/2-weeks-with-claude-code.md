# 2 weeks with Claude Code — 4 MCPs, 11 skills, 5 evals, 1 autonomous life OS

_Param Vaswani — April 2026_

> Kept as written. Two of its claims did not survive: the `npx` bootstrap was never
> published, and the four MCP servers now live at github.com/pvcomms/mcp-fleet.

---

I started using Claude Code on April 15. Two weeks later I had a working biometric prediction market, a refactored personal dashboard, an inbox triage system that runs every 30 minutes without me, and a set of tools I can't imagine coding without. I also had a mess of scripts, configs, and half-documented workflows scattered across five directories.

This repo is the cleanup pass. Everything unified, documented, and installable.

Here's what I actually built, what I learned, and what the numbers say.

---

## The problem I was solving

I'm building [Keep](https://keep-wine.vercel.app) — prediction markets settled by biometric data. You make a commitment (sleep 7+ hours, hit 80% recovery), stake money against it, and your Whoop settles the result automatically at 12:45 IST the next morning.

For that to work, Claude needs structured access to Whoop data — not "paste your JSON here" access, but typed tool calls it can reason about. That meant building an MCP server.

Then I needed to manage Vercel deployments and DNS from inside a chat. That meant two more MCPs.

Then I wanted to inspect my own hooks configuration from inside Claude. That was a fourth.

Then I needed skills for the writing work — drafting essays, replying to investors, running model evals. Eleven of those.

At some point I had built an autonomous life OS by accident.

---

## What I built

### 4 MCP servers

**mcp-whoop** — 11 read-only tools against the WHOOP v2 API. Recovery, sleep, strain, workouts, body measurements. OAuth with offline refresh and in-flight deduplication. This is the oracle layer for Keep: the same tools that power my morning brief power the nightly settlement cron.

**mcp-spaceship** — 14 tools against the Spaceship domain registrar API. Availability checks, registration, DNS, nameservers. Register and renew are dry-run by default — `confirm: true` required because these cost real money.

**mcp-vercel** — 15 tools. List deployments, get logs, cancel builds, attach domains, manage env vars, promote to production. Pairs with mcp-spaceship: three tools, one prompt, domain registered + attached + DNS pointed.

**mcp-hooks** — 3 read-only tools that inspect `~/.claude/settings.json`. Write tools deliberately omitted — Claude can't self-modify its own hooks without going through me.

Total: **43 tools** across 4 servers, shared pnpm monorepo, shared TS types.

### 11 skills

A skill is a `SKILL.md` in `~/.claude/skills/`. Claude Code loads it when the trigger phrase matches. No slash commands, no config, no plugin installation.

The ones that get daily use:

**session-save** — commits + deploys every touched project, logs to Notion, syncs Todoist, updates memory files. I say "save it" and the whole session persists. Auto-triggers at ~95% context so I never lose work.

**param-voice** — drafts essays and LinkedIn posts in my voice using a 12-essay corpus and a style playbook. The playbook covers the 10 hooks I use, the 5-beat structure, the evidence hierarchy, the banned phrases. The eval measures how many rewrites it takes before the voice drifts.

**investor-reply** — I've been talking to early-stage funds about Keep. This skill classifies inbound (cold/warm/partner/scout), drafts a reply, and outputs a counter-diligence sheet. It knows my raise stage, my comp (Beeminder), and my current pitch angle.

**eval-this** — one prompt, five models, Opus judge. I use this constantly for deciding which model to use for what. The results are in `evals/results/leaderboard.json`.

### 15 hooks

Hooks are the underrated part of Claude Code. They run shell commands automatically on tool events — before a tool call, after, or when Claude stops.

The ones I actually run:

**Auto-format (PostToolUse/Write)** — prettier runs on every file Claude writes. 40 fires/week, 180ms latency, ~600s saved/week. The ROI is lopsided because the alternative is running it manually after every edit.

**Destructive command guard (PreToolUse/Bash)** — blocks `rm -rf`, `DROP TABLE`, `git push --force`, `git reset --hard`. Exit 2 means Claude stops and tells you what it was about to do. I've had it fire twice. Both times it was the right call.

**Stop chime (Stop)** — `afplay Glass.aiff` when Claude finishes. I walk away during long tasks. The chime tells me when to look. 8s saved per fire × 60% away rate × 30 fires/week = 144s/week. That's nothing individually. Over a year it's over 2 hours.

The `claude-code-hook-eval` skill measures these numbers on your actual usage — your transcript JSONLs, your hooks, your fire rates. The savings model is explicit and overridable.

### 5 evals

Every tool I built has a benchmark.

**mcp-tool-selection-eval** is the one worth highlighting. Given 44 tools across 6 MCP servers, does the model pick the right one first try? Across 50 queries × 7 models: Opus 4.7 and Sonnet 4.6 tie at 97.7%, GPT-5 Mini wins the small tier at 90.9%, and Gemini Flash collapses to 46% on list-style queries.

The takeaway: on a large tool catalog, Sonnet 4.6 is Opus-quality at a fraction of the cost. Haiku starts dropping at the ambiguous/adversarial queries. GPT-5 Mini punches above its tier for clear_single but falls off on param_precision.

This matters practically: it tells you which model to route to which query type when you're building an agent.

---

## What I learned

**The hook model is the right abstraction.** The ability to intercept any tool call, inspect its input, and either block or augment it is what separates Claude Code from a chat UI with file access. Prettier auto-format sounds trivial. It means every file Claude touches comes out formatted, every time, without any instruction in the prompt. That's a 100% consistency guarantee for something that would otherwise require constant reminder.

**Skills are a better interface than system prompts.** A SKILL.md in `~/.claude/skills/` loads contextually. The investor-reply skill only loads when I paste a VC email. The session-save skill only loads when I say "wrap up." The alternative — a massive system prompt with all my preferences — degrades model behavior as it gets longer.

**Evals catch things vibes miss.** I was using Haiku for inbox triage because it felt fast enough. The mcp-tool-selection-eval showed it drops 13 percentage points on ambiguous queries vs Sonnet. I switched to Sonnet. My triage quality improved in ways I could feel but couldn't have articulated before I had the number.

**The MCP ecosystem is still early.** The three things I wanted that don't exist yet: a standard for MCP server auth that doesn't require copying token values into JSON files, tool call streaming for long-running operations, and a way to namespace tools so a 44-tool catalog is navigable. These are solvable problems. They'll get solved.

---

## What's next

Keep needs a Whoop settler that actually runs in production — the cron is live, the schema is done, I just need to wire my OAuth tokens into the Vercel env. That's tonight.

The mcp-tool-selection-eval has a V2 that covers 7 models. I want to submit it upstream as a contribution to the Claude Code evaluation suite.

The blog post about the oracle problem — how biometric data becomes a trusted settlement source for prediction markets — is drafted. It goes live when the settler is running.

---

## The repo

Everything is at [github.com/pvcomms/claude-code-playbook](https://github.com/pvcomms/claude-code-playbook).

Bootstrap from a clone: `packages/cli`. (The published one-liner never shipped.)

The leaderboard JSON is in `evals/results/`. Every eval is reproducible. The skills run without modification if you copy them into `~/.claude/skills/`. The hooks are copy-paste into `~/.claude/settings.json`.

I spent two weeks building this. You can install it in five minutes.

---

_Param Vaswani is a solo founder in Bangalore building Keep, a biometric commitment market. Find him at [paramvaswani.com](https://paramvaswani.com) or [@paramtheg.bsky.social](https://bsky.app/profile/paramtheg.bsky.social)._
