import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoopGet, handleWhoopError } from "../services/whoop-client.js";
import { ResponseFormat, type PaginatedResponse } from "../types.js";
import {
  paginationShape,
  paginationQuery,
  responseFormatSchema,
} from "../schemas/common.js";

interface CycleScore {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
}

interface Cycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end?: string | null;
  timezone_offset: string;
  score_state: string;
  score?: CycleScore;
}

function renderCycleMarkdown(c: Cycle): string {
  const lines = [`## Cycle ${c.id}`, `- start: ${c.start}`];
  if (c.end) lines.push(`- end: ${c.end}`);
  lines.push(`- score_state: ${c.score_state}`);
  if (c.score) {
    lines.push(`- strain: ${c.score.strain.toFixed(2)}`);
    lines.push(`- avg HR: ${c.score.average_heart_rate} bpm`);
    lines.push(`- max HR: ${c.score.max_heart_rate} bpm`);
    lines.push(`- kilojoules: ${c.score.kilojoule.toFixed(0)}`);
  }
  return lines.join("\n");
}

export function registerCycleTools(server: McpServer): void {
  server.registerTool(
    "whoop_list_cycles",
    {
      title: "List WHOOP physiological cycles",
      description: `List the user's physiological cycles (roughly one per day) within a date window.

Scope required: read:cycles

A cycle covers one full wake/sleep rotation and contains strain, average heart rate, max heart rate, and energy expenditure.

Args:
  - limit (1-25, default 10)
  - start: ISO 8601 (inclusive) e.g. '2026-04-10T00:00:00Z'
  - end: ISO 8601 (exclusive)
  - next_token: pagination cursor from previous response
  - response_format: 'markdown' | 'json'

Returns:
  {
    "records": [Cycle, ...],
    "next_token": string | null
  }
Cycle = { id, user_id, start, end, timezone_offset, score_state, score: { strain, kilojoule, average_heart_rate, max_heart_rate } }`,
      inputSchema: paginationShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const data = await whoopGet<PaginatedResponse<Cycle>>(
          "/v2/cycle",
          paginationQuery(input),
        );
        const text =
          input.response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : [
                `# Cycles (${data.records.length})`,
                ...data.records.map(renderCycleMarkdown),
                data.next_token ? `\n_next_token: ${data.next_token}_` : "",
              ].join("\n\n");
        return {
          content: [{ type: "text", text }],
          structuredContent: data as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: handleWhoopError(err) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "whoop_get_cycle",
    {
      title: "Get a single WHOOP cycle by ID",
      description: `Return a single cycle record by its numeric ID.

Scope required: read:cycles

Returns: Cycle = { id, user_id, start, end, timezone_offset, score_state, score: { strain, kilojoule, average_heart_rate, max_heart_rate } }`,
      inputSchema: {
        cycle_id: z.number().int().positive().describe("Numeric cycle ID"),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cycle_id, response_format }) => {
      try {
        const data = await whoopGet<Cycle>(`/v2/cycle/${cycle_id}`);
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : renderCycleMarkdown(data);
        return {
          content: [{ type: "text", text }],
          structuredContent: data as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: handleWhoopError(err) }],
          isError: true,
        };
      }
    },
  );
}
