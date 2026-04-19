const skills = [
  {
    name: "session-save",
    trigger: '"save", "ship it", "wrap up"',
    desc: "End-of-session protocol. Commits + deploys every touched project, logs to Notion, syncs Todoist, updates memory files. Auto-triggers at ~95% context.",
  },
  {
    name: "param-voice",
    trigger: '"draft post", "write essay"',
    desc: "Drafts in a consistent voice using a 12-essay corpus + style playbook. Fingerprint / coined-phrase / banned-phrase scoring built in.",
  },
  {
    name: "eval-this",
    trigger: '"eval this: <prompt>"',
    desc: "Multi-model prompt bake-off. One prompt → Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-5, Gemini 2.5 Pro → Opus-judged comparison table.",
  },
  {
    name: "voice-preservation-eval",
    trigger: '"voice eval"',
    desc: "N-iteration rewrite chain per model, Opus judges voice drift vs seed essay. Outputs per-iteration fingerprint + leak log.",
  },
  {
    name: "claude-code-hook-eval",
    trigger: '"hook eval", "audit my hooks"',
    desc: "Measures wall-clock time saved per hook. Mines transcript JSONLs for fire counts, benchmarks real latency, outputs ROI + keep/tune/drop verdicts.",
  },
  {
    name: "mcp-tool-selection-eval",
    trigger: '"tool selection eval"',
    desc: "First-try accuracy across 44 tools from 6 MCP servers, 7 models. Headline: Opus 4.7 = Sonnet 4.6 = 97.7%. GPT-5 Mini 90.9%.",
  },
  {
    name: "yt-tldr",
    trigger: "YouTube URL",
    desc: "Transcript → structured digest. Key arguments, timestamps, rabbit-hole links, takeaways. Works with any public video.",
  },
  {
    name: "yt-tldr-eval",
    trigger: '"yt eval"',
    desc: "100-video bake-off. Faithfulness / compression / coverage / style + hallucination list per model. Opus judge.",
  },
  {
    name: "investor-reply",
    trigger: "VC email paste",
    desc: "Classifies inbound (cold/warm/partner/scout/accelerator/angel), drafts reply, outputs counter-diligence sheet.",
  },
  {
    name: "taste",
    trigger: "any frontend task",
    desc: "Anti-slop framework. Swap Test, banned defaults (Inter, generic gradients, pill buttons), required choices (Fraunces, warm monochrome, spring physics).",
  },
  {
    name: "frontend-design",
    trigger: "any UI build",
    desc: "Production-grade frontend design. Systematic visual hierarchy, editorial luxury aesthetic, distinctive component patterns.",
  },
];

export function SkillsSection() {
  return (
    <section
      id="skills"
      className="max-w-4xl mx-auto px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "56px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          skills/
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
          11 installable skills
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "480px",
            lineHeight: 1.65,
          }}
        >
          Each is a <code>SKILL.md</code> in <code>~/.claude/skills/</code>.
          Claude loads it when you say the trigger phrase — no slash commands,
          no config.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        {skills.map((skill, i) => (
          <div
            key={skill.name}
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: "24px",
              padding: "20px 0",
              borderBottom: "1px solid var(--color-border)",
              alignItems: "start",
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
                {skill.name}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  lineHeight: 1.5,
                }}
              >
                {skill.trigger}
              </div>
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "var(--color-ink-dim)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {skill.desc}
            </p>
          </div>
        ))}
      </div>

      <pre style={{ marginTop: "32px" }}>
        {`# Install all skills
npx @paramxclaudedev/setup

# Or copy individually
cp -r skills/session-save ~/.claude/skills/`}
      </pre>
    </section>
  );
}
