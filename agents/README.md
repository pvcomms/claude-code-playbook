# Agents

Claude Code subagent definitions. Drop into `~/.claude/agents/` (global) or `.claude/agents/` (project) to enable.

| Agent                                       | Purpose                                                                                                                                      | Model  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [docs-generator](docs-generator.md)         | Extract API/module reference docs from source                                                                                                | haiku  |
| [test-writer](test-writer.md)               | Write unit + integration tests, iterate until green                                                                                          | sonnet |
| [security-reviewer](security-reviewer.md)   | Audit for OWASP top-10, injection, authN/authZ, secrets                                                                                      | sonnet |
| [keep-market-doctor](keep-market-doctor.md) | Full lifecycle audit of a Keep / Cyborg Market — oracle liveness, Whoop replay, settler cron, payout preview, single-source risk. Read-only. | sonnet |

Invoke via the `Agent` tool with `subagent_type: <name>`.
