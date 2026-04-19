const leaderboard = [
  {
    model: "claude-opus-4-7",
    score: "97.7%",
    tier: "large",
    cost: "$0.38",
  },
  {
    model: "claude-sonnet-4-6",
    score: "97.7%",
    tier: "large",
    cost: "$0.09",
  },
  {
    model: "gpt-4o-mini",
    score: "90.9%",
    tier: "small",
    cost: "$0.008",
  },
  { model: "claude-haiku-4-5", score: "84.0%", tier: "small", cost: "$0.02" },
  { model: "gpt-4o", score: "76.0%", tier: "large", cost: "$0.22" },
  { model: "gemini-2.5-pro", score: "70.0%", tier: "large", cost: "$0.18" },
  {
    model: "gemini-2.5-flash",
    score: "46.0%",
    tier: "small",
    cost: "$0.03",
  },
];

export function EvalsSection() {
  return (
    <section
      id="evals"
      className="max-w-4xl mx-auto px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "56px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          evals/
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
          5 open evals
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "520px",
            lineHeight: 1.65,
          }}
        >
          Every result is reproducible. Scripts in <code>skills/</code>,
          leaderboard JSON in <code>evals/results/</code>. Run them yourself.
        </p>
      </div>

      {/* MCP Tool Selection leaderboard */}
      <div className="card" style={{ marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
          }}
        >
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: "13px",
                color: "var(--color-ink)",
                fontWeight: 500,
                marginBottom: "4px",
              }}
            >
              mcp-tool-selection-eval v2
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-ink-dim)" }}>
              First-try tool correctness — 44 tools, 6 servers, 50 queries, 7
              models
            </div>
          </div>
          <span className="tag">accuracy</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr>
                {["model", "accuracy", "tier", "cost / run"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--color-border)",
                      color: "var(--color-muted)",
                      fontWeight: 400,
                      fontSize: "11px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.model}>
                  <td
                    style={{
                      padding: "10px 0",
                      color:
                        i < 2 ? "var(--color-ink)" : "var(--color-ink-dim)",
                      borderBottom:
                        i < leaderboard.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                    }}
                  >
                    {row.model}
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color:
                        parseFloat(row.score) >= 90
                          ? "var(--color-accent)"
                          : parseFloat(row.score) >= 70
                            ? "var(--color-ink-dim)"
                            : "var(--color-muted)",
                      borderBottom:
                        i < leaderboard.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                      fontWeight: i < 2 ? 500 : 400,
                    }}
                  >
                    {row.score}
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "var(--color-muted)",
                      borderBottom:
                        i < leaderboard.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                    }}
                  >
                    {row.tier}
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "var(--color-muted)",
                      borderBottom:
                        i < leaderboard.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                    }}
                  >
                    {row.cost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eval grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            name: "eval-this",
            desc: "Multi-model prompt bake-off. Opus judge, cost tracking, markdown table.",
            run: '~/.claude/skills/eval-this/eval.py "prompt"',
          },
          {
            name: "voice-preservation-eval",
            desc: "Voice drift after N rewrites. Fingerprint + coined-phrase survival rates.",
            run: "~/.claude/skills/voice-preservation-eval/eval.py -n 5",
          },
          {
            name: "claude-code-hook-eval",
            desc: "Wall-clock time saved per hook. ROI + keep/tune/drop verdicts.",
            run: "~/.claude/skills/claude-code-hook-eval/eval.py --days 14",
          },
          {
            name: "yt-tldr-eval",
            desc: "100-video summarization bake-off. Faithfulness + hallucination tracking.",
            run: "~/.claude/skills/yt-tldr-eval/eval.py --videos 20",
          },
        ].map((ev) => (
          <div
            key={ev.name}
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
                fontSize: "13px",
                color: "var(--color-ink)",
                fontWeight: 500,
                marginBottom: "8px",
              }}
            >
              {ev.name}
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-ink-dim)",
                lineHeight: 1.6,
                marginBottom: "12px",
              }}
            >
              {ev.desc}
            </p>
            <code
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {ev.run}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}
