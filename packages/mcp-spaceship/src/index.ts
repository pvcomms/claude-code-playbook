#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAvailabilityTools } from "./tools/availability.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerNameserverTools } from "./tools/nameservers.js";
import { registerAsyncTools } from "./tools/async.js";

const server = new McpServer({
  name: "spaceship-mcp-server",
  version: "0.1.0",
});

registerAvailabilityTools(server);
registerDomainTools(server);
registerDnsTools(server);
registerNameserverTools(server);
registerAsyncTools(server);

async function main() {
  if (!process.env.SPACESHIP_API_KEY || !process.env.SPACESHIP_API_SECRET) {
    console.error(
      "ERROR: SPACESHIP_API_KEY and SPACESHIP_API_SECRET must be set. Generate at https://www.spaceship.com/application/api-manager/",
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("spaceship-mcp-server running via stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
