# spaceship-mcp-server

MCP server for the [Spaceship](https://spaceship.com) domain registrar API. Lets Claude check domain availability, register/renew/transfer domains, manage DNS records, and delegate nameservers — without leaving the chat.

## Tools

| Tool                               | What it does                                   | Side effects          |
| ---------------------------------- | ---------------------------------------------- | --------------------- |
| `spaceship_check_availability`     | Bulk availability check                        | none                  |
| `spaceship_list_domains`           | Paginated list of owned domains                | none                  |
| `spaceship_get_domain`             | Single-domain details                          | none                  |
| `spaceship_register_domain`        | Register a new domain (dry-run unless confirm) | **money** (confirmed) |
| `spaceship_renew_domain`           | Renew (dry-run unless confirm)                 | **money** (confirmed) |
| `spaceship_set_autorenew`          | Toggle auto-renewal                            | none until renewal    |
| `spaceship_upsert_contact`         | Create/update a registrant contact             | none                  |
| `spaceship_list_dns_records`       | List DNS records on a domain                   | none                  |
| `spaceship_set_dns_records`        | Create/update DNS records                      | DNS change            |
| `spaceship_delete_dns_records`     | Delete specific DNS records                    | DNS change            |
| `spaceship_point_to_vercel`        | Convenience: A/CNAME apex+www → Vercel         | DNS change            |
| `spaceship_set_nameservers`        | Replace authoritative nameservers              | NS change             |
| `spaceship_use_vercel_nameservers` | Convenience: delegate NS to Vercel             | NS change             |
| `spaceship_get_async_operation`    | Poll the status of a long-running op           | none                  |

## Why dry-run for register/renew?

Registration and renewal cost real money. Both default to `confirm: false`, which returns the request body that _would_ be sent. Re-call with `confirm: true` to actually charge.

## Setup

1. Generate an API key at https://www.spaceship.com/application/api-manager/. You get a **key** and a **secret**, both required.
2. Install:

   ```bash
   pnpm install
   pnpm build
   ```

3. Add to your Claude Code MCP config (`~/.claude.json`):

   ```jsonc
   "mcpServers": {
     "spaceship": {
       "command": "node",
       "args": ["/absolute/path/to/spaceship-mcp/dist/index.js"],
       "env": {
         "SPACESHIP_API_KEY": "...",
         "SPACESHIP_API_SECRET": "..."
       }
     }
   }
   ```

4. Restart Claude Code to pick up the server.

## Smoke test

```bash
export SPACESHIP_API_KEY=...
export SPACESHIP_API_SECRET=...
pnpm smoke
```

Hits two read-only endpoints (list domains, check availability) and prints results.

## Auth

Header-based: `X-Api-Key` + `X-Api-Secret`. No OAuth, no token rotation. Keep both values out of source control — only put them in your MCP server `env` block or in a sourced `~/.config/*.env` file with mode 600.

## Async operations

Several mutating endpoints (register, set DNS, set nameservers) return an `asyncOperationId` in a `spaceship-async-operationid` response header. Poll `spaceship_get_async_operation` with that ID to check completion.

## License

MIT.
