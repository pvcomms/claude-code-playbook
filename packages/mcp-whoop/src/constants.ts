export const API_BASE_URL = "https://api.prod.whoop.com/developer";
export const OAUTH_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const OAUTH_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export const SCOPES = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "read:body_measurement",
] as const;

export const DEFAULT_REDIRECT_URI = "http://localhost:4567/callback";
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_LIMIT = 25;

import { homedir } from "node:os";
import { join } from "node:path";
export const TOKEN_STORE_DIR = join(homedir(), ".whoop-mcp");
export const TOKEN_STORE_PATH = join(TOKEN_STORE_DIR, "tokens.json");
