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

          // Format a readable summary
          const lines: string[] = []
          if (person.full_name) lines.push(`**${person.full_name}**`)
          if (person.headline) lines.push(`${person.headline}`)
          if (person.location) lines.push(`Location: ${person.location}`)
          if (person.best_email) lines.push(`Email: ${person.best_email}`)
          if (person.best_work_email && person.best_work_email !== person.best_email) {
            lines.push(`Work Email: ${person.best_work_email}`)
          }

          const phones = person.phones as Array<Record<string, unknown>> | undefined
          if (phones?.length) {
            lines.push(`Phone: ${phones.map((p) => p.phone_number ?? p.number).join(", ")}`)
          }

          const careers = person.careers_info as Array<Record<string, unknown>> | undefined
          if (careers?.length) {
            lines.push("\n**Career:**")
            for (const job of careers.slice(0, 5)) {
              const current = job.is_current ? " (current)" : ""
              lines.push(`- ${job.title} at ${job.company_name}${current}`)
            }
          }

          const schools = person.schools_info as Array<Record<string, unknown>> | undefined
          if (schools?.length) {
            lines.push("\n**Education:**")
            for (const school of schools.slice(0, 3)) {
              lines.push(`- ${school.school_name}${school.degree ? ` — ${school.degree}` : ""}`)
            }
          }

          const socials = person.social_profiles as Record<string, string> | undefined
          if (socials && Object.keys(socials).length > 0) {
            lines.push("\n**Social Profiles:**")
            for (const [platform, url] of Object.entries(socials)) {
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
