const BASE_URL =
  process.env.SPACESHIP_API_BASE ?? "https://spaceship.dev/api/v1";

export class SpaceshipApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export async function spaceshipFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<{ status: number; data: T; asyncOperationId?: string }> {
  const apiKey = process.env.SPACESHIP_API_KEY;
  const apiSecret = process.env.SPACESHIP_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error(
      "SPACESHIP_API_KEY and SPACESHIP_API_SECRET must be set in env. Generate at https://www.spaceship.com/application/api-manager/",
    );
  }

  const url = new URL(BASE_URL + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    "X-Api-Secret": apiSecret,
    Accept: "application/json",
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, { method: opts.method ?? "GET", headers, body });
  const text = await res.text();
  let data: unknown = text;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // keep as string
    }
  }
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `HTTP ${res.status}`;
    throw new SpaceshipApiError(res.status, data, message);
  }

  const asyncOperationId =
    res.headers.get("spaceship-async-operationid") ?? undefined;
  return { status: res.status, data: data as T, asyncOperationId };
}
