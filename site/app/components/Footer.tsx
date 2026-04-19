export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        padding: "40px 0",
      }}
    >
      <div
        className="max-w-4xl mx-auto px-6"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: "13px",
              color: "var(--color-ink-dim)",
              marginBottom: "4px",
            }}
          >
            <span style={{ color: "var(--color-accent)" }}>param</span>
            vaswani.com
          </div>
          <div
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-muted)" }}
          >
            solo founder, bangalore. building Keep.
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {[
            {
              label: "GitHub",
              href: "https://github.com/paramxclaudedev/claude-code-playbook",
            },
            {
              label: "Bluesky",
              href: "https://bsky.app/profile/paramtheg.bsky.social",
            },
            { label: "Keep", href: "https://keep-wine.vercel.app" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono link-muted"
              style={{ fontSize: "12px" }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
