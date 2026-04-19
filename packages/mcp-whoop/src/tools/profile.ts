import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoopGet, handleWhoopError } from "../services/whoop-client.js";
import { ResponseFormat } from "../types.js";
import { responseFormatSchema } from "../schemas/common.js";

const inputShape = { response_format: responseFormatSchema };

interface BasicProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface BodyMeasurement {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

export function registerProfileTools(server: McpServer): void {
  server.registerTool(
    "whoop_get_profile",
    {
      title: "Get WHOOP user profile",
      description: `Return the authenticated WHOOP user's basic profile (user_id, email, first_name, last_name).

Scope required: read:profile

Returns:
  {
    "user_id": number,
    "email": string,
    "first_name": string,
    "last_name": string
  }`,
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const data = await whoopGet<BasicProfile>("/v2/user/profile/basic");
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : `# ${data.first_name} ${data.last_name}\n- user_id: ${data.user_id}\n- email: ${data.email}`;
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
    "whoop_get_body_measurement",
    {
      title: "Get WHOOP body measurements",
      description: `Return the authenticated user's height (meters), weight (kg), and max heart rate (bpm).

Scope required: read:body_measurement

Returns:
  {
    "height_meter": number,
    "weight_kilogram": number,
    "max_heart_rate": number
  }`,
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const data = await whoopGet<BodyMeasurement>(
          "/v2/user/measurement/body",
        );
        const text =
          response_format === ResponseFormat.JSON
            ? JSON.stringify(data, null, 2)
            : `# Body measurements\n- height: ${data.height_meter.toFixed(2)} m\n- weight: ${data.weight_kilogram.toFixed(1)} kg\n- max HR: ${data.max_heart_rate} bpm`;
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
