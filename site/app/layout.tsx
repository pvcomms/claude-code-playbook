import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Code Playbook — paramxclaudedev",
  description:
    "4 MCPs, 11 skills, 15 hooks, 5 evals, 1 CLI. The full autonomous Claude Code stack, open-sourced.",
  openGraph: {
    title: "Claude Code Playbook",
    description:
      "4 MCPs, 11 skills, 15 hooks, 5 evals, 1 CLI. The full autonomous Claude Code stack.",
    url: "https://claudecode.paramvaswani.com",
    siteName: "Claude Code Playbook",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Playbook",
    description: "4 MCPs, 11 skills, 15 hooks, 5 evals, 1 CLI.",
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
