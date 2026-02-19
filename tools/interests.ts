import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerInterestsTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_person_interests",
      label: "Person Interests",
      description:
        "Analyze a person's psychographic profile from their social media. Returns core archetypes, interest graph, brand affinities, values, political leanings, cultural DNA, and social graph clusters. Works best with Twitter or Instagram URLs.",
      parameters: Type.Object({
        social_media_url: Type.String({ description: "Social media URL (Twitter or Instagram preferred)" }),
      }),
      async execute(
        _toolCallId: string,
        params: { social_media_url: string },
      ) {
        log.debug(`interests tool: ${params.social_media_url}`)

        try {
          const result = await client.getPersonInterests(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Interests analysis failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const interests = (data.result ?? data) as Record<string, unknown>

          const lines: string[] = []

          const archetypes = interests.archetypes as string[] | undefined
          if (archetypes?.length) {
            lines.push("**Core Archetypes:**")
            archetypes.forEach((a) => lines.push(`- ${a}`))
          }

          const interestGraph = interests.interest_graph as Record<string, unknown> | undefined
          if (interestGraph) {
            lines.push("\n**Interest Graph:**")
            for (const [category, items] of Object.entries(interestGraph)) {
              if (Array.isArray(items) && items.length > 0) {
                lines.push(`- ${category}: ${items.join(", ")}`)
              }
            }
          }

          const brands = interests.brand_affinities as string[] | undefined
          if (brands?.length) {
            lines.push(`\n**Brand Affinities:** ${brands.join(", ")}`)
          }

          const values = interests.values as string[] | undefined
          if (values?.length) {
            lines.push(`\n**Values:** ${values.join(", ")}`)
          }

          const summary = lines.length > 0 ? lines.join("\n") : "Interests analyzed (see full data in details)"

          return {
            content: [{ type: "text" as const, text: summary }],
            details: { interests },
          }
        } catch (err) {
          log.error("interests tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Interests analysis failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_person_interests" },
  )
}
