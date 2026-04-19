#!/usr/bin/env tsx
/**
 * Smoke test: hits the Spaceship API directly (not through MCP transport)
 * to verify auth + basic read endpoints work. Run after exporting
 * SPACESHIP_API_KEY and SPACESHIP_API_SECRET.
 */
import { spaceshipFetch, SpaceshipApiError } from "../src/client.js";

type Step = {
  name: string;
  run: () => Promise<unknown>;
};

const steps: Step[] = [
  {
    name: "list_domains (read-only)",
    run: () => spaceshipFetch("/domains", { query: { take: 5 } }),
  },
  {
    name: "check_availability (read-only, batch)",
    run: () =>
      spaceshipFetch("/domains/available", {
        method: "POST",
        body: { domains: ["keep.markets", "keep.bet", "keep.health"] },
      }),
  },
];

async function main() {
  if (!process.env.SPACESHIP_API_KEY || !process.env.SPACESHIP_API_SECRET) {
    console.error(
      "Set SPACESHIP_API_KEY and SPACESHIP_API_SECRET. Generate them at\n  https://www.spaceship.com/application/api-manager/",
    );
    process.exit(1);
  }
  let pass = 0;
  let fail = 0;
  for (const s of steps) {
    try {
      const t0 = Date.now();
      const r = await s.run();
      pass++;
      console.log(`PASS ${s.name} (${Date.now() - t0}ms)`);
      console.log(JSON.stringify(r, null, 2).slice(0, 600));
    } catch (err) {
      fail++;
      const msg =
        err instanceof SpaceshipApiError
          ? `${err.status}: ${err.message}`
          : String(err);
      console.log(`FAIL ${s.name} — ${msg}`);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
