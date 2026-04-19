#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const SKILLS_DIR = join(CLAUDE_DIR, "skills");
const CLAUDE_JSON = join(HOME, ".claude.json");

const REPO = "https://github.com/paramxclaudedev/claude-code-playbook";
const SKILLS = [
  "session-save",
  "param-voice",
  "eval-this",
  "voice-preservation-eval",
  "claude-code-hook-eval",
  "mcp-tool-selection-eval",
  "yt-tldr",
  "yt-tldr-eval",
  "investor-reply",
  "taste",
  "frontend-design",
];

const MCPS = [
  {
    name: "whoop",
    pkg: "@paramxclaudedev/mcp-whoop",
    bin: "whoop-mcp-server",
    envVars: ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET"],
    note: "Run `npx tsx scripts/auth.ts` in the package dir to complete OAuth",
  },
  {
    name: "spaceship",
    pkg: "@paramxclaudedev/mcp-spaceship",
    bin: "spaceship-mcp-server",
    envVars: ["SPACESHIP_API_KEY", "SPACESHIP_API_SECRET"],
    note: "Get keys at spaceship.com/application/api-manager",
  },
  {
    name: "vercel",
    pkg: "@paramxclaudedev/mcp-vercel",
    bin: "vercel-mcp-server",
    envVars: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
    note: "VERCEL_TEAM_ID is optional. Get token at vercel.com/account/tokens",
  },
  {
    name: "hooks",
    pkg: "@paramxclaudedev/mcp-hooks",
    bin: "hooks-mcp-server",
    envVars: [],
    note: "No env vars required — reads ~/.claude/settings.json directly",
  },
];

const HOOKS_CONFIG = {
  hooks: {
    PostToolUse: [
      {
        matcher: "Write|Edit",
        hooks: [
          {
            type: "command",
            command:
              'jq -r \'.tool_input.file_path // empty\' | { read -r f; [ -n "$f" ] && npx prettier --write "$f" --ignore-unknown 2>/dev/null; } || true',
            statusMessage: "Formatting...",
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command:
              "jq -r '.tool_input.command // \"\"' | grep -qiE 'rm -rf|drop table|truncate |git push --force|git push -f' && { echo 'BLOCKED: destructive command' >&2; exit 2; } || true",
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command:
              "/usr/bin/afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true",
            async: true,
          },
        ],
      },
    ],
  },
};

function step(msg: string) {
  console.log(pc.cyan("→") + " " + msg);
}

function ok(msg: string) {
  console.log(pc.green("✓") + " " + msg);
}

function warn(msg: string) {
  console.log(pc.yellow("!") + " " + msg);
}

function run(cmd: string, opts?: { cwd?: string; silent?: boolean }) {
  const result = spawnSync(cmd, { shell: true, cwd: opts?.cwd });
  if (result.status !== 0 && !opts?.silent) {
    console.error(pc.red("✗") + ` Command failed: ${cmd}`);
    if (result.stderr) console.error(result.stderr.toString());
  }
  return result.status === 0;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log(
    "\n" +
      pc.bold(pc.white("claude-code-playbook setup")) +
      pc.dim(" — paramxclaudedev\n"),
  );

  // 1. Skills
  step("Installing skills...");
  ensureDir(SKILLS_DIR);

  const tmpDir = `/tmp/ccp-skills-${Date.now()}`;
  const cloned = run(
    `git clone --depth=1 --filter=blob:none --sparse ${REPO} ${tmpDir}`,
    { silent: true },
  );
  if (cloned) {
    run(`git sparse-checkout set skills`, { cwd: tmpDir, silent: true });
    for (const skill of SKILLS) {
      const src = join(tmpDir, "skills", skill);
      const dst = join(SKILLS_DIR, skill);
      if (existsSync(src)) {
        run(`cp -r ${src} ${dst}`);
        ok(`skill: ${skill}`);
      }
    }
    run(`rm -rf ${tmpDir}`, { silent: true });
  } else {
    warn(
      "Could not clone repo for skills. Install manually from " +
        REPO +
        "/tree/main/skills",
    );
  }

  // 2. Hooks
  step("Writing hooks to ~/.claude/settings.json...");
  let settings: Record<string, unknown> = {};
  if (existsSync(join(CLAUDE_DIR, "settings.json"))) {
    try {
      settings = JSON.parse(
        readFileSync(join(CLAUDE_DIR, "settings.json"), "utf-8"),
      );
    } catch {}
  }
  if (!settings["hooks"]) {
    settings["hooks"] = HOOKS_CONFIG.hooks;
    writeFileSync(
      join(CLAUDE_DIR, "settings.json"),
      JSON.stringify(settings, null, 2),
    );
    ok("hooks written");
  } else {
    warn(
      "Hooks already present in settings.json — skipping to avoid overwrite. See hooks/library.md to merge manually.",
    );
  }

  // 3. MCP registration hints
  step("MCP registration guide:");
  console.log(
    pc.dim(
      "\nAdd to ~/.claude.json mcpServers (after installing each package):\n",
    ),
  );

  for (const mcp of MCPS) {
    console.log(pc.bold(`  ${mcp.name}`));
    console.log(
      pc.dim(`    npx ${mcp.pkg}   (or npm i -g ${mcp.pkg} && ${mcp.bin})`),
    );
    if (mcp.envVars.length > 0) {
      console.log(pc.dim(`    env: ${mcp.envVars.join(", ")}`));
    }
    console.log(pc.dim(`    ${mcp.note}\n`));
  }

  // 4. Summary
  console.log(pc.bold("\nDone. Next steps:"));
  console.log("  1. Set API keys in ~/.config/your-env.env (mode 600)");
  console.log("  2. Wire each MCP into ~/.claude.json mcpServers");
  console.log("  3. Restart Claude Code");
  console.log("  4. Run `claude /session-save` to verify the skill installs\n");
  console.log(pc.dim("Full docs: " + REPO));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
