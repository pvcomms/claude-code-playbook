#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerCycleTools } from "./tools/cycles.js";
import { registerRecoveryTools } from "./tools/recovery.js";
import { registerSleepTools } from "./tools/sleep.js";
import { registerWorkoutTools } from "./tools/workouts.js";
import { registerActivityMappingTools } from "./tools/activity-mapping.js";

const server = new McpServer({
  name: "whoop-mcp-server",
  version: "1.0.0",
});

registerProfileTools(server);
registerCycleTools(server);
registerRecoveryTools(server);
registerSleepTools(server);
registerWorkoutTools(server);
registerActivityMappingTools(server);

async function main() {
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_CLIENT_SECRET) {
    console.error(
      "ERROR: WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set in the MCP server environment.",
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("whoop-mcp-server running via stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
