#!/usr/bin/env node
// `playbook tail` — stream firings from a running site over SSE.
// Shares the event shape with /api/stream/firings. For quick CLI inspection
// when the browser UI is not open.

import pc from "picocolors";

const URL_DEFAULT =
  process.env.PLAYBOOK_STREAM_URL ?? "http://localhost:3000/api/stream/firings";

type FiringCategory = "skill" | "hook" | "mcp";

type Firing = {
  id: string;
  ts: number;
  category: FiringCategory;
  name: string;
  detail: string;
};

const colorFor: Record<FiringCategory, (s: string) => string> = {
  skill: pc.yellow,
  hook: pc.green,
  mcp: pc.cyan,
};

function format(f: Firing): string {
  const t = new Date(f.ts).toISOString().slice(11, 19);
  const tag = colorFor[f.category](`[${f.category}]`.padEnd(8));
  return `${pc.dim(t)} ${tag} ${pc.bold(f.name)} ${pc.dim("·")} ${f.detail}`;
}

async function tail(url: string) {
  let backoff = 500;
  while (true) {
    try {
      process.stderr.write(pc.dim(`→ connecting ${url}\n`));
      const res = await fetch(url, {
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      process.stderr.write(pc.green("✓ live\n"));
      backoff = 500;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        // SSE frames are delimited by a blank line.
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          currentEvent = "";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              data += line.slice(5).trim();
            }
          }
          if (!data) continue;
          if (currentEvent === "firing") {
            try {
              const f = JSON.parse(data) as Firing;
              process.stdout.write(format(f) + "\n");
            } catch {
              // ignore
            }
          }
        }
      }
      throw new Error("stream ended");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(
        pc.yellow(`! reconnecting (${msg}) in ${backoff}ms\n`),
      );
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(8000, backoff * 2);
    }
  }
}

const url = process.argv[2] ?? URL_DEFAULT;
tail(url).catch((e) => {
  console.error(e);
  process.exit(1);
});
