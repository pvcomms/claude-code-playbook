# Skills

10 installable Claude Code skill modules. Each is a SKILL.md file that loads into
Claude's context and changes its behavior for specific tasks.

## Install

```bash
# Copy all skills to ~/.claude/skills/
cp -r skills/* ~/.claude/skills/

# Or copy a single skill manually
cp -r skills/session-save ~/.claude/skills/
```

## Skill Index

| Skill                     | Trigger                                       | What it does                                                      |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `session-save`            | "save", "ship it", "wrap up", ~95% context    | Commits + deploys + logs Notion + syncs Todoist + updates memory  |
| `param-voice`             | "draft post", "write essay", "write linkedin" | Drafts in Param's voice using 12-essay corpus + style playbook    |
| `eval-this`               | "eval this: <prompt>"                         | Multi-model bake-off, Opus judge, markdown table                  |
| `voice-preservation-eval` | "voice eval"                                  | Measures how many rewrites before a model loses the voice         |
| `claude-code-hook-eval`   | "hook eval", "audit my hooks"                 | Measures wall-clock time saved per hook in settings.json          |
| `mcp-tool-selection-eval` | "tool selection eval"                         | First-try accuracy across 44 tools / 7 models                     |
| `yt-tldr`                 | YouTube URL                                   | Transcript → structured digest in Param's reading style           |
| `yt-tldr-eval`            | "yt eval"                                     | 100-video bake-off across 5 models + Opus judge                   |
| `investor-reply`          | VC email paste                                | Classifies inbound, drafts reply, outputs counter-diligence sheet |
| `taste`                   | any frontend task                             | Anti-slop framework — stops generic design defaults               |

## How skills work

A skill is a markdown file at `~/.claude/skills/<name>/SKILL.md`.
Claude Code loads it when the trigger phrase matches.
The file can embed commands, templates, and structured prompts.

Some skills include executable scripts (`.py`, `.sh`) alongside `SKILL.md`.
Those run directly — no wrapper needed.
