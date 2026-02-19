import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerDeepResearchTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_deep_research",
      label: "Deep Research",
      description:
        "Run comprehensive deep research on a person. Combines enrichment, social following analysis, article discovery, and AI-generated intelligence dossier with 13 sections. Takes 2-5 minutes. Costs 100 credits. Provide at least one identifier.",
      parameters: Type.Object({
        email: Type.Optional(Type.String({ description: "Email address" })),
        phone: Type.Optional(Type.String({ description: "Phone number (E.164 format)" })),
        social_media_url: Type.Optional(
          Type.Union([
            Type.String({ description: "Single social media URL" }),
            Type.Array(Type.String(), { description: "Multiple social media URLs" }),
          ], { description: "LinkedIn, Twitter/X, or Instagram URL(s)" }),
        ),
        name: Type.Optional(Type.String({ description: "Full name (requires company or city)" })),
        company: Type.Optional(Type.String({ description: "Company name (for name disambiguation)" })),
        city: Type.Optional(Type.String({ description: "City (for name disambiguation)" })),
      }),
      async execute(
        _toolCallId: string,
        params: {
          email?: string
          phone?: string
          social_media_url?: string | string[]
          name?: string
          company?: string
          city?: string
        },
      ) {
        if (!params.email && !params.phone && !params.social_media_url && !params.name) {
          return {
            content: [{ type: "text" as const, text: "Error: Provide at least one of: email, phone, social_media_url, or name (with company or city)" }],
          }
        }

        if (params.name && !params.company && !params.city) {
          return {
            content: [{ type: "text" as const, text: "Error: When using name, you must also provide company or city for disambiguation" }],
          }
        }

        log.debug(`deep-research tool: ${JSON.stringify(params)}`)

        try {
          const result = await client.deepResearch(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Deep research failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const researchResult = (data.result ?? data) as Record<string, unknown>

          // Extract the dossier (the main output)
          const dossier = researchResult.dossier as string | Record<string, unknown> | undefined
          const enrichment = researchResult.enrichment as Record<string, unknown> | undefined

          const lines: string[] = []

          // Person header from enrichment data
          if (enrichment) {
            const person = (enrichment as Record<string, unknown>).result as Record<string, unknown> | undefined ?? enrichment
            if (person.full_name) lines.push(`# ${person.full_name}`)
            if (person.headline) lines.push(`*${person.headline}*`)
            lines.push("")
          }

          // Include the dossier text
          if (typeof dossier === "string") {
            lines.push(dossier)
          } else if (dossier && typeof dossier === "object") {
            // Dossier might be structured with sections
            for (const [section, content] of Object.entries(dossier)) {
              if (typeof content === "string") {
                lines.push(`## ${section}\n${content}\n`)
              }
            }
          }

          const summary = lines.length > 0 ? lines.join("\n") : "Deep research complete (see full data in details)"

          return {
            content: [{ type: "text" as const, text: summary }],
            details: { research: researchResult },
          }
        } catch (err) {
          log.error("deep-research tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Deep research failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_deep_research" },
  )
}
