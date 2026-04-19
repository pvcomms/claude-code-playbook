#!/usr/bin/env node
import { createServer } from "node:http";
import { URL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";

const API_BASE = "https://api.prod.whoop.com";
const AUTH_URL = `${API_BASE}/oauth/oauth2/auth`;
const TOKEN_URL = `${API_BASE}/oauth/oauth2/token`;
const SCOPES = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "read:body_measurement",
];
const DEFAULT_REDIRECT_URI = "http://localhost:4567/callback";

import { homedir } from "node:os";
import { join } from "node:path";
const TOKEN_STORE_PATH = join(homedir(), ".whoop-mcp", "tokens.json");

import { readFileSync } from "node:fs";
function loadDotenv() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadDotenv();

const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
const REDIRECT_URI = process.env.WHOOP_REDIRECT_URI || DEFAULT_REDIRECT_URI;
const LOCAL_PORT = parseInt(process.env.WHOOP_LOCAL_PORT || "4567");
const LOCAL_CALLBACK_PATH =
  process.env.WHOOP_LOCAL_CALLBACK_PATH || "/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "ERROR: WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set in .env",
  );
  process.exit(1);
}

const port = LOCAL_PORT;
const callbackPath = LOCAL_CALLBACK_PATH;
const state = "mcp:" + randomBytes(16).toString("hex");

const authUrl = new URL(AUTH_URL);
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("state", state);

console.log("\n1. Register this redirect URI in your WHOOP app dashboard:");
console.log(`   ${REDIRECT_URI}\n`);
console.log(
  "2. Opening browser to authorize... if it doesn't open, paste this URL:",
);
console.log(`   ${authUrl.toString()}\n`);

import { exec } from "node:child_process";
exec(`open "${authUrl.toString()}"`);

const server = createServer(async (req, res) => {
  if (!req.url) return;
  const reqUrl = new URL(req.url, `http://localhost:${port}`);
  if (reqUrl.pathname !== callbackPath) {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = reqUrl.searchParams.get("code");
  const returnedState = reqUrl.searchParams.get("state");
  const error = reqUrl.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Auth error</h1><p>${error}</p>`);
    console.error("Auth error:", error);
    server.close();
    process.exit(1);
  }

  if (!code || returnedState !== state) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h1>Invalid callback</h1>");
    server.close();
    process.exit(1);
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    });
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    const stored = {
      ...tokens,
      expires_at: Date.now() + tokens.expires_in * 1000,
    };

    await mkdir(dirname(TOKEN_STORE_PATH), { recursive: true });
    await writeFile(TOKEN_STORE_PATH, JSON.stringify(stored, null, 2), {
      mode: 0o600,
    });

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      `<h1>WHOOP MCP authorized</h1><p>Tokens saved to ${TOKEN_STORE_PATH}. You can close this tab.</p>`,
    );

    console.log(`\nSuccess. Tokens saved to ${TOKEN_STORE_PATH}`);
    console.log(`Scopes: ${stored.scope}`);
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Token exchange failed</h1><pre>${String(err)}</pre>`);
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log(`Waiting for OAuth callback on ${REDIRECT_URI}...`);
});
