const mcps = [
  {
    name: "mcp-whoop",
    pkg: "@paramxclaudedev/mcp-server-whoop",
    tools: 11,
    desc: "WHOOP Developer API v2. Recovery, sleep, strain, workouts, body measurements as typed tools. OAuth with offline refresh, zero runtime deps.",
    envVars: ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET"],
    highlight: "readOnlyHint: true on all 11 tools",
  },
  {
    name: "mcp-spaceship",
    pkg: "spaceship-mcp-server",
    tools: 14,
    desc: "Spaceship domain registrar. Availability checks, registration, DNS records, nameservers. Register/renew dry-run by default — costs real money, so confirm:true required.",
    envVars: ["SPACESHIP_API_KEY", "SPACESHIP_API_SECRET"],
    highlight: "confirm: false default for money ops",
  },
  {
    name: "mcp-vercel",
    pkg: "@paramxclaudedev/vercel-mcp",
    tools: 15,
    desc: "Vercel REST API. Deployments, projects, domains, env vars, build logs. Pairs with mcp-spaceship — register + attach + point DNS in one prompt.",
    envVars: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
    highlight: "instant rollback via promote_to_production",
  },
  {
    name: "mcp-hooks",
    pkg: "@paramxclaudedev/claude-code-hooks-mcp",
    tools: 3,
    desc: "Read-only introspection of ~/.claude/settings.json hooks. List all hooks, query by event, inspect matchers. Write tools deliberately omitted.",
    envVars: [],
    highlight: "no env vars — reads settings.json directly",
  },
];

export function MCPSection() {
  return (
    <section
      id="mcps"
      className="max-w-4xl mx-auto px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "56px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          packages/mcp-*
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
          4 MCP servers
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "480px",
            lineHeight: 1.65,
          }}
        >
          The source moved to github.com/pvcomms/mcp-fleet, where it has tests
          and a written-up set of patterns. These are the published npm names.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {mcps.map((mcp) => (
          <div key={mcp.name} className="card">
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: "14px",
                  color: "var(--color-ink)",
                  fontWeight: 500,
                }}
              >
                {mcp.name}
              </span>
              <span className="tag">{mcp.tools} tools</span>
            </div>

            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.65,
                color: "var(--color-ink-dim)",
                marginBottom: "16px",
              }}
            >
              {mcp.desc}
            </p>

            <div
              style={{
                fontSize: "12px",
                color: "var(--color-accent-dim)",
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: "16px",
              }}
            >
              ↳ {mcp.highlight}
            </div>

            {mcp.envVars.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {mcp.envVars.map((v) => (
                  <code key={v} style={{ fontSize: "11px" }}>
                    {v}
                  </code>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--color-border)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                color: "var(--color-muted)",
              }}
            >
              {mcp.pkg}
            </div>
          </div>
        ))}
      </div>

      <pre style={{ marginTop: "32px" }}>
        {`# Install all 4
pnpm add @paramxclaudedev/mcp-server-whoop \\
         spaceship-mcp-server \\
         @paramxclaudedev/vercel-mcp \\
         @paramxclaudedev/claude-code-hooks-mcp`}
      </pre>
    </section>
  );
}
