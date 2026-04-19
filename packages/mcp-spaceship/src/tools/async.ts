import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spaceshipFetch } from "../client.js";

export function registerAsyncTools(server: McpServer) {
  server.tool(
    "spaceship_get_async_operation",
    "Check the status of a long-running Spaceship operation. Many mutating endpoints return an asyncOperationId — poll this to see if it succeeded, failed, or is still pending.",
    {
      operationId: z.string().min(1),
    },
    async ({ operationId }) => {
      const { data } = await spaceshipFetch(
        `/async-operations/${encodeURIComponent(operationId)}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
