import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerSearchTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_search_people",
      label: "Search People",
      description:
        "Search for people by company, role, geography, name, college, tenure, or keywords. Returns LinkedIn profiles matching the criteria. At least one of company_name, role, geography, or person_name is required.",
      parameters: Type.Object({
        company_name: Type.Optional(Type.String({ description: "Company name" })),
        role: Type.Optional(Type.String({ description: "Job role or title" })),
        geography: Type.Optional(Type.String({ description: "Location (city, state, country)" })),
        person_name: Type.Optional(Type.String({ description: "Person's name" })),
        college: Type.Optional(Type.String({ description: "College or university" })),
        tenure: Type.Optional(Type.Number({ description: "Years at current job (1-50)" })),
        keywords: Type.Optional(Type.String({ description: "Additional keywords" })),
        high_connection_count: Type.Optional(Type.Boolean({ description: "Only people with 500+ connections" })),
        limit: Type.Optional(Type.Number({ description: "Max results (default: 50, max: 100)" })),
        exact_match: Type.Optional(Type.Boolean({ description: "Exact phrase matching" })),
        enrich_results: Type.Optional(Type.Boolean({ description: "Also enrich found profiles" })),
      }),
      async execute(
        _toolCallId: string,
        params: {
          company_name?: string
          role?: string
          geography?: string
          person_name?: string
          college?: string
          tenure?: number
          keywords?: string
          high_connection_count?: boolean
          limit?: number
          exact_match?: boolean
          enrich_results?: boolean
        },
      ) {
        if (!params.company_name && !params.role && !params.geography && !params.person_name) {
          return {
            content: [{ type: "text" as const, text: "Error: At least one of company_name, role, geography, or person_name is required." }],
          }
        }

        log.debug(`search tool: ${JSON.stringify(params)}`)

        try {
          const result = await client.searchPeople(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Search failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const profiles = (data.result ?? data.results ?? []) as Array<Record<string, unknown>>

          if (!Array.isArray(profiles) || profiles.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No people found matching the search criteria." }],
            }
          }

          const lines = profiles.slice(0, 20).map((p, i) => {
            const name = p.full_name ?? p.name ?? "Unknown"
            const title = p.headline ?? p.title ?? ""
            const company = p.company_name ?? p.company ?? ""
            const location = p.location ?? ""
            const linkedin = p.linkedin_url ?? p.url ?? ""

            let line = `${i + 1}. **${name}**`
            if (title) line += ` — ${title}`
            if (company) line += ` at ${company}`
            if (location) line += ` (${location})`
            if (linkedin) line += `\n   ${linkedin}`
            return line
          })

          const text = `Found ${profiles.length} people:\n\n${lines.join("\n\n")}`

          return {
            content: [{ type: "text" as const, text }],
            details: { count: profiles.length, profiles },
          }
        } catch (err) {
          log.error("search tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Search failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_search_people" },
  )
}
