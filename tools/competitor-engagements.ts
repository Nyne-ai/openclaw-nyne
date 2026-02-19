import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerCompetitorEngagementsTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_competitor_engagements",
      label: "Competitor Engagements",
      description:
        "Analyze LinkedIn engagement activity for one or more profiles. Returns comments and reactions they've made on posts — useful for lead generation, competitive intelligence, and understanding what topics they engage with. Up to 50 LinkedIn URLs per request.",
      parameters: Type.Object({
        linkedin_urls: Type.Array(Type.String(), {
          description: "LinkedIn profile URLs to analyze (max 50)",
        }),
        max_items: Type.Optional(
          Type.Number({ description: "Max engagement results per profile (default: 20, max: 100)" }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: {
          linkedin_urls: string[]
          max_items?: number
        },
      ) {
        if (!params.linkedin_urls?.length) {
          return {
            content: [{ type: "text" as const, text: "Error: Provide at least one LinkedIn URL" }],
          }
        }

        if (params.linkedin_urls.length > 50) {
          return {
            content: [{ type: "text" as const, text: "Error: Maximum 50 LinkedIn URLs per request" }],
          }
        }

        log.debug(`competitor-engagements tool: ${params.linkedin_urls.length} URLs`)

        try {
          const result = await client.competitorEngagements(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Competitor engagements failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const results = (data.results ?? data.result ?? []) as Array<Record<string, unknown>>

          if (!Array.isArray(results) || results.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No engagement activity found for the provided profiles." }],
            }
          }

          const lines: string[] = [`Found ${results.length} engagement(s):\n`]

          for (const engagement of results.slice(0, 20)) {
            const type = engagement.interaction_type ?? "engagement"
            const date = engagement.interaction_date ?? ""
            const content = engagement.content ?? ""
            const target = engagement.target as Record<string, unknown> | undefined

            let line = `- **${type}**`
            if (date) line += ` (${String(date).split("T")[0]})`
            if (target?.author_name) line += ` on ${target.author_name}'s post`
            if (content) line += `\n  "${String(content).substring(0, 150)}${String(content).length > 150 ? "..." : ""}"`

            lines.push(line)
          }

          if (results.length > 20) {
            lines.push(`\n... and ${results.length - 20} more (see details)`)
          }

          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            details: { count: results.length, engagements: results },
          }
        } catch (err) {
          log.error("competitor-engagements tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Competitor engagements failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_competitor_engagements" },
  )
}
