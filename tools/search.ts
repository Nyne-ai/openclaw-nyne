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
        "Search for people using natural language queries. Examples: 'VP of Sales at fintech startups in New York', 'machine learning engineers at Google with 5+ years experience'. Returns matching professional profiles with contact info.",
      parameters: Type.Object({
        query: Type.String({ description: "Natural language description of target people (max 1000 chars)" }),
        limit: Type.Optional(Type.Number({ description: "Results per request (default: 10, max: 100)" })),
        show_emails: Type.Optional(Type.Boolean({ description: "Include email addresses (costs 2 extra credits per result)" })),
        show_phone_numbers: Type.Optional(Type.Boolean({ description: "Include phone numbers (costs 14 extra credits per result)" })),
        insights: Type.Optional(Type.Boolean({ description: "Include AI-generated relevance insights" })),
        profile_scoring: Type.Optional(Type.Boolean({ description: "Add AI relevance scores to results" })),
        type: Type.Optional(
          Type.Union([Type.Literal("light"), Type.Literal("medium"), Type.Literal("premium")], {
            description: "Search tier: light (1 credit), medium, premium (5 credits, default)",
          }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: {
          query: string
          limit?: number
          show_emails?: boolean
          show_phone_numbers?: boolean
          insights?: boolean
          profile_scoring?: boolean
          type?: "light" | "medium" | "premium"
        },
      ) {
        if (!params.query?.trim()) {
          return {
            content: [{ type: "text" as const, text: "Error: A search query is required." }],
          }
        }

        log.debug(`search tool: query="${params.query}"`)

        try {
          const result = await client.searchPeople(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Search failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const profiles = (data.results ?? []) as Array<Record<string, unknown>>

          if (!Array.isArray(profiles) || profiles.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No people found matching the search criteria." }],
            }
          }

          const totalEstimate = data.total_estimate as number | undefined
          const lines = profiles.slice(0, 25).map((p, i) => {
            const name = p.displayname ?? p.full_name ?? p.name ?? "Unknown"
            const headline = p.headline ?? ""
            const location = p.location ?? ""
            const email = p.best_business_email ?? p.best_personal_email ?? ""
            const linkedin = (p.social_profiles as Record<string, Record<string, string>> | undefined)?.linkedin?.url ?? ""
            const score = p.score as number | undefined
            const insight = (p.insights as Record<string, string> | undefined)?.overall_summary

            let line = `${i + 1}. **${name}**`
            if (headline) line += ` — ${headline}`
            if (location) line += ` (${location})`
            if (score) line += ` [${Math.round(score * 100)}% match]`
            if (email) line += `\n   Email: ${email}`
            if (linkedin) line += `\n   ${linkedin}`
            if (insight) line += `\n   Insight: ${insight}`
            return line
          })

          const header = totalEstimate
            ? `Found ~${totalEstimate} people (showing ${profiles.length}):`
            : `Found ${profiles.length} people:`

          const text = `${header}\n\n${lines.join("\n\n")}`

          return {
            content: [{ type: "text" as const, text }],
            details: { count: profiles.length, totalEstimate, profiles },
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
