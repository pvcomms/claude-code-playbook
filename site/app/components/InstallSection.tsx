export function InstallSection() {
  return (
    <section
      id="install"
      className="max-w-4xl mx-auto px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "48px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          packages/cli
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
          Bootstrap from a clone
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "480px",
            lineHeight: 1.65,
          }}
        >
          The CLI installer copies all 10 skills into{" "}
          <code>~/.claude/skills/</code>, writes the core 3 hooks into{" "}
          <code>settings.json</code>, and prints the exact MCP registration
          config for each server. It is not on npm — build it from this repo.
        </p>
      </div>

      <pre
        style={{
          fontSize: "15px",
          padding: "28px 32px",
          lineHeight: 1.8,
          marginBottom: "32px",
        }}
      >
        {`git clone https://github.com/pvcomms/claude-code-playbook
cd claude-code-playbook/packages/cli
pnpm install && pnpm build && node dist/index.js`}
      </pre>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "48px",
        }}
      >
        {[
          {
            step: "01",
            title: "Skills installed",
            desc: "10 SKILL.md files copied into ~/.claude/skills/",
          },
          {
            step: "02",
            title: "Hooks written",
            desc: "Core 3 hooks merged into ~/.claude/settings.json",
          },
          {
            step: "03",
            title: "MCP config printed",
            desc: "Exact JSON block for each MCP — paste into ~/.claude.json",
          },
          {
            step: "04",
            title: "Restart + go",
            desc: "Restart Claude Code and say any trigger phrase to test",
          },
        ].map((item) => (
          <div
            key={item.step}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-accent-dim)",
                marginBottom: "8px",
              }}
            >
              {item.step}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "var(--color-ink)",
                fontWeight: 500,
                marginBottom: "6px",
              }}
            >
              {item.title}
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-ink-dim)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="font-display"
            style={{
              fontSize: "20px",
              fontWeight: 300,
              color: "var(--color-ink)",
              marginBottom: "6px",
            }}
          >
            Read the blog post
          </div>
          <div style={{ fontSize: "14px", color: "var(--color-ink-dim)" }}>
            2 weeks with Claude Code — 4 MCPs, 11 skills, 5 evals, 1 autonomous
            life OS
          </div>
        </div>
        <a
          href="https://github.com/pvcomms/claude-code-playbook/blob/main/blog/2-weeks-with-claude-code.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            border: "1px solid var(--color-accent)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "var(--color-accent)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Read →
        </a>
      </div>
    </section>
  );
}
