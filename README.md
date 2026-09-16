# claude-code-playbook

Every install command in this repo's README was broken. All five npm names
returned 404, including the headline `npx @paramxclaudedev/setup`, which was
never published at all. The same four wrong names were hard-coded in the
installer's own source at `packages/cli/src/index.ts:31-52`, so fixing the
README alone would still have shipped a CLI that installs nothing. That went
undetected for months because I never ran the install path on a machine that
wasn't already my machine.

That is the honest headline. What follows is what survived the audit.

## What's actually here

Ten skills, fifteen hooks, five eval harnesses, three subagent definitions, one
CLI, and a Next.js site. 3,102 lines of Python, 2,300 of skill markdown, 312 of
CLI, 2,727 of site.

`hooks/library.md` is the most reusable thing in here: fifteen hooks numbered and
classified by event (PostToolUse, PreToolUse, Stop) and type (formatter, guard,
notify, logger), each a copy-paste JSON block for `~/.claude/settings.json`. The
three I run constantly are prettier-on-write, a `PreToolUse` guard that blocks
`rm -rf` and `git push --force` before Claude can run them, and a chime on Stop.
The guard has fired on me. That is the entire argument for it.

`skills/` holds ten `SKILL.md` files. Four are eval harnesses (`eval-this`,
`voice-preservation-eval`, `claude-code-hook-eval`, `mcp-tool-selection-eval`),
two are YouTube summarization and its benchmark, and the rest are personal
workflow: `session-save` commits and deploys and logs at the end of a session,
`param-voice` drafts in my voice off a 12-essay corpus, `investor-reply`
classifies an inbound VC email and writes the reply plus a counter-diligence
sheet, `taste` is an anti-slop frontend ruleset.

## What I removed before publishing

**`frontend-design` — deleted.** It was Anthropic's official skill, not mine.
Sixteen of its thirty-seven sentences were verbatim from `anthropics/skills`, and
at some point the `license: Complete terms in LICENSE.txt` line had been dropped
from its frontmatter. Shipping that under a README that said "MIT — use, fork,
and build on anything here" would have relicensed someone else's work after
stripping its license pointer. Use Anthropic's copy. `skills/taste` still says
"use alongside frontend-design", which is still good advice — it is just not a
file in this repo.

**The four MCP servers — moved, not deleted.** `packages/mcp-whoop`,
`mcp-spaceship`, `mcp-vercel` and `mcp-hooks` were stale forks of servers whose
real source had moved on without them. They live at
[github.com/pvcomms/mcp-fleet](https://github.com/pvcomms/mcp-fleet) now, with
tests and a write-up of the patterns they converged on.

## The install names, corrected

Every name on the left 404s. Every name on the right I verified with
`npm view <name> version` while writing this.

| Was in the README                | Actually published as                    | Version |
| -------------------------------- | ---------------------------------------- | ------- |
| `@paramxclaudedev/setup`         | **nothing — never published**            | —       |
| `@paramxclaudedev/mcp-whoop`     | `@paramxclaudedev/mcp-server-whoop`      | 1.0.1   |
| `@paramxclaudedev/mcp-spaceship` | `spaceship-mcp-server` (unscoped)        | 0.1.0   |
| `@paramxclaudedev/mcp-vercel`    | `@paramxclaudedev/vercel-mcp`            | 0.1.0   |
| `@paramxclaudedev/mcp-hooks`     | `@paramxclaudedev/claude-code-hooks-mcp` | 0.1.0   |

The CLI in `packages/cli` is marked private and stays that way until someone
actually publishes it. To use it, clone and build:

```bash
git clone https://github.com/pvcomms/claude-code-playbook
cd claude-code-playbook/packages/cli
pnpm install && pnpm build && node dist/index.js
```

Or skip it entirely — `cp -r skills/* ~/.claude/skills/` does the part that
matters, and `hooks/library.md` is copy-paste.

## Where the numbers disagree with each other

`evals/results/leaderboard.json` reports 97.7% first-try tool accuracy for both
Opus 4.7 and Sonnet 4.6 on "44 tools / 6 servers / 50 queries". The harness
shipped in `skills/mcp-tool-selection-eval` has 77 tools and 31 cases, and its own
committed run — `run1-report.md` — says Sonnet 77%, Haiku 71%, Opus 68%, GPT-5
61%, Gemini 42%. Two different experiments; only the second reproduces from these
files. I left both in and labelled the first, because deleting the number I liked
less is the same mistake in the other direction.

On those 31 cases Opus scored below Haiku. That is not a finding about Opus — it
is a sample too small to separate any of them, and "inconclusive at n=31" is the
honest headline for this eval.

`yt-tldr-eval` documents Opus 4.7 as its judge. `eval.py:81` sets
`JUDGE_MODEL = "claude-haiku-4-5-20251001"`. The code is what ran.

## What this does not do

It does not install cleanly from npm — the CLI is unpublished, on purpose, until
it is tested end to end on a machine that is not mine. It ships five eval
harnesses and results for three. `session-save`, `param-voice` and
`investor-reply` are tuned to my Notion databases, my essay corpus and my
fundraising posture; read them as structure, not as tools. The site in `site/`
was deployed to a domain that no longer resolves and I have not rebuilt it since
removing the packages. Nothing here has a test suite.

## Provenance

I grep my own skills for this now. The pattern I copy is my `underdrawing`
skill, which names Sam Collins in its frontmatter as the author of the technique —
source and role, in the file, where an installer will see it.

One thing here needs that treatment rather than removal.
`skills/param-voice/references/playbook.md` is a style analysis of sixteen posts
from theargumentmag.com and quotes their headlines, deks and openings as
specimens. It names the source in its first line. Those quotations belong to
their publisher; the MIT grant below covers my code and my prose, not them.

I would rather ship the repo with the bug in the first paragraph than ship it
quiet.

## License

MIT.
