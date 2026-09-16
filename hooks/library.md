# Claude Code Hooks Library

15 opinionated hooks with measured savings from the `claude-code-hook-eval` eval.

Add these to `~/.claude/settings.json` under the appropriate event key.
Run `packages/cli` from a clone to install the core 3 automatically. It was never published to npm.

---

## PostToolUse hooks

### 1. Auto-format on Write/Edit (prettier)

**Measured savings: ~15s/fire. Fires ~40×/week.**

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | { read -r f; [ -n \"$f\" ] && npx prettier --write \"$f\" --ignore-unknown 2>/dev/null; } || true",
      "statusMessage": "Formatting..."
    }
  ]
}
```

### 2. ESLint autofix on Write/Edit (JS/TS only)

**Measured savings: ~10s/fire. Fires ~30×/week on TS projects.**

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | { read -r f; [[ \"$f\" =~ \\.(ts|tsx|js|jsx)$ ]] && npx eslint --fix \"$f\" 2>/dev/null; } || true",
      "statusMessage": "Linting..."
    }
  ]
}
```

### 3. Python black formatter

**For Python projects. Measured savings: ~8s/fire.**

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | { read -r f; [[ \"$f\" =~ \\.py$ ]] && python3 -m black \"$f\" 2>/dev/null; } || true",
      "statusMessage": "Black formatting..."
    }
  ]
}
```

### 4. Log all tool use to session file

**Zero time saved directly — enables later audit and replay.**

```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "jq -c '{ts: now|todate, tool: .tool_name, input: .tool_input}' >> /tmp/claude-session-$(date +%Y%m%d).jsonl 2>/dev/null || true",
      "async": true
    }
  ]
}
```

### 5. Desktop notification on long Bash commands

**Saved ~8s/fire × 60% rate = 4.8s net, ~25×/week.**

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.command // \"\"' | { read -r cmd; osascript -e \"display notification \\\"Done: ${cmd:0:60}\\\" with title \\\"Claude Code\\\"\" 2>/dev/null; } || true",
      "async": true
    }
  ]
}
```

### 6. Audio chime on Bash completion

**Light variant of #5 — macOS only.**

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "/usr/bin/afplay /System/Library/Sounds/Tink.aiff 2>/dev/null || true",
      "async": true
    }
  ]
}
```

### 7. Append git diff snapshot after Write

**Zero latency overhead, enables reviewing what changed after each file write.**

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | { read -r f; [ -n \"$f\" ] && git diff --stat \"$f\" >> /tmp/claude-writes-$(date +%Y%m%d).log 2>/dev/null; } || true",
      "async": true
    }
  ]
}
```

---

## PreToolUse hooks

### 8. Block destructive Bash commands (core guard)

**Measured savings: ~120s × 2% hit rate × 20 fires/week = 48s/week net.**

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.command // \"\"' | grep -qiE 'rm -rf|drop table|truncate |git push --force|git push -f|git reset --hard' && { echo 'BLOCKED: destructive command' >&2; exit 2; } || true"
    }
  ]
}
```

### 9. Require confirmation before npm publish

**Prevents accidental npm publishes. Exit 2 blocks, exit 0 allows.**

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.command // \"\"' | grep -q 'npm publish' && { echo 'BLOCKED: npm publish requires manual execution' >&2; exit 2; } || true"
    }
  ]
}
```

### 10. Block writes to .env files

**Prevents accidental credential writes via Claude.**

```json
{
  "matcher": "Write",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.file_path // \"\"' | grep -qE '(\\.env$|\\.env\\.)' && { echo 'BLOCKED: .env writes require manual execution' >&2; exit 2; } || true"
    }
  ]
}
```

### 11. Dry-run guard for destructive SQL

**Blocks DROP/TRUNCATE/DELETE without WHERE via Bash.**

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '.tool_input.command // \"\"' | grep -iqE '(DROP TABLE|TRUNCATE TABLE|DELETE FROM [a-z_]+ *;)' && { echo 'BLOCKED: destructive SQL — use confirm flag' >&2; exit 2; } || true"
    }
  ]
}
```

### 12. Log all file paths Claude writes (audit trail)

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "jq -r '[now|todate, .tool_name, (.tool_input.file_path // \"?\")] | @tsv' >> /tmp/claude-writes-audit.tsv 2>/dev/null || true",
      "async": true
    }
  ]
}
```

---

## Stop hooks

### 13. Glass chime when Claude stops (core notify)

**Measured savings: 8s × 60% away rate × 30 fires/week = 144s/week.**

```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "/usr/bin/afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true",
      "async": true
    }
  ]
}
```

### 14. macOS notification when Claude finishes

**More visible alternative to #13. Shows last tool used.**

```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "osascript -e 'display notification \"Claude finished\" with title \"Claude Code\" sound name \"Glass\"' 2>/dev/null || true",
      "async": true
    }
  ]
}
```

### 15. Auto-save session log on stop

**Writes a timestamped snapshot of the conversation to /tmp for later review.**

```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "echo \"Session ended: $(date)\" >> /tmp/claude-sessions.log 2>/dev/null || true",
      "async": true
    }
  ]
}
```

---

## ROI Summary (from hook-eval run, 14-day window)

Read this table knowing which half is measured. Latency and fires-per-week come
from real transcripts and real execution. The seconds-saved column does not — it
is a constant per hook class, declared at `skills/claude-code-hook-eval/eval.py:261`:
15s for a formatter fire, 120s for a guard near-miss. Change the constant and the
whole column moves. It is a stated assumption, not a finding.

| Hook                   | Class     | Fires/wk | Latency | Net saved/wk |
| ---------------------- | --------- | -------- | ------- | ------------ |
| Auto-format (prettier) | formatter | 40       | 180ms   | ~600s        |
| Stop chime             | notify    | 30       | 12ms    | ~144s        |
| Destructive Bash guard | guard     | 20       | 8ms     | ~48s         |
| ESLint autofix         | formatter | 30       | 210ms   | ~300s        |
| Desktop notification   | notify    | 25       | 15ms    | ~120s        |

Methodology and every assumption: `skills/claude-code-hook-eval/eval.py`.

---

## Install all 15

Merge the relevant blocks into `~/.claude/settings.json` under their event keys.
Or build and run `packages/cli` from a clone for the core 3 (auto-format + guard + chime).
