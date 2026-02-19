import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { NyneClient } from "../client.ts"
import type { NyneConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerArticlesTool(
  api: OpenClawPluginApi,
  client: NyneClient,
  _cfg: NyneConfig,
): void {
  api.registerTool(
    {
      name: "nyne_article_search",
      label: "Article Search",
      description:
        "Find articles, press mentions, podcasts, YouTube videos, interviews, and thought leadership content about a person. Useful for research and preparation before meetings.",
      parameters: Type.Object({
        person_name: Type.String({ description: "Person's full name" }),
        company_name: Type.Optional(Type.String({ description: "Company name for more precise results" })),
        sort: Type.Optional(
          Type.Union([Type.Literal("recent"), Type.Literal("relevance")], {
            description: "Sort order: 'recent' or 'relevance' (default: relevance)",
          }),
        ),
        limit: Type.Optional(Type.Number({ description: "Max results (default: 10)" })),
      }),
      async execute(
        _toolCallId: string,
        params: {
          person_name: string
          company_name?: string
          sort?: "recent" | "relevance"
          limit?: number
        },
      ) {
        log.debug(`articles tool: ${params.person_name}`)

        try {
          const result = await client.searchArticles(params)
          const data = result.data as Record<string, unknown> | undefined

          if (!data || data.status === "failed") {
            return {
              content: [{ type: "text" as const, text: `Article search failed: ${JSON.stringify(data?.error ?? "Unknown error")}` }],
            }
          }

          const articles = (data.result ?? data.results ?? []) as Array<Record<string, unknown>>

          if (!Array.isArray(articles) || articles.length === 0) {
            return {
              content: [{ type: "text" as const, text: `No articles found for ${params.person_name}.` }],
            }
          }

          const lines = articles.slice(0, 15).map((a, i) => {
            const title = a.title ?? "Untitled"
            const source = a.source ?? a.publisher ?? ""
            const url = a.url ?? a.link ?? ""
            const date = a.date ?? a.published_date ?? ""

            let line = `${i + 1}. **${title}**`
            if (source) line += ` — ${source}`
            if (date) line += ` (${date})`
            if (url) line += `\n   ${url}`
            return line
          })

          const text = `Found ${articles.length} articles about ${params.person_name}:\n\n${lines.join("\n\n")}`

          return {
            content: [{ type: "text" as const, text }],
            details: { count: articles.length, articles },
          }
        } catch (err) {
          log.error("articles tool failed", err)
          return {
            content: [{ type: "text" as const, text: `Article search failed: ${err instanceof Error ? err.message : String(err)}` }],
          }
        }
      },
    },
    { name: "nyne_article_search" },
  )
}
