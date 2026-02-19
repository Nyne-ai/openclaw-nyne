import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerEnrichTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_enrich_person",
      label: "Enrich Person",
      description:
        "Enrich a person's profile with comprehensive data including contact info, career history, education, social profiles, and social media activity. Provide at least one identifier: email, LinkedIn URL, phone, or social media URL. Automatically waits for results.",
      parameters: Type.Object({
        email: Type.Optional(Type.String({ description: "Email address" })),
        linkedin_url: Type.Optional(Type.String({ description: "LinkedIn profile URL" })),
        phone: Type.Optional(Type.String({ description: "Phone number" })),
        social_media_url: Type.Optional(Type.String({ description: "Any social media profile URL" })),
        newsfeed: Type.Optional(
          Type.Union([
            Type.Literal("all"),
            Type.Array(Type.String({ description: "Platform: linkedin, twitter, instagram, github, facebook" })),
          ], { description: "Request social media posts. Use 'all' or specify platforms." }),
        ),
        lite_enrich: Type.Optional(Type.Boolean({ description: "Basic info only (faster, fewer credits)" })),
      }),
      async execute(
        _toolCallId: string,
        params: {
          email?: string
          linkedin_url?: string
          phone?: string
          social_media_url?: string
          newsfeed?: string | string[]
          lite_enrich?: boolean
        },
      ) {
        if (!params.email && !params.linkedin_url && !params.phone && !params.social_media_url) {
          return {
            content: [{ type: "text" as const, text: "Error: Provide at least one of: email, linkedin_url, phone, or social_media_url" }],
          }
        }

        log.debug(`enrich tool: ${JSON.stringify(params)}`)

        try {
          const result = await client.enrichPerson(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Enrichment failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const person = (data.result ?? data) as Record<string, unknown>

          // Format a readable summary — field names match actual API response
          const lines: string[] = []
          const name = person.displayname ?? [person.firstname, person.lastname].filter(Boolean).join(" ")
          if (name) lines.push(`**${name}**`)
          if (person.bio) lines.push(`${person.bio}`)
          if (person.location) lines.push(`Location: ${person.location}`)

          const emails = person.altemails as string[] | undefined
          if (emails?.length) {
            lines.push(`Email: ${emails[0]}${emails.length > 1 ? ` (+${emails.length - 1} more)` : ""}`)
          }

          const phones = person.fullphone as Array<Record<string, unknown>> | undefined
          if (phones?.length) {
            lines.push(`Phone: ${phones.map((p) => p.fullphone).join(", ")}`)
          }

          const orgs = person.organizations as Array<Record<string, unknown>> | undefined
          if (orgs?.length) {
            lines.push("\n**Career:**")
            for (const job of orgs.slice(0, 5)) {
              lines.push(`- ${job.title} at ${job.name}${job.startDate ? ` (${job.startDate})` : ""}`)
            }
          }

          const schools = person.schools_info as Array<Record<string, unknown>> | undefined
          if (schools?.length) {
            lines.push("\n**Education:**")
            for (const school of schools.slice(0, 3)) {
              lines.push(`- ${school.name}${school.degree ? ` — ${school.degree} ${school.title ?? ""}` : ""}`)
            }
          }

          const socials = person.social_profiles as Record<string, Record<string, string>> | undefined
          if (socials && Object.keys(socials).length > 0) {
            lines.push("\n**Social Profiles:**")
            for (const [platform, profile] of Object.entries(socials)) {
              const url = typeof profile === "string" ? profile : profile?.url
              if (url) lines.push(`- ${platform}: ${url}`)
            }
          }

          const summary = lines.length > 0 ? lines.join("\n") : "Person enriched (see full data in details)"

          return {
            content: [{ type: "text" as const, text: summary }],
            details: { person },
          }
        } catch (err) {
          log.error("enrich tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Enrichment failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_enrich_person" },
  )
}
