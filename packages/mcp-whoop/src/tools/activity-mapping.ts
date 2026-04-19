import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoopGet, handleWhoopError } from "../services/whoop-client.js";

interface MappingResponse {
  v2_activity_id: string;
}

export function registerActivityMappingTools(server: McpServer): void {
  server.registerTool(
    "whoop_map_v1_activity",
    {
      title: "Map a V1 activity ID to a V2 UUID",
      description: `Look up the V2 UUID for a legacy V1 numeric activity ID. Useful when migrating bookmarks, logs, or references that still use V1 IDs.

Args:
  - v1_activity_id: numeric V1 activity ID

Returns: { v2_activity_id: "uuid-string" } — feed into whoop_get_sleep or whoop_get_workout as applicable.`,
      inputSchema: {
        v1_activity_id: z
          .number()
          .int()
          .positive()
          .describe("Numeric V1 activity ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ v1_activity_id }) => {
      try {
        const data = await whoopGet<MappingResponse>(
          `/v1/activity-mapping/${v1_activity_id}`,
        );
        return {
          content: [
            {
              type: "text",
              text: `V1 activity ${v1_activity_id} → V2 UUID ${data.v2_activity_id}`,
            },
          ],
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
