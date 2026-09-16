"use client";

import { useEffect, useRef, useState } from "react";

type FiringCategory = "skill" | "hook" | "mcp";

type Firing = {
  id: string;
  ts: number;
  category: FiringCategory;
  name: string;
  detail: string;
};

type ConnState = "connecting" | "live" | "reconnecting" | "error";

const WINDOW = 50;

const categoryColors: Record<FiringCategory, string> = {
  skill: "#c8b89a",
  hook: "#7c9a6f",
  mcp: "#7c9ab8",
};

const stateMeta: Record<
  ConnState,
  { label: string; dot: string; pulse: boolean }
> = {
  connecting: { label: "connecting", dot: "#8a7a64", pulse: true },
  live: { label: "live", dot: "#7c9a6f", pulse: true },
  reconnecting: { label: "reconnecting", dot: "#c8a86f", pulse: true },
  error: { label: "offline", dot: "#a86f6f", pulse: false },
};

function formatTime(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function LiveFiringsFeed() {
  const [firings, setFirings] = useState<Firing[]>([]);
  const [state, setState] = useState<ConnState>("connecting");
  const [paused, setPaused] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      setState(retryRef.current === 0 ? "connecting" : "reconnecting");
      const es = new EventSource("/api/stream/firings");
      esRef.current = es;

      es.addEventListener("hello", () => {
        if (cancelled) return;
        retryRef.current = 0;
        setState("live");
      });

      es.addEventListener("firing", (ev: MessageEvent) => {
        if (cancelled || pausedRef.current) return;
        try {
          const f = JSON.parse(ev.data) as Firing;
          setFirings((prev) => {
            const next = [f, ...prev];
            if (next.length > WINDOW) next.length = WINDOW;
            return next;
          });
        } catch {
          // ignore malformed
        }
      });

      es.onerror = () => {
        if (cancelled) return;
        es.close();
        setState("reconnecting");
        // Exponential backoff capped at 8s.
        const delay = Math.min(8000, 500 * Math.pow(2, retryRef.current));
        retryRef.current += 1;
        reconnectTimer = setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const meta = stateMeta[state];

  return (
    <section
      id="firings"
      className="mx-auto max-w-4xl px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "40px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          stream/firings
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
          Live firings feed
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "520px",
            lineHeight: 1.65,
          }}
        >
          Server-Sent Events from <code>/api/stream/firings</code>. Append-only,
          50-line window, colour-pill per category. Reconnects on error with
          backoff.
        </p>
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: meta.dot,
                boxShadow: meta.pulse ? `0 0 0 0 ${meta.dot}55` : "none",
                animation: meta.pulse
                  ? "firing-pulse 1.6s ease-out infinite"
                  : "none",
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-ink-dim)",
                letterSpacing: "0.04em",
              }}
              aria-live="polite"
              role="status"
            >
              {meta.label}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                marginLeft: "8px",
              }}
            >
              {firings.length}/{WINDOW}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="font-mono"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                background: paused ? "var(--color-accent)" : "transparent",
                color: paused ? "var(--color-bg)" : "var(--color-ink-dim)",
                border: `1px solid ${
                  paused ? "var(--color-accent)" : "var(--color-border)"
                }`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              {paused ? "resume" : "pause"}
            </button>
            <button
              onClick={() => setFirings([])}
              className="font-mono"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                background: "transparent",
                color: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              clear
            </button>
          </div>
        </header>

        <ol
          aria-label="Firings log"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            maxHeight: "420px",
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', Menlo, monospace",
            fontSize: "12px",
          }}
        >
          {firings.length === 0 && (
            <li
              style={{
                padding: "24px",
                color: "var(--color-muted)",
                textAlign: "center",
              }}
            >
              waiting for events…
            </li>
          )}
          {firings.map((f) => (
            <li
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "82px 64px 1fr",
                gap: "12px",
                alignItems: "baseline",
                padding: "8px 18px",
                borderTop: "1px solid var(--color-border-subtle)",
                animation: "fade-up 240ms var(--ease-spring) both",
              }}
            >
              <span style={{ color: "var(--color-muted)" }}>
                {formatTime(f.ts)}
              </span>
              <span
                style={{
                  padding: "1px 7px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  background: categoryColors[f.category] + "22",
                  color: categoryColors[f.category],
                  border: `1px solid ${categoryColors[f.category]}44`,
                  textAlign: "center",
                  letterSpacing: "0.04em",
                }}
              >
                {f.category}
              </span>
              <span style={{ color: "var(--color-ink-dim)" }}>
                <span style={{ color: "var(--color-ink)" }}>{f.name}</span>
                <span style={{ color: "var(--color-muted)" }}> · </span>
                {f.detail}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <style>{`
        @keyframes firing-pulse {
          0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70% { box-shadow: 0 0 0 6px transparent; opacity: 0.5; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        }
      `}</style>
    </section>
  );
}
