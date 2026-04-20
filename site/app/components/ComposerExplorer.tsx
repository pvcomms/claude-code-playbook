"use client";

import { useMemo, useState } from "react";
import {
  alternativesForStep,
  defaultSelection,
  getGoal,
  getNode,
  goals,
  selectionToMarkdown,
  selectionToSettingsFragment,
  type Selection,
} from "../lib/catalog";

const kindColors: Record<string, string> = {
  skill: "#c8b89a",
  hook: "#7c9a6f",
  mcp: "#7c9ab8",
};

type ExportMode = "markdown" | "settings";

export function ComposerExplorer() {
  const [goalId, setGoalId] = useState(goals[0].id);
  const goal = useMemo(() => getGoal(goalId)!, [goalId]);
  const [selection, setSelection] = useState<Selection>(() =>
    defaultSelection(goal),
  );
  const [openFork, setOpenFork] = useState<number | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("markdown");

  function pickGoal(id: string) {
    const g = getGoal(id);
    if (!g) return;
    setGoalId(id);
    setSelection(defaultSelection(g));
    setOpenFork(null);
  }

  function promoteAlt(stepIndex: number, nodeId: string) {
    setSelection((prev) => ({ ...prev, [stepIndex]: nodeId }));
    setOpenFork(null);
  }

  function resetStep(stepIndex: number) {
    const step = goal.steps[stepIndex];
    setSelection((prev) => ({ ...prev, [stepIndex]: step.nodeId }));
  }

  const exported = useMemo(() => {
    return exportMode === "markdown"
      ? selectionToMarkdown(goal, selection)
      : selectionToSettingsFragment(goal, selection);
  }, [goal, selection, exportMode]);

  return (
    <section
      id="composer"
      className="mx-auto max-w-4xl px-6"
      style={{ paddingTop: "96px", paddingBottom: "96px" }}
    >
      <div style={{ marginBottom: "56px" }}>
        <div className="tag" style={{ marginBottom: "16px" }}>
          compose/
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
          Composition explorer
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "var(--color-ink-dim)",
            maxWidth: "520px",
            lineHeight: 1.65,
          }}
        >
          Pick a goal. Follow a branching path through the playbook. Fork any
          step to see alternatives, promote one, export as a markdown checklist
          or <code>settings.json</code> fragment.
        </p>
      </div>

      {/* Goal chooser */}
      <div
        role="tablist"
        aria-label="Pick a goal"
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "32px",
        }}
      >
        {goals.map((g) => {
          const active = g.id === goalId;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={active}
              onClick={() => pickGoal(g.id)}
              className="font-mono"
              style={{
                fontSize: "12px",
                padding: "8px 14px",
                background: active
                  ? "var(--color-accent)"
                  : "var(--color-surface)",
                color: active ? "var(--color-bg)" : "var(--color-ink-dim)",
                border: `1px solid ${
                  active ? "var(--color-accent)" : "var(--color-border)"
                }`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition:
                  "background 200ms var(--ease-spring), color 200ms var(--ease-spring), border-color 200ms var(--ease-spring)",
              }}
            >
              {g.title}
            </button>
          );
        })}
      </div>

      <p
        style={{
          fontSize: "14px",
          color: "var(--color-muted)",
          fontStyle: "italic",
          marginBottom: "28px",
          maxWidth: "560px",
          lineHeight: 1.65,
        }}
      >
        {goal.blurb}
      </p>

      {/* Path */}
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {goal.steps.map((step, i) => {
          const chosenId = selection[i] ?? step.nodeId;
          const node = getNode(chosenId);
          const isDefault = chosenId === step.nodeId;
          const alts = alternativesForStep(step);
          const open = openFork === i;
          if (!node) return null;

          return (
            <li
              key={i}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "20px 22px",
                transition: "border-color 300ms var(--ease-spring)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr auto",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <div
                  className="font-mono"
                  aria-hidden="true"
                  style={{
                    fontSize: "11px",
                    color: "var(--color-muted)",
                    paddingTop: "2px",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "13px",
                        color: "var(--color-ink)",
                        fontWeight: 500,
                      }}
                    >
                      {node.name}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        padding: "2px 7px",
                        borderRadius: "3px",
                        background: kindColors[node.kind] + "22",
                        color: kindColors[node.kind],
                        border: `1px solid ${kindColors[node.kind]}44`,
                      }}
                    >
                      {node.kind}
                    </span>
                    {!isDefault && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "10px",
                          color: "var(--color-accent-dim)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        forked
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--color-ink-dim)",
                      lineHeight: 1.6,
                      margin: "0 0 6px",
                    }}
                  >
                    {node.summary}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--color-muted)",
                      lineHeight: 1.55,
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    {isDefault
                      ? step.rationale
                      : `Alt over default. ${step.rationale}`}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => setOpenFork(open ? null : i)}
                    aria-expanded={open}
                    aria-controls={`alt-panel-${i}`}
                    className="font-mono"
                    style={{
                      fontSize: "11px",
                      padding: "5px 10px",
                      background: "transparent",
                      color: "var(--color-ink-dim)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      cursor: alts.length ? "pointer" : "not-allowed",
                      opacity: alts.length ? 1 : 0.4,
                    }}
                    disabled={!alts.length}
                  >
                    {open ? "close" : `fork (${alts.length})`}
                  </button>
                  {!isDefault && (
                    <button
                      onClick={() => resetStep(i)}
                      className="font-mono"
                      style={{
                        fontSize: "11px",
                        padding: "5px 10px",
                        background: "transparent",
                        color: "var(--color-muted)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                      }}
                    >
                      reset
                    </button>
                  )}
                </div>
              </div>

              {open && alts.length > 0 && (
                <div
                  id={`alt-panel-${i}`}
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px dashed var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    alternatives · ranked by tag overlap
                  </div>
                  {alts.map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => promoteAlt(i, alt.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "160px 1fr auto",
                        gap: "12px",
                        alignItems: "start",
                        background: "transparent",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 14px",
                        textAlign: "left",
                        cursor: "pointer",
                        color: "inherit",
                        transition: "border-color 200ms var(--ease-spring)",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = "var(--color-accent-dim)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = "var(--color-border)";
                      }}
                    >
                      <div>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: "12px",
                            color: "var(--color-ink)",
                          }}
                        >
                          {alt.name}
                        </div>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: "10px",
                            color: kindColors[alt.kind],
                            marginTop: "2px",
                          }}
                        >
                          {alt.kind}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--color-ink-dim)",
                          lineHeight: 1.55,
                        }}
                      >
                        {alt.summary}
                      </div>
                      <span
                        className="font-mono"
                        aria-hidden="true"
                        style={{
                          fontSize: "11px",
                          color: "var(--color-accent)",
                        }}
                      >
                        promote →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Export */}
      <div style={{ marginTop: "40px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            export
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["markdown", "settings"] as ExportMode[]).map((mode) => {
              const active = mode === exportMode;
              return (
                <button
                  key={mode}
                  onClick={() => setExportMode(mode)}
                  aria-pressed={active}
                  className="font-mono"
                  style={{
                    fontSize: "11px",
                    padding: "5px 10px",
                    background: active ? "var(--color-surface)" : "transparent",
                    color: active
                      ? "var(--color-accent)"
                      : "var(--color-muted)",
                    border: `1px solid ${
                      active ? "var(--color-accent-dim)" : "var(--color-border)"
                    }`,
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                >
                  {mode === "markdown" ? "markdown checklist" : "settings.json"}
                </button>
              );
            })}
          </div>
        </div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{exported}</pre>
      </div>
    </section>
  );
}
