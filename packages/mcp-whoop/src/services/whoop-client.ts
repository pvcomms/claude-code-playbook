import { API_BASE_URL } from "../constants.js";
import { getAccessToken } from "../auth/token-manager.js";

export class WhoopApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`WHOOP API ${status}: ${body}`);
  }
}

export async function whoopGet<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const token = await getAccessToken();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new WhoopApiError(res.status, text);
  }

  return (await res.json()) as T;
}

export function handleWhoopError(err: unknown): string {
  if (err instanceof WhoopApiError) {
    switch (err.status) {
      case 401:
        return "Error: WHOOP auth failed (401). Re-run 'npm run auth' to re-authorize.";
      case 403:
        return "Error: WHOOP scope forbidden (403). Re-authorize with the required scope.";
      case 404:
        return "Error: WHOOP resource not found (404). Check the ID or date range.";
      case 429:
        return "Error: WHOOP rate limit exceeded (429). Wait before retrying.";
      default:
        return `Error: WHOOP API ${err.status} — ${err.body.slice(0, 300)}`;
    }
  }
  return `Error: ${err instanceof Error ? err.message : String(err)}`;
}
