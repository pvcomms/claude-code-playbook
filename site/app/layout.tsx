import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Code Playbook — paramxclaudedev",
  description:
    "10 skills, 15 hooks, 5 evals, 1 CLI. The Claude Code layer I actually run. MCP servers live in pvcomms/mcp-fleet.",
  openGraph: {
    title: "Claude Code Playbook",
    description:
      "10 skills, 15 hooks, 5 evals, 1 CLI. The Claude Code layer I actually run.",
    url: "https://github.com/pvcomms/claude-code-playbook",
    siteName: "Claude Code Playbook",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Playbook",
    description: "10 skills, 15 hooks, 5 evals, 1 CLI.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
