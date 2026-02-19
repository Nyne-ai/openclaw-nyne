import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerInteractionsTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_interactions",
      label: "Social Interactions",
      description:
        "Get social media interaction data for a person. Can retrieve: replies to a tweet, followers of an account, or accounts someone follows. Works with Twitter/X and Instagram URLs.",
      parameters: Type.Object({
        type: Type.Union(
          [
            Type.Literal("replies"),
            Type.Literal("followers"),
            Type.Literal("following"),
            Type.Literal("followers,following"),
          ],
          { description: "Type of interactions: 'replies' (tweet replies), 'followers', 'following', or 'followers,following'" },
        ),
        social_media_url: Type.String({
          description: "Twitter/X or Instagram URL. For 'replies', use a tweet URL. For followers/following, use a profile URL.",
        }),
        max_results: Type.Optional(
          Type.Number({ description: "Max results (default: 100, max: 1000)" }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: {
          type: "replies" | "followers" | "following" | "followers,following"
          social_media_url: string
          max_results?: number
        },
      ) {
        log.debug(`interactions tool: type=${params.type} url=${params.social_media_url}`)

        try {
          const result = await client.getInteractions(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Interactions failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const interactionResult = (data.result ?? data) as Record<string, unknown>
          const interactions = (interactionResult.interactions ?? []) as Array<Record<string, unknown>>

          if (!Array.isArray(interactions) || interactions.length === 0) {
            return {
              content: [{ type: "text" as const, text: `No ${params.type} found.` }],
            }
          }

          const lines: string[] = [`Found ${interactions.length} ${params.type}:\n`]

          for (const person of interactions.slice(0, 25)) {
            const name = person.display_name ?? person.name ?? person.username ?? "Unknown"
            const handle = person.username ?? person.handle ?? ""
            const bio = person.bio ?? person.description ?? ""
            const verified = person.verified ? " [verified]" : ""

            let line = `- **${name}**${verified}`
            if (handle) line += ` (@${handle})`
            if (bio) line += `\n  ${String(bio).substring(0, 120)}${String(bio).length > 120 ? "..." : ""}`

            lines.push(line)
          }

          if (interactions.length > 25) {
            lines.push(`\n... and ${interactions.length - 25} more (see details)`)
          }

          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            details: { count: interactions.length, interactions },
          }
        } catch (err) {
          log.error("interactions tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Interactions failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_interactions" },
  )
}
