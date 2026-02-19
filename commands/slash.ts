import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerCommands(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  // /enrich <email, linkedin url, or social url>
  api.registerCommand({
    name: "enrich",
    description: "Enrich a person's profile (email, LinkedIn URL, or social URL)",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const input = ctx.args?.trim()
      if (!input) {
        return { text: "Usage: /enrich <email, LinkedIn URL, or social media URL>" }
      }

      try {
        const params: Record<string, unknown> = {}

        if (input.includes("@")) {
          params.email = input
        } else if (input.includes("linkedin.com")) {
          params.social_media_url = input
        } else if (input.startsWith("http")) {
          params.social_media_url = input
        } else {
          // Treat as email if it looks like one, otherwise as a name search
          params.email = input
        }

        const result = await client.enrichPerson(params as Parameters<typeof client.enrichPerson>[0])
        const data = result.data as Record<string, unknown> | undefined
        const person = (data?.result ?? data) as Record<string, unknown>

        const lines: string[] = []
        const name = person.displayname ?? [person.firstname, person.lastname].filter(Boolean).join(" ")
        if (name) lines.push(`**${name}**`)
        if (person.bio) lines.push(String(person.bio))
        if (person.location) lines.push(`Location: ${person.location}`)
        const emails = person.altemails as string[] | undefined
        if (emails?.length) lines.push(`Email: ${emails[0]}`)

        const orgs = person.organizations as Array<Record<string, unknown>> | undefined
        if (orgs?.length) {
          lines.push(`Current: ${orgs[0].title} at ${orgs[0].name}`)
        }

        return { text: lines.length > 0 ? lines.join("\n") : JSON.stringify(person, null, 2) }
      } catch (err) {
        log.error("slash enrich failed", err)
        return { text: `Enrichment failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  })

  // /search <natural language query>
  api.registerCommand({
    name: "search",
    description: "Search for people (e.g., /search VP of Sales at fintech startups in NYC)",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const input = ctx.args?.trim()
      if (!input) {
        return { text: "Usage: /search <query> (e.g., 'VP of Sales at fintech startups in NYC')" }
      }

      try {
        const result = await client.searchPeople({ query: input, limit: 10 })
        const data = result.data as Record<string, unknown> | undefined
        const profiles = (data?.results ?? []) as Array<Record<string, unknown>>

        if (!Array.isArray(profiles) || profiles.length === 0) {
          return { text: "No people found." }
        }

        const lines = profiles.slice(0, 10).map((p, i) => {
          const name = p.displayname ?? p.full_name ?? p.name ?? "Unknown"
          const headline = p.headline ?? ""
          return `${i + 1}. **${name}**${headline ? ` — ${headline}` : ""}`
        })

        return { text: `Found ${profiles.length} people:\n\n${lines.join("\n")}` }
      } catch (err) {
        log.error("slash search failed", err)
        return { text: `Search failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  })

  // /lookup <social url> — interests + enrichment
  api.registerCommand({
    name: "lookup",
    description: "Full lookup: enrichment + psychographic analysis for a social media URL",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const input = ctx.args?.trim()
      if (!input) {
        return { text: "Usage: /lookup <social media URL> (Twitter or Instagram preferred)" }
      }

      try {
        // Run enrichment and interests in parallel
        const [enrichResult, interestsResult] = await Promise.allSettled([
          client.enrichPerson({ social_media_url: input }),
          client.getPersonInterests({ social_media_url: input }),
        ])

        const lines: string[] = []

        // Process enrichment
        if (enrichResult.status === "fulfilled") {
          const data = enrichResult.value.data as Record<string, unknown> | undefined
          const person = (data?.result ?? data) as Record<string, unknown>

          if (person.full_name) lines.push(`**${person.full_name}**`)
          if (person.headline) lines.push(String(person.headline))
          if (person.location) lines.push(`Location: ${person.location}`)
          if (person.best_email) lines.push(`Email: ${person.best_email}`)
        }

        // Process interests
        if (interestsResult.status === "fulfilled") {
          const data = interestsResult.value.data as Record<string, unknown> | undefined
          const interests = (data?.result ?? data) as Record<string, unknown>

          const archetypes = interests.archetypes as string[] | undefined
          if (archetypes?.length) {
            lines.push(`\n**Archetypes:** ${archetypes.join(", ")}`)
          }

          const brands = interests.brand_affinities as string[] | undefined
          if (brands?.length) {
            lines.push(`**Brand Affinities:** ${brands.slice(0, 10).join(", ")}`)
          }

          const values = interests.values as string[] | undefined
          if (values?.length) {
            lines.push(`**Values:** ${values.join(", ")}`)
          }
        }

        if (lines.length === 0) {
          return { text: "Could not retrieve data for this URL." }
        }

        return { text: lines.join("\n") }
      } catch (err) {
        log.error("slash lookup failed", err)
        return { text: `Lookup failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  })
}
