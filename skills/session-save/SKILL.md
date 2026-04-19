---
name: session-save
description: End-of-session save protocol for Param — commits/deploys all touched projects, logs to Notion Claude Sessions DB, syncs task status to Todoist, updates memory files. Use when the user says "save", "ship it", "wrap up", "session save", "end session", when context/token usage reaches ~95% of the window, or when the user indicates the session is ending. Runs automatically without further confirmation once invoked. CRITICAL: self-trigger at 95% — do not wait for the user to ask.
---

# Session Save Protocol

Full save/deploy/log pass at end of a Claude Code session. Runs non-interactively. Skip steps that don't apply (e.g. no git repo → no commit; no web project → no deploy).

## When to invoke

- User says: "save it all", "ship it", "wrap up", "session save", "deploy everything", "do the protocol", "end session"
- Session is ending and meaningful work was done
- **Context/token usage hits ~95% of the window** — self-trigger without waiting. The status line shows a percentage; when it passes 95% and ANY code / files / Notion / Todoist state is un-persisted, stop what you're doing and run this skill immediately
- After completing a non-trivial task where code was written or files changed

## Execution order

Run these in parallel where safe. Do not stop on individual failures — surface the error and continue to the next step.

### 1. Git commit + push (for each touched git repo)

For every directory the session modified that is also a git repo:

```bash
cd <repo> && git add -A && git status --short
# Draft commit message: 1-2 sentences, imperative, focus on why
git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

Skip if no changes. Skip if not a git repo.

### 2. Deploy web projects

For any project with `vercel.json` or `.vercel/` that had changes:

```bash
cd <project> && vercel --prod --yes
```

Capture the production URL. For likehearted.life (param-hub) verify with `curl -sI https://likehearted.life | head -3`.

### 3. Log to Notion Claude Sessions DB

Database: `2a972407-306a-450d-9351-330f62e90d95`

Use `mcp__e58673b1-97b6-4a47-9eff-b1651d7f5a61__notion-create-pages` with:

- **Session**: short title (≤60 chars)
- **Date**: today (`date +%Y-%m-%d`)
- **Tags**: from [doordrop, param-hub, productivity, research, content, cyborg-market, setup]
- **Summary**: 2–3 sentences on what was accomplished
- **Files Changed**: list of modified paths
- **Deployed**: yes/no + URL

### 4. Sync Todoist

Close tasks that were completed this session:

- `mcp__todoist__todoist_filter_tasks` with a query like `today | overdue` to find candidates
- For each completed one: `mcp__todoist__todoist_close_task` by id
- Create follow-ups for anything discovered but not finished: `mcp__todoist__todoist_create_task`

### 5. Update memory files

Location: `/Users/p/.claude/projects/-Users-p-Library-Mobile-Documents-com-apple-CloudDocs/memory/`

- If a project file exists for what was worked on, edit it with a one-line update and today's date
- If MEMORY.md index is stale for the change, add/update the entry
- Keep entries short — single line each

### 6. Report

One short block to the user:

```
✓ Committed: <repo list or "none">
✓ Deployed: <urls or "none">
✓ Notion: <page url>
✓ Todoist: <n closed, n created>
✓ Memory: <files touched>
⏳ Pending: <anything not finished — WHOOP OAuth, user action, etc.>
```

No trailing summary beyond this block.

## What NOT to do

- Don't ask for confirmation — just run. User has pre-approved via invocation.
- Don't commit files that may contain secrets (.env, credentials.json, tokens.json). Git should already ignore via .gitignore; if not, skip those files explicitly.
- Don't force-push. Don't amend.
- Don't log trivial sessions (quick questions, zero file changes) — skip Notion in that case.
- Don't post to public channels (LinkedIn, Twitter, Substack) — this skill is internal only.
