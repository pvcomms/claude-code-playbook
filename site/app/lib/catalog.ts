// Catalog of playbook building blocks — the source of truth for the
// composition explorer. Edit this file to add/retune skills, hooks, MCPs,
// goals, or recipes. Do not hardcode elsewhere.

export type Category = "skill" | "hook" | "mcp";

export type CatalogNode = {
  id: string;
  kind: Category;
  name: string;
  slug?: string;
  summary: string;
  // Tags drive alternative lookup. alternativesForStep(stepId) returns nodes
  // that share at least one tag with the step's tags, excluding the current.
  tags: string[];
  // Optional: settings.json fragment (for hooks) or MCP registration block.
  settingsFragment?: unknown;
};

export type GoalStep = {
  nodeId: string;
  rationale: string;
  tags: string[];
};

export type Goal = {
  id: string;
  title: string;
  blurb: string;
  steps: GoalStep[];
};

export const nodes: CatalogNode[] = [
  {
    id: "skill:session-save",
    kind: "skill",
    name: "session-save",
    slug: "session-save",
    summary:
      "Commit + deploy every touched project, log Notion, sync Todoist, update memory. Auto-triggers at ~95% context.",
    tags: ["ship", "persist", "end-of-session", "observability"],
  },
  {
    id: "skill:param-voice",
    kind: "skill",
    name: "param-voice",
    slug: "param-voice",
    summary:
      "12-essay corpus + playbook for drafting under a consistent voice.",
    tags: ["writing", "voice"],
  },
  {
    id: "skill:eval-this",
    kind: "skill",
    name: "eval-this",
    slug: "eval-this",
    summary:
      "Multi-model prompt bake-off (Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-5, Gemini 2.5 Pro) with Opus-judged comparison.",
    tags: ["eval", "benchmark", "model-choice"],
  },
  {
    id: "skill:voice-preservation-eval",
    kind: "skill",
    name: "voice-preservation-eval",
    slug: "voice-preservation-eval",
    summary: "Measures voice drift across N rewrite iterations per model.",
    tags: ["eval", "writing"],
  },
  {
    id: "skill:claude-code-hook-eval",
    kind: "skill",
    name: "claude-code-hook-eval",
    slug: "claude-code-hook-eval",
    summary:
      "Measures wall-clock time saved per hook. Mines JSONL transcripts + benchmarks latency. Keep/tune/drop verdict.",
    tags: ["eval", "hook", "audit", "roi"],
  },
  {
    id: "skill:mcp-tool-selection-eval",
    kind: "skill",
    name: "mcp-tool-selection-eval",
    slug: "mcp-tool-selection-eval",
    summary:
      "First-try accuracy across ~44 tools, 7 models. Direct + semantic + ambiguous + negative.",
    tags: ["eval", "mcp", "routing"],
  },
  {
    id: "skill:yt-tldr",
    kind: "skill",
    name: "yt-tldr",
    slug: "yt-tldr",
    summary:
      "YouTube URL to structured digest — key arguments, timestamps, rabbit holes.",
    tags: ["content", "summarize"],
  },
  {
    id: "skill:yt-tldr-eval",
    kind: "skill",
    name: "yt-tldr-eval",
    slug: "yt-tldr-eval",
    summary:
      "100-video bake-off with faithfulness / coverage / style + hallucination list.",
    tags: ["eval", "content"],
  },
  {
    id: "skill:investor-reply",
    kind: "skill",
    name: "investor-reply",
    slug: "investor-reply",
    summary:
      "Classifies VC email, drafts reply, outputs counter-diligence sheet.",
    tags: ["writing", "fundraise"],
  },
  {
    id: "skill:taste",
    kind: "skill",
    name: "taste",
    slug: "taste",
    summary:
      "Anti-slop framework. Swap Test, banned defaults, required choices.",
    tags: ["frontend", "design", "audit"],
  },

  {
    id: "hook:prettier",
    kind: "hook",
    name: "prettier auto-format",
    summary: "PostToolUse — format every file Claude writes (~600s saved/wk).",
    tags: ["formatter", "PostToolUse", "build"],
    settingsFragment: {
      hooks: {
        PostToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command: 'npx prettier --write "$file" --ignore-unknown',
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "hook:eslint",
    kind: "hook",
    name: "ESLint autofix",
    summary: "PostToolUse — eslint --fix on TS/JS writes.",
    tags: ["formatter", "PostToolUse", "build"],
  },
  {
    id: "hook:destructive-bash-guard",
    kind: "hook",
    name: "destructive Bash guard",
    summary: "PreToolUse — blocks rm -rf, DROP TABLE, force push, hard reset.",
    tags: ["guard", "PreToolUse", "audit", "safety"],
  },
  {
    id: "hook:env-write-guard",
    kind: "hook",
    name: ".env write guard",
    summary: "PreToolUse — blocks Write calls targeting .env or .env.* files.",
    tags: ["guard", "PreToolUse", "audit", "safety", "secrets"],
  },
  {
    id: "hook:write-audit",
    kind: "hook",
    name: "write audit trail",
    summary: "PreToolUse — logs every file path Claude writes to a TSV.",
    tags: ["logger", "PreToolUse", "audit", "observability"],
  },
  {
    id: "hook:session-log",
    kind: "hook",
    name: "session tool log",
    summary: "PostToolUse — writes every tool call to a JSONL session file.",
    tags: ["logger", "PostToolUse", "audit", "observability"],
  },
  {
    id: "hook:stop-notify",
    kind: "hook",
    name: "Stop chime",
    summary: "Stop — afplay Glass.aiff when a turn finishes.",
    tags: ["notify", "Stop"],
  },

  {
    id: "mcp:vercel",
    kind: "mcp",
    name: "mcp-vercel",
    slug: "mcp-vercel",
    summary:
      "15 tools — deployments, projects, domains, env vars, logs. Required for ship workflows.",
    tags: ["ship", "deploy", "vercel"],
  },
  {
    id: "mcp:spaceship",
    kind: "mcp",
    name: "mcp-spaceship",
    slug: "mcp-spaceship",
    summary:
      "14 tools — registrar API: availability, register, DNS, nameservers.",
    tags: ["ship", "domain", "dns"],
  },
  {
    id: "mcp:whoop",
    kind: "mcp",
    name: "mcp-whoop",
    slug: "mcp-whoop",
    summary: "11 tools — recovery, sleep, strain, workouts, body measurements.",
    tags: ["biometric", "oracle"],
  },
  {
    id: "mcp:hooks",
    kind: "mcp",
    name: "mcp-hooks",
    slug: "mcp-hooks",
    summary:
      "3 tools — read-only introspection of ~/.claude/settings.json hooks.",
    tags: ["hook", "audit", "observability"],
  },
];

export const goals: Goal[] = [
  {
    id: "ship-fast",
    title: "Ship a feature fast",
    blurb:
      "Minimal friction from idea to live. Format-on-write, guard the obvious, deploy and log the session.",
    steps: [
      {
        nodeId: "hook:prettier",
        rationale: "Format every write so review is about intent, not style.",
        tags: ["formatter", "build"],
      },
      {
        nodeId: "hook:destructive-bash-guard",
        rationale: "One bad rm -rf kills more time than the guard costs.",
        tags: ["guard", "safety"],
      },
      {
        nodeId: "mcp:vercel",
        rationale: "Ship target. Deployments, env vars, logs — all tooled.",
        tags: ["ship", "deploy"],
      },
      {
        nodeId: "skill:session-save",
        rationale:
          "End of session — commit, deploy, log Notion, sync Todoist. No loose ends.",
        tags: ["ship", "persist", "end-of-session"],
      },
    ],
  },
  {
    id: "audit-repo",
    title: "Audit a repo",
    blurb:
      "Before touching code, know what's there. Observe tools, catch unsafe actions, measure hooks.",
    steps: [
      {
        nodeId: "hook:write-audit",
        rationale: "Full provenance of every file change during the audit.",
        tags: ["logger", "audit", "observability"],
      },
      {
        nodeId: "hook:env-write-guard",
        rationale: "Prevent accidental secret leaks while grepping config.",
        tags: ["guard", "secrets", "safety"],
      },
      {
        nodeId: "mcp:hooks",
        rationale: "Introspect the settings.json the repo expects.",
        tags: ["hook", "audit"],
      },
      {
        nodeId: "skill:claude-code-hook-eval",
        rationale: "Measure the actual ROI of the hooks on this machine.",
        tags: ["eval", "hook", "audit", "roi"],
      },
    ],
  },
  {
    id: "observability",
    title: "Add observability",
    blurb:
      "See what Claude is doing. Tool logs, write trails, and a dashboard-friendly event stream.",
    steps: [
      {
        nodeId: "hook:session-log",
        rationale: "JSONL transcript per session — replay and analysis.",
        tags: ["logger", "observability"],
      },
      {
        nodeId: "hook:write-audit",
        rationale: "Per-write TSV log — fast grep/aggregate of paths touched.",
        tags: ["logger", "audit", "observability"],
      },
      {
        nodeId: "hook:stop-notify",
        rationale: "Away-rate reduction — hear when turns finish.",
        tags: ["notify"],
      },
      {
        nodeId: "mcp:hooks",
        rationale:
          "Programmatic access to installed hooks for a live dashboard.",
        tags: ["hook", "audit", "observability"],
      },
    ],
  },
  {
    id: "write-publish",
    title: "Write and publish",
    blurb: "Draft in voice, stress-test it, ship it. Voice eval optional.",
    steps: [
      {
        nodeId: "skill:param-voice",
        rationale: "Stays in a measurable voice without slop.",
        tags: ["writing", "voice"],
      },
      {
        nodeId: "skill:voice-preservation-eval",
        rationale: "Confirm drafts don't drift across N rewrites.",
        tags: ["eval", "writing"],
      },
      {
        nodeId: "skill:session-save",
        rationale: "Commit the post + log to Notion in one step.",
        tags: ["ship", "persist"],
      },
    ],
  },
];

export function getNode(id: string): CatalogNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function getGoal(id: string): Goal | undefined {
  return goals.find((g) => g.id === id);
}

export function alternativesForStep(step: GoalStep): CatalogNode[] {
  const scored: { n: CatalogNode; score: number }[] = [];
  for (const n of nodes) {
    if (n.id === step.nodeId) continue;
    const overlap = n.tags.filter((t) => step.tags.includes(t)).length;
    if (overlap > 0) scored.push({ n, score: overlap });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.n);
}

export type Selection = Record<number, string>;

export function defaultSelection(goal: Goal): Selection {
  const s: Selection = {};
  goal.steps.forEach((step, i) => {
    s[i] = step.nodeId;
  });
  return s;
}

export function selectionToMarkdown(goal: Goal, selection: Selection): string {
  const lines: string[] = [];
  lines.push(`# Recipe — ${goal.title}`);
  lines.push("");
  lines.push(`> ${goal.blurb}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  goal.steps.forEach((step, i) => {
    const chosenId = selection[i] ?? step.nodeId;
    const node = getNode(chosenId);
    if (!node) return;
    lines.push(`- [ ] **${i + 1}. ${node.name}** _(${node.kind})_`);
    lines.push(`    - ${node.summary}`);
    const why =
      chosenId === step.nodeId
        ? step.rationale
        : `Alt over default (\`${
            getNode(step.nodeId)?.name ?? step.nodeId
          }\`). Default rationale: ${step.rationale}`;
    lines.push(`    - _Why:_ ${why}`);
  });
  lines.push("");
  return lines.join("\n");
}

export function selectionToSettingsFragment(
  goal: Goal,
  selection: Selection,
): string {
  const chosen = goal.steps.map((step, i) => {
    const id = selection[i] ?? step.nodeId;
    return getNode(id);
  });
  const hookNodes = chosen.filter(
    (n): n is CatalogNode => !!n && n.kind === "hook" && !!n.settingsFragment,
  );
  const fragment: { hooks: Record<string, unknown[]> } = { hooks: {} };
  for (const n of hookNodes) {
    const frag = n.settingsFragment as { hooks?: Record<string, unknown[]> };
    if (frag?.hooks) {
      for (const [event, arr] of Object.entries(frag.hooks)) {
        const current = fragment.hooks[event] ?? [];
        fragment.hooks[event] = [...current, ...arr];
      }
    }
  }
  const skillsAndMcps = chosen
    .filter((n): n is CatalogNode => !!n && n.kind !== "hook")
    .map((n) => `// ${n.kind}: ${n.name} — ${n.summary}`)
    .join("\n");
  return (
    (skillsAndMcps ? skillsAndMcps + "\n" : "") +
    JSON.stringify(fragment, null, 2)
  );
}
