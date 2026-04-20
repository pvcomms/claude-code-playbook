import { NextRequest } from "next/server";

// SSE stream of playbook firing events. In dev we synthesise from a pool of
// skills/hooks/MCPs so the UI has something to render. The catalog types are
// the source of truth; this mirrors the shape the real tap would emit.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FiringCategory = "skill" | "hook" | "mcp";

type Firing = {
  id: string;
  ts: number;
  category: FiringCategory;
  name: string;
  detail: string;
};

const POOL: Omit<Firing, "id" | "ts">[] = [
  { category: "skill", name: "session-save", detail: "triggered by 'ship it'" },
  { category: "skill", name: "param-voice", detail: "loaded for draft post" },
  { category: "skill", name: "eval-this", detail: "4-model bake-off started" },
  { category: "skill", name: "yt-tldr", detail: "matched youtube.com URL" },
  {
    category: "hook",
    name: "prettier auto-format",
    detail: "PostToolUse · 180ms · formatted 1 file",
  },
  {
    category: "hook",
    name: "destructive Bash guard",
    detail: "PreToolUse · allowed (safe cmd)",
  },
  {
    category: "hook",
    name: ".env write guard",
    detail: "PreToolUse · BLOCKED write to .env.local",
  },
  {
    category: "hook",
    name: "session tool log",
    detail: "PostToolUse · wrote JSONL entry",
  },
  { category: "hook", name: "Stop chime", detail: "Stop · Glass.aiff played" },
  {
    category: "mcp",
    name: "mcp-vercel",
    detail: "vercel_list_deployments · 12 hits",
  },
  {
    category: "mcp",
    name: "mcp-whoop",
    detail: "whoop_get_cycle_recovery · 1 row",
  },
  {
    category: "mcp",
    name: "mcp-hooks",
    detail: "claude_hooks_list_all · 15 hooks",
  },
  {
    category: "mcp",
    name: "mcp-spaceship",
    detail: "spaceship_list_dns_records · 4 rows",
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // controller closed
        }
      }

      // Open with a hello so the client can flip to connected immediately.
      send("hello", { ts: Date.now() });

      // Emit one firing every 1.2–2.6s.
      function tick() {
        const base = pick(POOL);
        const f: Firing = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ts: Date.now(),
          ...base,
        };
        send("firing", f);
      }
      tick();
      interval = setInterval(
        () => {
          tick();
        },
        1200 + Math.floor(Math.random() * 1400),
      );

      // Keepalive — a comment line every 15s keeps proxies from closing.
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // swallow
        }
      }, 15_000);

      const abort = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", abort);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
