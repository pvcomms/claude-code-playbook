import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spaceshipFetch } from "../client.js";

const VERCEL_NAMESERVERS = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"];

export function registerNameserverTools(server: McpServer) {
  server.tool(
    "spaceship_set_nameservers",
    "Set the authoritative nameservers for a domain. Pass an array of FQDNs. Use this to delegate the domain to Vercel, Cloudflare, etc. (For Vercel, prefer pointing DNS records via spaceship_point_to_vercel — only switch nameservers if you want Vercel to manage the full DNS zone.)",
    {
      domain: z.string().min(3),
      nameservers: z
        .array(z.string().min(3))
        .min(2)
        .max(8)
        .describe(
          "Array of FQDNs, e.g. ['ns1.vercel-dns.com', 'ns2.vercel-dns.com']",
        ),
    },
    async ({ domain, nameservers }) => {
      const { data, asyncOperationId } = await spaceshipFetch(
        `/domains/${encodeURIComponent(domain)}/nameservers`,
        { method: "PUT", body: { nameservers } },
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ asyncOperationId, data }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "spaceship_use_vercel_nameservers",
    `Convenience: delegate the domain to Vercel's nameservers (${VERCEL_NAMESERVERS.join(", ")}). Equivalent to spaceship_set_nameservers with Vercel's NS list.`,
    {
      domain: z.string().min(3),
    },
    async ({ domain }) => {
      const { data, asyncOperationId } = await spaceshipFetch(
        `/domains/${encodeURIComponent(domain)}/nameservers`,
        { method: "PUT", body: { nameservers: VERCEL_NAMESERVERS } },
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                asyncOperationId,
                message: `delegated ${domain} to Vercel nameservers`,
                data,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
