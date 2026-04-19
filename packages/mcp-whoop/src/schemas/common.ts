import { z } from "zod";
import { ResponseFormat } from "../types.js";

export const responseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for human-readable, 'json' for machine-readable",
  );

export const paginationShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Max records to return (WHOOP caps at 25)"),
  start: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe(
      "ISO 8601 start timestamp (inclusive), e.g. '2026-04-10T00:00:00Z'",
    ),
  end: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe(
      "ISO 8601 end timestamp (exclusive), e.g. '2026-04-17T00:00:00Z'",
    ),
  next_token: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response"),
  response_format: responseFormatSchema,
};

export type PaginationInput = {
  limit: number;
  start?: string;
  end?: string;
  next_token?: string;
  response_format: ResponseFormat;
};

export function paginationQuery(
  input: PaginationInput,
): Record<string, string | number | undefined> {
  return {
    limit: input.limit,
    start: input.start,
    end: input.end,
    nextToken: input.next_token,
  };
}
