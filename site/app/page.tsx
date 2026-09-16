import { MCPSection } from "./components/MCPSection";
import { SkillsSection } from "./components/SkillsSection";
import { HooksSection } from "./components/HooksSection";
import { EvalsSection } from "./components/EvalsSection";
import { InstallSection } from "./components/InstallSection";
import { ComposerExplorer } from "./components/ComposerExplorer";
import { LiveFiringsFeed } from "./components/LiveFiringsFeed";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <main
      style={{ background: "var(--color-bg)", minHeight: "100vh" }}
      className="antialiased"
    >
      <Nav />

      {/* Hero */}
      <section
        style={{ paddingTop: "120px", paddingBottom: "120px" }}
        className="max-w-4xl mx-auto px-6"
      >
        <div className="animate-fade-up">
          <div className="tag" style={{ marginBottom: "24px" }}>
            paramxclaudedev / claude-code-playbook
          </div>
        </div>

        <h1
          className="font-display animate-fade-up animate-delay-100"
          style={{
            fontSize: "clamp(40px, 6vw, 72px)",
            fontWeight: 300,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "var(--color-ink)",
            marginBottom: "28px",
          }}
        >
          Two weeks with Claude Code.
          <br />
          <em style={{ color: "var(--color-accent)", fontStyle: "italic" }}>
            This is what I built.
          </em>
        </h1>

        <p
          className="animate-fade-up animate-delay-200"
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "var(--color-ink-dim)",
            maxWidth: "560px",
            marginBottom: "48px",
          }}
        >
          10 skills. 15 hooks with measured ROI. 5 open evals. 1 CLI that
          bootstraps the stack from a clone. The four MCP servers moved to
          pvcomms/mcp-fleet.
        </p>

        <div
          className="animate-fade-up animate-delay-300"
          style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
        >
          <a
            href="https://github.com/pvcomms/claude-code-playbook"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            View on GitHub →
          </a>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 24px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              color: "var(--color-ink-dim)",
            }}
          >
            git clone github.com/pvcomms/claude-code-playbook
          </div>
        </div>

        {/* Stats row */}
        <div
          className="animate-fade-up animate-delay-400"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "1px",
            marginTop: "80px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          {[
            { n: "10", label: "skills" },
            { n: "15", label: "hooks" },
            { n: "5", label: "open evals" },
            { n: "1", label: "CLI installer" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--color-surface)",
                padding: "28px 24px",
                textAlign: "center",
              }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: "40px",
                  fontWeight: 300,
                  color: "var(--color-ink)",
                  lineHeight: 1,
                  marginBottom: "6px",
                }}
              >
                {stat.n}
              </div>
              <div
                style={{ fontSize: "13px", color: "var(--color-muted)" }}
                className="font-mono"
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="divider" style={{ maxWidth: "100%" }} />

      <MCPSection />
      <hr className="divider" />
      <SkillsSection />
      <hr className="divider" />
      <HooksSection />
      <hr className="divider" />
      <EvalsSection />
      <hr className="divider" />
      <ComposerExplorer />
      <hr className="divider" />
      <LiveFiringsFeed />
      <hr className="divider" />
      <InstallSection />

      <Footer />
    </main>
  );
}
