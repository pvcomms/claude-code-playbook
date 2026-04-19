#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TOKENS = join(homedir(), ".whoop-mcp", "tokens.json");
const API = "https://api.prod.whoop.com/developer";

function loadDotenv() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadDotenv();

type Stored = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
};

function loadTokens(): Stored {
  const raw = readFileSync(TOKENS, "utf8");
  return JSON.parse(raw);
}

async function refresh(current: Stored): Promise<Stored> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: current.scope,
  });
  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`refresh ${res.status} ${await res.text()}`);
  const d = (await res.json()) as any;
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token ?? current.refresh_token,
    expires_at: Date.now() + d.expires_in * 1000,
    scope: d.scope ?? current.scope,
    token_type: d.token_type ?? current.token_type,
  };
}

async function call(
  path: string,
  token: string,
  query: Record<string, string> = {},
): Promise<any> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

type Check = {
  name: string;
  run: (t: string) => Promise<any>;
  assert: (r: any) => boolean;
};

async function main() {
  let tokens = loadTokens();
  if (tokens.expires_at - 60_000 < Date.now()) {
    console.log("• tokens expired, refreshing...");
    tokens = await refresh(tokens);
  }
  const t = tokens.access_token;

  // Find a cycle id + recent date for downstream tool tests
  const cycles = await call("/v2/cycle", t, { limit: "1" });
  const firstCycle = cycles.records?.[0];
  const cycleId = firstCycle?.id;

  const sleeps = await call("/v2/activity/sleep", t, { limit: "1" });
  const sleepId = sleeps.records?.[0]?.id;

  const workouts = await call("/v2/activity/workout", t, { limit: "1" });
  const workoutId = workouts.records?.[0]?.id;

  const checks: Check[] = [
    {
      name: "whoop_get_profile",
      run: (t) => call("/v2/user/profile/basic", t),
      assert: (r) => typeof r?.user_id === "number",
    },
    {
      name: "whoop_get_body_measurement",
      run: (t) => call("/v2/user/measurement/body", t),
      assert: (r) => typeof r?.height_meter === "number",
    },
    {
      name: "whoop_list_cycles",
      run: (t) => call("/v2/cycle", t, { limit: "5" }),
      assert: (r) => Array.isArray(r?.records),
    },
    {
      name: "whoop_get_cycle",
      run: (t) =>
        cycleId
          ? call(`/v2/cycle/${cycleId}`, t)
          : Promise.resolve({ skipped: true }),
      assert: (r) => r.skipped || typeof r?.id !== "undefined",
    },
    {
      name: "whoop_list_recoveries",
      run: (t) => call("/v2/recovery", t, { limit: "5" }),
      assert: (r) => Array.isArray(r?.records),
    },
    {
      name: "whoop_get_cycle_recovery",
      run: (t) =>
        cycleId
          ? call(`/v2/cycle/${cycleId}/recovery`, t)
          : Promise.resolve({ skipped: true }),
      assert: (r) =>
        r.skipped ||
        typeof r?.score_state !== "undefined" ||
        typeof r?.cycle_id !== "undefined",
    },
    {
      name: "whoop_list_sleep",
      run: (t) => call("/v2/activity/sleep", t, { limit: "5" }),
      assert: (r) => Array.isArray(r?.records),
    },
    {
      name: "whoop_get_sleep",
      run: (t) =>
        sleepId
          ? call(`/v2/activity/sleep/${sleepId}`, t)
          : Promise.resolve({ skipped: true }),
      assert: (r) => r.skipped || typeof r?.id !== "undefined",
    },
    {
      name: "whoop_get_cycle_sleep",
      run: (t) =>
        cycleId
          ? call(`/v2/activity/sleep?cycle_id=${cycleId}&limit=1`, t)
          : Promise.resolve({ skipped: true }),
      assert: (r) => r.skipped || Array.isArray(r?.records),
    },
    {
      name: "whoop_list_workouts",
      run: (t) => call("/v2/activity/workout", t, { limit: "5" }),
      assert: (r) => Array.isArray(r?.records),
    },
    {
      name: "whoop_get_workout",
      run: (t) =>
        workoutId
          ? call(`/v2/activity/workout/${workoutId}`, t)
          : Promise.resolve({ skipped: true }),
      assert: (r) => r.skipped || typeof r?.id !== "undefined",
    },
  ];

  console.log(`\nrunning ${checks.length} checks\n`);
  let pass = 0,
    fail = 0,
    skip = 0;
  for (const c of checks) {
    try {
      const r = await c.run(t);
      if (r?.skipped) {
        console.log(`∅ ${c.name} — no fixture`);
        skip++;
        continue;
      }
      if (c.assert(r)) {
        console.log(`✓ ${c.name}`);
        pass++;
      } else {
        console.log(
          `✗ ${c.name} — unexpected shape: ${JSON.stringify(r).slice(0, 200)}`,
        );
        fail++;
      }
    } catch (err) {
      console.log(
        `✗ ${c.name} — ${err instanceof Error ? err.message : String(err)}`,
      );
      fail++;
    }
  }
  console.log(`\n${pass} pass, ${fail} fail, ${skip} skipped`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
