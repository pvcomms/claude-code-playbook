import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoopGet, handleWhoopError } from "../services/whoop-client.js";
import { ResponseFormat, type PaginatedResponse } from "../types.js";
import {
  paginationShape,
  paginationQuery,
  responseFormatSchema,
} from "../schemas/common.js";

interface StageSummary {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
}

interface SleepNeeded {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
}

interface SleepScore {
  stage_summary: StageSummary;
  sleep_needed: SleepNeeded;
  respiratory_rate: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
}

interface Sleep {
  id: string;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: SleepScore;
}

function hoursFromMs(ms: number): string {
  return (ms / 3_600_000).toFixed(2) + "h";
}

function renderSleepMarkdown(s: Sleep): string {
  const lines = [
    `## Sleep ${s.id}${s.nap ? " (nap)" : ""}`,
    `- start: ${s.start}`,
    `- end: ${s.end}`,
    `- score_state: ${s.score_state}`,
  ];
  if (s.score) {
    const ss = s.score.stage_summary;
    lines.push(`- performance: ${s.score.sleep_performance_percentage}%`);
    lines.push(
      `- efficiency: ${s.score.sleep_efficiency_percentage.toFixed(1)}%`,
    );
    lines.push(`- consistency: ${s.score.sleep_consistency_percentage}%`);
    lines.push(`- respiratory rate: ${s.score.respiratory_rate.toFixed(1)}`);
    lines.push(`- in bed: ${hoursFromMs(ss.total_in_bed_time_milli)}`);
    lines.push(`- REM: ${hoursFromMs(ss.total_rem_sleep_time_milli)}`);
    lines.push(`- SWS: ${hoursFromMs(ss.total_slow_wave_sleep_time_milli)}`);
    lines.push(`- light: ${hoursFromMs(ss.total_light_sleep_time_milli)}`);
    lines.push(
      `- cycles: ${ss.sleep_cycle_count}, disturbances: ${ss.disturbance_count}`,
    );
  }
  return lines.join("\n");
}

export function registerSleepTools(server: McpServer): void {
  server.registerTool(
    "whoop_list_sleep",
    {
      title: "List WHOOP sleep activities",
      description: `List sleep records within a date window, including naps.

Scope required: read:sleep

Each sleep contains stage breakdown (REM, SWS, light, awake), performance/efficiency/consistency percentages, and respiratory rate.

Args:
  - limit (1-25, default 10)
  - start/end: ISO 8601 timestamps
  - next_token: pagination cursor
  - response_format: 'markdown' | 'json'

Returns:
  { "records": [Sleep, ...], "next_token": string | null }
Sleep = { id, user_id, start, end, nap, score_state, score: { stage_summary, sleep_needed, respiratory_rate, sleep_performance_percentage, sleep_consistency_percentage, sleep_efficiency_percentage } }`,
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
        const data = await whoopGet<PaginatedResponse<Sleep>>(
          "/v2/activity/sleep",
          paginationQuery(input),
        );
        const text =
          input.response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : [
                `# Sleep (${data.records.length})`,
                ...data.records.map(renderSleepMarkdown),
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
    "whoop_get_sleep",
    {
      title: "Get a single WHOOP sleep activity",
      description: `Return a single sleep record by its UUID.

Scope required: read:sleep

Returns: Sleep (see whoop_list_sleep for schema).`,
      inputSchema: {
        sleep_id: z.string().uuid().describe("Sleep UUID"),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ sleep_id, response_format }) => {
      try {
        const data = await whoopGet<Sleep>(`/v2/activity/sleep/${sleep_id}`);
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : renderSleepMarkdown(data);
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
    "whoop_get_cycle_sleep",
    {
      title: "Get sleep for a specific cycle",
      description: `Return the Sleep record associated with a given cycle ID.

Scope required: read:cycles (per WHOOP docs — cycle-scoped endpoint)

Returns: Sleep (see whoop_list_sleep for schema).`,
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
        const data = await whoopGet<Sleep>(`/v2/cycle/${cycle_id}/sleep`);
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : renderSleepMarkdown(data);
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
