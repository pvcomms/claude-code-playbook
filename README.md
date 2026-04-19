# claude-code-playbook

4 MCPs. 11 skills. 15 hooks. 5 open evals. 1 CLI.
The full autonomous Claude Code stack, built over two weeks, open-sourced.

**[claudecode.paramvaswani.com](https://claudecode.paramvaswani.com)** — marketing site with full docs

---

## Install

```bash
npx @paramxclaudedev/setup
```

Copies all 11 skills into `~/.claude/skills/`, writes the core 3 hooks into
`settings.json`, and prints the exact MCP registration config for each server.

---

## What's inside

### packages/ — 4 MCP servers

| Package                                   | Tools | What it does                                                          |
| ----------------------------------------- | ----- | --------------------------------------------------------------------- |
| [`mcp-whoop`](packages/mcp-whoop)         | 11    | WHOOP v2 API — recovery, sleep, strain, workouts, body measurements   |
| [`mcp-spaceship`](packages/mcp-spaceship) | 14    | Spaceship domain registrar — availability, register, DNS, nameservers |
| [`mcp-vercel`](packages/mcp-vercel)       | 15    | Vercel REST API — deployments, projects, domains, env vars, logs      |
| [`mcp-hooks`](packages/mcp-hooks)         | 3     | Read-only introspection of `~/.claude/settings.json` hooks            |
| [`cli`](packages/cli)                     | —     | `npx @paramxclaudedev/setup` bootstrap installer                      |

All four share a pnpm workspace, a base `tsconfig`, and a single CI pipeline.

### skills/ — 11 installable skills

| Skill                     | Trigger                       |
| ------------------------- | ----------------------------- |
| `session-save`            | "save", "ship it", "wrap up"  |
| `param-voice`             | "draft post", "write essay"   |
| `eval-this`               | "eval this: \<prompt\>"       |
| `voice-preservation-eval` | "voice eval"                  |
| `claude-code-hook-eval`   | "hook eval", "audit my hooks" |
| `mcp-tool-selection-eval` | "tool selection eval"         |
| `yt-tldr`                 | YouTube URL                   |
| `yt-tldr-eval`            | "yt eval"                     |
| `investor-reply`          | VC email paste                |
| `taste`                   | any frontend task             |
| `frontend-design`         | any UI build                  |

See [skills/README.md](skills/README.md) for full descriptions.

### hooks/ — 15 opinionated hooks

Classified by event and type (formatter / guard / notify / logger).
ROI measured by `claude-code-hook-eval` over 14 days.

See [hooks/library.md](hooks/library.md) for all 15 with copy-paste JSON blocks.

### evals/ — 5 open evals

| Eval                      | Metric                   | Headline                         |
| ------------------------- | ------------------------ | -------------------------------- |
| `mcp-tool-selection-eval` | first-try accuracy       | Opus 4.7 = Sonnet 4.6 = 97.7%    |
| `eval-this`               | quality / cost / latency | multi-model bake-off             |
| `voice-preservation-eval` | drift after N rewrites   | voice holds 8 iterations on Opus |
| `claude-code-hook-eval`   | net seconds saved/week   | prettier saves ~600s/week        |
| `yt-tldr-eval`            | faithfulness + coverage  | 100-video bake-off               |

Leaderboard JSON: [evals/results/leaderboard.json](evals/results/leaderboard.json)

### blog/

[2-weeks-with-claude-code.md](blog/2-weeks-with-claude-code.md) — the write-up.

---

## Development

```bash
# Install dependencies (all packages)
pnpm install

# Build all packages
pnpm build

# Dev mode (watch, all packages in parallel)
pnpm dev

# Build just one MCP
cd packages/mcp-whoop && pnpm build
```

Requires Node ≥ 18 and pnpm ≥ 9.

---

## MCP registration

After installing each package, add to `~/.claude.json`:

```jsonc
{
  "mcpServers": {
    "whoop": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@paramxclaudedev/mcp-whoop"],
      "env": {
        "WHOOP_CLIENT_ID": "...",
        "WHOOP_CLIENT_SECRET": "...",
      },
    },
    "spaceship": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@paramxclaudedev/mcp-spaceship"],
      "env": {
        "SPACESHIP_API_KEY": "...",
        "SPACESHIP_API_SECRET": "...",
      },
    },
    "vercel": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@paramxclaudedev/mcp-vercel"],
      "env": {
        "VERCEL_TOKEN": "...",
        "VERCEL_TEAM_ID": "team_...",
      },
    },
    "hooks": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@paramxclaudedev/mcp-hooks"],
    },
  },
}
```

---

## License

MIT — use, fork, and build on anything here.

---

_Built by [Param Vaswani](https://paramvaswani.com) while building [Keep](https://keep-wine.vercel.app)._
