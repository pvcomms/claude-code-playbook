import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spaceshipFetch } from "../client.js";

export function registerAvailabilityTools(server: McpServer) {
  server.tool(
    "spaceship_check_availability",
    "Check whether one or more domain names are currently available to register through Spaceship. Pass an array of full domain names (e.g. ['keep.markets', 'keep.bet']). Returns availability + indicative price per domain. Use this BEFORE attempting to register.",
    {
      domains: z
        .array(z.string().min(3))
        .min(1)
        .max(50)
        .describe(
          "Full domain names to check, e.g. ['keep.markets', 'keep.bet']",
        ),
    },
    async ({ domains }) => {
      const { data } = await spaceshipFetch("/domains/available", {
        method: "POST",
        body: { domains },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
