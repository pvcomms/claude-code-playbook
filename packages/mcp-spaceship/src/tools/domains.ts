import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spaceshipFetch } from "../client.js";

export function registerDomainTools(server: McpServer) {
  server.tool(
    "spaceship_list_domains",
    "List domains in the authenticated Spaceship account. Paginated via `take` and `skip`. Returns domain names, status, expiry dates, and registrar lock state.",
    {
      take: z.number().int().min(1).max(500).optional().default(100),
      skip: z.number().int().min(0).optional().default(0),
      orderBy: z
        .enum(["expirationDate", "registrationDate", "name"])
        .optional()
        .describe("Field to sort by"),
    },
    async ({ take, skip, orderBy }) => {
      const { data } = await spaceshipFetch("/domains", {
        query: { take, skip, orderBy },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "spaceship_get_domain",
    "Get full details for a single domain owned in the Spaceship account: status, expiry, nameservers, lock state, autorenew, contacts.",
    {
      domain: z.string().min(3).describe("Domain name, e.g. 'keep.markets'"),
    },
    async ({ domain }) => {
      const { data } = await spaceshipFetch(
        `/domains/${encodeURIComponent(domain)}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "spaceship_register_domain",
    "Register a new domain. SPENDS REAL MONEY — defaults to dry-run unless `confirm: true` is passed. Always check availability first via `spaceship_check_availability` and surface the price to the user before confirming.",
    {
      domain: z
        .string()
        .min(3)
        .describe("Full domain to register, e.g. 'keep.markets'"),
      years: z.number().int().min(1).max(10).default(1),
      contactId: z
        .string()
        .describe(
          "Contact ID for registrant/admin/tech/billing. Create one first via `spaceship_upsert_contact`. Required when confirm=true.",
        )
        .optional(),
      privacyEnabled: z.boolean().default(true),
      autoRenew: z.boolean().default(false),
      confirm: z
        .boolean()
        .default(false)
        .describe(
          "Required to actually charge. False returns the request body that WOULD be sent.",
        ),
    },
    async (args) => {
      if (!args.confirm) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  dry_run: true,
                  message:
                    "Dry-run. Re-call with confirm:true to actually register and bill.",
                  request: {
                    method: "POST",
                    path: `/domains/${args.domain}`,
                    body: {
                      years: args.years,
                      contactId: args.contactId,
                      privacyEnabled: args.privacyEnabled,
                      autoRenew: args.autoRenew,
                    },
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      if (!args.contactId) {
        throw new Error(
          "contactId is required when confirm:true. Create one first with spaceship_upsert_contact.",
        );
      }
      const { data, asyncOperationId } = await spaceshipFetch(
        `/domains/${encodeURIComponent(args.domain)}`,
        {
          method: "POST",
          body: {
            years: args.years,
            contactId: args.contactId,
            privacyEnabled: args.privacyEnabled,
            autoRenew: args.autoRenew,
          },
        },
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
    "spaceship_renew_domain",
    "Renew a domain for N years. SPENDS MONEY — dry-run unless confirm:true.",
    {
      domain: z.string().min(3),
      years: z.number().int().min(1).max(10).default(1),
      confirm: z.boolean().default(false),
    },
    async ({ domain, years, confirm }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  dry_run: true,
                  message: "Re-call with confirm:true to renew and bill.",
                  request: {
                    method: "POST",
                    path: `/domains/${domain}/renew`,
                    body: { years },
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      const { data } = await spaceshipFetch(
        `/domains/${encodeURIComponent(domain)}/renew`,
        { method: "POST", body: { years } },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "spaceship_set_autorenew",
    "Enable or disable auto-renewal for a domain. Free, no charge until renewal date.",
    {
      domain: z.string().min(3),
      enabled: z.boolean(),
    },
    async ({ domain, enabled }) => {
      const { data } = await spaceshipFetch(
        `/domains/${encodeURIComponent(domain)}/autorenew`,
        { method: "PUT", body: { enabled } },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "spaceship_upsert_contact",
    "Create or update a contact (registrant/admin/tech/billing). Required before registering a new domain. Returns a contactId for use with spaceship_register_domain.",
    {
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().describe("E.164 format, e.g. '+91.9876543210'"),
      address1: z.string().min(1),
      address2: z.string().optional(),
      city: z.string().min(1),
      stateProvince: z.string().min(1),
      postalCode: z.string().min(1),
      countryCode: z
        .string()
        .length(2)
        .describe("ISO 3166-1 alpha-2, e.g. 'IN', 'US'"),
      organization: z.string().optional(),
    },
    async (args) => {
      const { data } = await spaceshipFetch("/contacts", {
        method: "PUT",
        body: args,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
