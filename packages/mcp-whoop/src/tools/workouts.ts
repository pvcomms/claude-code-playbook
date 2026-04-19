import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoopGet, handleWhoopError } from "../services/whoop-client.js";
import { ResponseFormat, type PaginatedResponse } from "../types.js";
import {
  paginationShape,
  paginationQuery,
  responseFormatSchema,
} from "../schemas/common.js";

interface ZoneDurations {
  zone_zero_milli: number;
  zone_one_milli: number;
  zone_two_milli: number;
  zone_three_milli: number;
  zone_four_milli: number;
  zone_five_milli: number;
}

interface WorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  percent_recorded: number;
  distance_meter?: number;
  altitude_gain_meter?: number;
  altitude_change_meter?: number;
  zone_durations: ZoneDurations;
}

interface Workout {
  id: string;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  sport_id?: number;
  score_state: string;
  score?: WorkoutScore;
}

function renderWorkoutMarkdown(w: Workout): string {
  const lines = [
    `## ${w.sport_name} — ${w.id}`,
    `- start: ${w.start}`,
    `- end: ${w.end}`,
    `- score_state: ${w.score_state}`,
  ];
  if (w.score) {
    lines.push(`- strain: ${w.score.strain.toFixed(2)}`);
    lines.push(`- avg HR: ${w.score.average_heart_rate} bpm`);
    lines.push(`- max HR: ${w.score.max_heart_rate} bpm`);
    lines.push(`- kilojoules: ${w.score.kilojoule.toFixed(0)}`);
    if (w.score.distance_meter != null)
      lines.push(
        `- distance: ${(w.score.distance_meter / 1000).toFixed(2)} km`,
      );
  }
  return lines.join("\n");
}

export function registerWorkoutTools(server: McpServer): void {
  server.registerTool(
    "whoop_list_workouts",
    {
      title: "List WHOOP workouts",
      description: `List workout/activity records within a date window.

Scope required: read:workout

Each workout includes sport name, strain, heart rate zone durations (zones 0-5), and optional distance/altitude.

Args:
  - limit (1-25, default 10)
  - start/end: ISO 8601 timestamps
  - next_token: pagination cursor
  - response_format: 'markdown' | 'json'

Returns:
  { "records": [Workout, ...], "next_token": string | null }
Workout = { id, user_id, start, end, sport_name, score_state, score: { strain, average_heart_rate, max_heart_rate, kilojoule, distance_meter, zone_durations: { zone_zero_milli..zone_five_milli } } }`,
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
        const data = await whoopGet<PaginatedResponse<Workout>>(
          "/v2/activity/workout",
          paginationQuery(input),
        );
        const text =
          input.response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : [
                `# Workouts (${data.records.length})`,
                ...data.records.map(renderWorkoutMarkdown),
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
    "whoop_get_workout",
    {
      title: "Get a single WHOOP workout",
      description: `Return a single workout record by its UUID.

Scope required: read:workout

Returns: Workout (see whoop_list_workouts for schema).`,
      inputSchema: {
        workout_id: z.string().uuid().describe("Workout UUID"),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ workout_id, response_format }) => {
      try {
        const data = await whoopGet<Workout>(
          `/v2/activity/workout/${workout_id}`,
        );
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : renderWorkoutMarkdown(data);
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
