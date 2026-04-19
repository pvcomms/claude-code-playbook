import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { OAUTH_TOKEN_URL, TOKEN_STORE_PATH } from "../constants.js";
import type { StoredTokens, TokenResponse } from "../types.js";

const REFRESH_SKEW_MS = 60_000;

let cached: StoredTokens | null = null;
let refreshPromise: Promise<StoredTokens> | null = null;

async function loadFromDisk(): Promise<StoredTokens> {
  try {
    const raw = await readFile(TOKEN_STORE_PATH, "utf8");
    return JSON.parse(raw) as StoredTokens;
  } catch (err) {
    throw new Error(
      `Could not read WHOOP tokens at ${TOKEN_STORE_PATH}. Run 'npm run auth' first to authorize. (${String(err)})`,
    );
  }
}

async function persist(tokens: StoredTokens): Promise<void> {
  await mkdir(dirname(TOKEN_STORE_PATH), { recursive: true });
  await writeFile(TOKEN_STORE_PATH, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
}

async function refresh(current: StoredTokens): Promise<StoredTokens> {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set in the MCP server environment.",
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    scope: current.scope,
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `WHOOP token refresh failed: ${res.status} ${text}. Re-run 'npm run auth'.`,
    );
  }

  const data = (await res.json()) as TokenResponse;
  const next: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? current.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? current.scope,
    token_type: data.token_type ?? current.token_type,
  };
  await persist(next);
  return next;
}

export async function getAccessToken(): Promise<string> {
  if (!cached) {
    cached = await loadFromDisk();
  }

  if (cached.expires_at - REFRESH_SKEW_MS > Date.now()) {
    return cached.access_token;
  }

  if (!refreshPromise) {
    refreshPromise = refresh(cached).finally(() => {
      refreshPromise = null;
    });
  }
  cached = await refreshPromise;
  return cached.access_token;
}
