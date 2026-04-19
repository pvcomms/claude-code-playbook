import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spaceshipFetch } from "../client.js";

const RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "NS",
  "SRV",
  "CAA",
  "ALIAS",
] as const;

const dnsRecordSchema = z.object({
  type: z.enum(RECORD_TYPES),
  name: z
    .string()
    .describe("Subdomain (e.g. '@', 'www', 'api'). '@' for apex."),
  value: z
    .string()
    .describe("Record value. For A: IP. For CNAME: target hostname."),
  ttl: z.number().int().min(60).max(86400).optional().default(3600),
  priority: z.number().int().optional().describe("Required for MX and SRV"),
});

export function registerDnsTools(server: McpServer) {
  server.tool(
    "spaceship_list_dns_records",
    "List all DNS records for a domain. Paginated.",
    {
      domain: z.string().min(3),
      take: z.number().int().min(1).max(500).optional().default(100),
      skip: z.number().int().min(0).optional().default(0),
    },
    async ({ domain, take, skip }) => {
      const { data } = await spaceshipFetch(
        `/dns/records/${encodeURIComponent(domain)}`,
        { query: { take, skip } },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "spaceship_set_dns_records",
    "Create or update DNS records on a domain. Pass an array of record objects. Use to point a domain at Vercel (CNAME → cname.vercel-dns.com or A → 76.76.21.21), or to set TXT records for verification.",
    {
      domain: z.string().min(3),
      records: z.array(dnsRecordSchema).min(1).max(50),
    },
    async ({ domain, records }) => {
      const { data, asyncOperationId } = await spaceshipFetch(
        `/dns/records/${encodeURIComponent(domain)}`,
        { method: "PUT", body: { items: records, force: true } },
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
    "spaceship_delete_dns_records",
    "Delete specific DNS records by type/name/value triple. Pass an array; each record must match exactly.",
    {
      domain: z.string().min(3),
      records: z
        .array(
          z.object({
            type: z.enum(RECORD_TYPES),
            name: z.string(),
            value: z.string(),
          }),
        )
        .min(1)
        .max(50),
    },
    async ({ domain, records }) => {
      const { data } = await spaceshipFetch(
        `/dns/records/${encodeURIComponent(domain)}`,
        { method: "DELETE", body: { items: records } },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "spaceship_point_to_vercel",
    "Convenience: set a domain's apex + www records to point at Vercel. Adds A @ → 76.76.21.21 and CNAME www → cname.vercel-dns.com. Use after registering a domain to wire it to a Vercel project.",
    {
      domain: z.string().min(3),
    },
    async ({ domain }) => {
      const records = [
        { type: "A" as const, name: "@", value: "76.76.21.21", ttl: 3600 },
        {
          type: "CNAME" as const,
          name: "www",
          value: "cname.vercel-dns.com",
          ttl: 3600,
        },
      ];
      const { data, asyncOperationId } = await spaceshipFetch(
        `/dns/records/${encodeURIComponent(domain)}`,
        { method: "PUT", body: { items: records, force: true } },
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                asyncOperationId,
                message: `pointed ${domain} at Vercel`,
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
