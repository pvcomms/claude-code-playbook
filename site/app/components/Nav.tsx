export function Nav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--color-border)",
        background: "rgba(10, 10, 9, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="max-w-4xl mx-auto px-6"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "56px",
        }}
      >
        <span
          className="font-mono"
          style={{ fontSize: "13px", color: "var(--color-ink-dim)" }}
        >
          <span style={{ color: "var(--color-accent)" }}>param</span>
          xclaudedev
        </span>

        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {[
            { label: "MCPs", href: "#mcps" },
            { label: "Skills", href: "#skills" },
            { label: "Hooks", href: "#hooks" },
            { label: "Evals", href: "#evals" },
            { label: "Compose", href: "#composer" },
            { label: "Live", href: "#firings" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono link-muted"
              style={{ fontSize: "12px" }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://github.com/paramxclaudedev/claude-code-playbook"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono link-accent"
            style={{ fontSize: "12px" }}
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
