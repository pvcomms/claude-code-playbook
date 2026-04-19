# whoop-mcp-server

> Your Whoop data, now a first-class citizen in Claude Code, Claude Desktop, Cursor, and Zed.

```
You: What was my recovery last night, and should I train hard today?

Claude:
→ whoop_get_cycle_recovery(today)
→ whoop_get_sleep(last_night)

Recovery 34% (yellow). Sleep 6h 12m, efficiency 81%.
Strain yesterday 15.1. That's a three-night deficit.

Today's call: Zone 2 only, 45 min max. Save the intervals for Thursday.
```

That's it. Every number above came from a tool call against your own Whoop data, not a hallucination. No screenshots pasted in, no "let me paste my sleep data" ritual. The model already has it.

## Why this exists

I built this for [Keep](https://keep.markets) — a biometric commitment market where you stake money against your own Whoop score. Settlement has to be exact, audited, and adversary-resistant. That means the agent needs _structured_ access to Whoop, not "look at this JSON I pasted." The MCP gives Claude typed tools with pagination, date ranges, and response-format negotiation.

It also turns out to be the right building block for any agent that reasons about _you_: a morning-brief agent, a training-plan coach, a commitment-market settler, a sleep-forensics debugger. All four work better when the Whoop data is one tool call away.

## What's inside

- Stdio transport, no network listening after OAuth
- OAuth2 with offline refresh; tokens stored at `~/.whoop-mcp/tokens.json` with `0600` perms
- Zero runtime deps beyond `@modelcontextprotocol/sdk` + `zod`
- 11 read-only tools, all annotated `readOnlyHint: true`
- Refresh-token rotation with in-flight deduplication (concurrent tool calls share one refresh)
- Markdown + JSON response formats for every tool (default markdown — compact, cache-friendly, token-cheap)

## Setup

### 1. Register a WHOOP developer app

1. Go to [developer.whoop.com](https://developer.whoop.com/), sign in, create a new app.
2. Add redirect URI: `http://localhost:4567/callback`
3. Enable these scopes: `offline`, `read:profile`, `read:body_measurement`, `read:cycles`, `read:recovery`, `read:sleep`, `read:workout`
4. Copy the Client ID and Client Secret.

### 2. Install

```bash
npm install -g @paramxclaudedev/mcp-server-whoop
```

Or run directly without installing:

```bash
npx @paramxclaudedev/mcp-server-whoop
```

### 3. Authorize (one-time)

```bash
# Clone the repo if you haven't, then:
npx tsx scripts/auth.ts
```

Opens your browser to WHOOP's OAuth consent. On success, tokens land at `~/.whoop-mcp/tokens.json`. The server auto-refreshes access tokens on the fly (refresh tokens rotate; the store is rewritten on every refresh).

**Cloudflare note:** `id.whoop.com` sits behind Cloudflare's bot check. If you run the auth flow inside a headless or automated browser, Cloudflare will block login with a silent loop. Open the printed URL in a regular Chrome/Safari window instead.

### 4. Register with your MCP client

**Claude Code** — edit `~/.claude.json` (or run `claude mcp add`):

```json
{
  "mcpServers": {
    "whoop": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@paramxclaudedev/mcp-server-whoop"],
      "env": {
        "WHOOP_CLIENT_ID": "…",
        "WHOOP_CLIENT_SECRET": "…"
      }
    }
  }
}
```

**Claude Desktop** — same shape, in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

Restart the client. Try: _"Use whoop_get_profile"_ or _"What was my recovery last night?"_

### 5. Smoke-test (optional)

Clone the repo, then:

```bash
pnpm install
npx tsx scripts/smoke-test.ts
```

Exercises all 11 tools against the live API. Expects `~/.whoop-mcp/tokens.json` to exist.

## Tools

| Tool                         | Scope                   | Purpose                        |
| ---------------------------- | ----------------------- | ------------------------------ |
| `whoop_get_profile`          | `read:profile`          | User name, email, user_id      |
| `whoop_get_body_measurement` | `read:body_measurement` | Height, weight, max HR         |
| `whoop_list_cycles`          | `read:cycles`           | Paginated physiological cycles |
| `whoop_get_cycle`            | `read:cycles`           | Single cycle by ID             |
| `whoop_list_recoveries`      | `read:recovery`         | Paginated recovery scores      |
| `whoop_get_cycle_recovery`   | `read:recovery`         | Recovery for a cycle           |
| `whoop_list_sleep`           | `read:sleep`            | Paginated sleep activities     |
| `whoop_get_sleep`            | `read:sleep`            | Single sleep by UUID           |
| `whoop_get_cycle_sleep`      | `read:cycles`           | Sleep for a cycle              |
| `whoop_list_workouts`        | `read:workout`          | Paginated workouts             |
| `whoop_get_workout`          | `read:workout`          | Single workout by UUID         |

All list tools accept `limit` (≤25), `start`, `end` (ISO 8601), `next_token`, and `response_format` (`markdown` or `json`).

## Architecture

```
src/
├── index.ts                   # McpServer + stdio transport
├── constants.ts               # URLs, scopes, token path
├── types.ts                   # StoredTokens, PaginatedResponse, ResponseFormat
├── auth/token-manager.ts      # Singleton cache, auto-refresh, rotation
├── services/whoop-client.ts   # whoopGet() + WhoopApiError mapper
├── schemas/common.ts          # Pagination + response_format Zod shapes
└── tools/                     # One file per resource
    ├── profile.ts
    ├── cycles.ts
    ├── recovery.ts
    ├── sleep.ts
    ├── workouts.ts
    └── activity-mapping.ts
scripts/
├── auth.ts                    # One-time OAuth flow (localhost callback)
└── smoke-test.ts              # End-to-end tool check
```

Refresh tokens are long-lived but single-use; the manager rotates them on every refresh and rewrites the store. Access tokens refresh automatically 1 minute before expiry, with in-flight deduplication so concurrent tool calls share one refresh.

## Troubleshooting

- **`Could not read WHOOP tokens…`** — run `pnpm run auth` first.
- **`WHOOP auth failed (401)`** — refresh token is invalid or revoked. Re-run `pnpm run auth`.
- **`WHOOP scope forbidden (403)`** — the scope wasn't granted during consent. Re-authorize and tick all boxes.
- **Cloudflare loop on consent page** — you're inside a headless/automated browser. Paste the URL into regular Chrome.
- **`invalid_request` during auth** — the redirect URI registered on the WHOOP app dashboard doesn't exactly match `http://localhost:4567/callback`.

## License

MIT. See [LICENSE](LICENSE).
