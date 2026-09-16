const hooks = [
  {
    event: "PostToolUse",
    name: "prettier auto-format",
    class: "formatter",
    savesPerWeek: "~600s",
    desc: "Formats every file Claude writes or edits. 180ms latency, ~40 fires/week on active projects.",
  },
  {
    event: "PostToolUse",
    name: "ESLint autofix",
    class: "formatter",
    savesPerWeek: "~300s",
    desc: "Runs eslint --fix on TS/JS files after every write. Only activates for .ts/.tsx/.js/.jsx extensions.",
  },
  {
    event: "PostToolUse",
    name: "black formatter",
    class: "formatter",
    savesPerWeek: "~240s",
    desc: "Python black on every .py write. Same pattern as prettier — fire and forget.",
  },
  {
    event: "PostToolUse",
    name: "desktop notification",
    class: "notify",
    savesPerWeek: "~120s",
    desc: "macOS notification when Bash finishes. Saves context-switch latency when you've switched tabs.",
  },
  {
    event: "PostToolUse",
    name: "audio chime (Bash)",
    class: "notify",
    savesPerWeek: "~80s",
    desc: "Light afplay chime on Bash completion. 12ms latency. Works while screen is off.",
  },
  {
    event: "PostToolUse",
    name: "git diff snapshot",
    class: "logger",
    savesPerWeek: "0 (audit)",
    desc: "Appends git diff --stat to a dated log file after every write. Zero perceived latency, async.",
  },
  {
    event: "PostToolUse",
    name: "session tool log",
    class: "logger",
    savesPerWeek: "0 (audit)",
    desc: "Writes every tool call to a JSONL session file. Use for replay debugging and usage analysis.",
  },
  {
    event: "PreToolUse",
    name: "destructive Bash guard",
    class: "guard",
    savesPerWeek: "~48s",
    desc: "Blocks rm -rf, DROP TABLE, git push --force, git reset --hard. Exit 2 before Claude executes.",
  },
  {
    event: "PreToolUse",
    name: "npm publish guard",
    class: "guard",
    savesPerWeek: "~n/a",
    desc: "Blocks accidental npm publish. Claude must tell you to run it manually.",
  },
  {
    event: "PreToolUse",
    name: ".env write guard",
    class: "guard",
    savesPerWeek: "~n/a",
    desc: "Blocks Write tool calls targeting .env or .env.* files. Secrets stay out of Claude's write path.",
  },
  {
    event: "PreToolUse",
    name: "destructive SQL guard",
    class: "guard",
    savesPerWeek: "~n/a",
    desc: "Blocks DROP TABLE, TRUNCATE TABLE, DELETE without WHERE clause via Bash.",
  },
  {
    event: "PreToolUse",
    name: "write audit trail",
    class: "logger",
    savesPerWeek: "0 (audit)",
    desc: "Logs every file path Claude writes to a TSV. Useful for code review and permission auditing.",
  },
  {
    event: "Stop",
    name: "Glass chime",
    class: "notify",
    savesPerWeek: "~144s",
    desc: "afplay Glass.aiff when Claude finishes any turn. 8s × 60% away rate × 30 fires/week.",
  },
  {
    event: "Stop",
    name: "macOS notification",
    class: "notify",
    savesPerWeek: "~100s",
    desc: 'More visible alternative to the chime. Shows "Claude finished" in Notification Center.',
  },
  {
    event: "Stop",
    name: "session end log",
    class: "logger",
    savesPerWeek: "0 (audit)",
    desc: "Appends a timestamped entry to /tmp/claude-sessions.log when a session ends.",
  },
];

const classColors: Record<string, string> = {
  formatter: "#4a7c59",
  guard: "#7c4a4a",
  notify: "#4a5f7c",
  logger: "#5a5a4a",
};

export function HooksSection() {
  return (
    <section
      id="hooks"
      className="max-w-4xl mx-auto px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "56px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          hooks/library.md
        </div>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 300,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
            marginBottom: "12px",
          }}
        >
          15 opinionated hooks
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "480px",
            lineHeight: 1.65,
          }}
        >
          With measured ROI from the <code>claude-code-hook-eval</code> skill.
          Copy any block into your <code>~/.claude/settings.json</code>.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        {hooks.map((hook) => (
          <div
            key={hook.name}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
                gap: "8px",
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: "12px",
                  color: "var(--color-ink)",
                  fontWeight: 500,
                }}
              >
                {hook.name}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  padding: "2px 7px",
                  borderRadius: "3px",
                  background: classColors[hook.class] + "22",
                  color: classColors[hook.class],
                  border: `1px solid ${classColors[hook.class]}44`,
                  whiteSpace: "nowrap",
                }}
              >
                {hook.class}
              </span>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-ink-dim)",
                lineHeight: 1.6,
                margin: "0 0 10px",
              }}
            >
              {hook.desc}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: "10px", color: "var(--color-muted)" }}
              >
                {hook.event}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: "10px", color: "var(--color-accent-dim)" }}
              >
                {hook.savesPerWeek}/wk
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
