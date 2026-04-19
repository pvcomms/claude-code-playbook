export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface PaginatedResponse<T> {
  records: T[];
  next_token?: string | null;
}

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
