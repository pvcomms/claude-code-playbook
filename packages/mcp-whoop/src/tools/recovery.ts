import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoopGet, handleWhoopError } from "../services/whoop-client.js";
import { ResponseFormat, type PaginatedResponse } from "../types.js";
import {
  paginationShape,
  paginationQuery,
  responseFormatSchema,
} from "../schemas/common.js";

interface RecoveryScore {
  user_calibrating: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage?: number;
  skin_temp_celsius?: number;
}

interface Recovery {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score?: RecoveryScore;
}

function renderRecoveryMarkdown(r: Recovery): string {
  const lines = [
    `## Recovery cycle ${r.cycle_id}`,
    `- sleep_id: ${r.sleep_id}`,
    `- score_state: ${r.score_state}`,
  ];
  if (r.score) {
    lines.push(`- recovery: ${r.score.recovery_score}%`);
    lines.push(`- HRV (RMSSD): ${r.score.hrv_rmssd_milli.toFixed(1)} ms`);
    lines.push(`- RHR: ${r.score.resting_heart_rate} bpm`);
    if (r.score.spo2_percentage != null)
      lines.push(`- SpO2: ${r.score.spo2_percentage.toFixed(1)}%`);
    if (r.score.skin_temp_celsius != null)
      lines.push(`- skin temp: ${r.score.skin_temp_celsius.toFixed(1)} °C`);
  }
  return lines.join("\n");
}

export function registerRecoveryTools(server: McpServer): void {
  server.registerTool(
    "whoop_list_recoveries",
    {
      title: "List WHOOP recoveries",
      description: `List recovery records within a date window.

Scope required: read:recovery

Recovery captures HRV, resting HR, SpO2, skin temp, and an overall 0-100 recovery score for each cycle.

Args:
  - limit (1-25, default 10)
  - start/end: ISO 8601 timestamps
  - next_token: pagination cursor
  - response_format: 'markdown' | 'json'

Returns:
  { "records": [Recovery, ...], "next_token": string | null }
Recovery = { cycle_id, sleep_id, user_id, score_state, score: { recovery_score, hrv_rmssd_milli, resting_heart_rate, spo2_percentage, skin_temp_celsius } }`,
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
        const data = await whoopGet<PaginatedResponse<Recovery>>(
          "/v2/recovery",
          paginationQuery(input),
        );
        const text =
          input.response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : [
                `# Recoveries (${data.records.length})`,
                ...data.records.map(renderRecoveryMarkdown),
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
    "whoop_get_cycle_recovery",
    {
      title: "Get recovery for a specific cycle",
      description: `Return the Recovery record associated with a given cycle ID.

Scope required: read:recovery

Returns: Recovery = { cycle_id, sleep_id, user_id, score_state, score: { recovery_score, hrv_rmssd_milli, resting_heart_rate, spo2_percentage, skin_temp_celsius } }`,
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
        const data = await whoopGet<Recovery>(`/v2/cycle/${cycle_id}/recovery`);
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : renderRecoveryMarkdown(data);
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
