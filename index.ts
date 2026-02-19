import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { NyneClient } from "./client.ts"
import { registerCommands } from "./commands/slash.ts"
import { registerCliCommands } from "./commands/setup.ts"
import { parseConfig, nyneConfigSchema } from "./config.ts"
import { initLogger } from "./logger.ts"
import { registerEnrichTool } from "./tools/enrich.ts"
import { registerSearchTool } from "./tools/search.ts"
import { registerInterestsTool } from "./tools/interests.ts"
import { registerArticlesTool } from "./tools/articles.ts"
import { registerDeepResearchTool } from "./tools/deep-research.ts"
import { registerCompetitorEngagementsTool } from "./tools/competitor-engagements.ts"
import { registerInteractionsTool } from "./tools/interactions.ts"

export default {
  id: "openclaw-nyne",
  name: "Nyne",
  description: "Nyne gives your AI agent people intelligence — enrich, search, and analyze anyone",
  kind: "enrichment" as const,
  configSchema: nyneConfigSchema,

  register(api: OpenClawPluginApi) {
    // Register CLI commands (openclaw openclaw-nyne setup|status)
    api.registerCli(
      (ctx) => {
        registerCliCommands(ctx.program, api.pluginConfig)
      },
      { commands: ["openclaw-nyne"] },
    )

    // Check if configured
    const rawConfig = api.pluginConfig as Record<string, unknown> | undefined
    const hasConfig =
      rawConfig?.apiKey ||
      rawConfig?.apiSecret ||
      process.env.NYNE_API_KEY ||
      process.env.NYNE_API_SECRET

    if (!hasConfig) {
      api.logger.info("nyne: not configured - run 'openclaw openclaw-nyne setup'")

      // Register placeholder commands that show setup instructions
      const notConfiguredHandler = async () => ({
        text: "Nyne not configured. Run 'openclaw openclaw-nyne setup' first.",
      })

      api.registerCommand({
        name: "enrich",
        description: "Enrich a person's profile",
        acceptsArgs: true,
        requireAuth: false,
        handler: notConfiguredHandler,
      })
      api.registerCommand({
        name: "search",
        description: "Search for people",
        acceptsArgs: true,
        requireAuth: false,
        handler: notConfiguredHandler,
      })
      api.registerCommand({
        name: "lookup",
        description: "Full person lookup",
        acceptsArgs: true,
        requireAuth: false,
        handler: notConfiguredHandler,
      })
      return
    }

    const cfg = parseConfig(api.pluginConfig)

    initLogger(api.logger, cfg.debug)

    const client = new NyneClient(cfg)

    // Register AI tools
    registerEnrichTool(api, client, cfg)
    registerSearchTool(api, client, cfg)
    registerInterestsTool(api, client, cfg)
    registerArticlesTool(api, client, cfg)
    registerDeepResearchTool(api, client, cfg)
    registerCompetitorEngagementsTool(api, client, cfg)
    registerInteractionsTool(api, client, cfg)

    // Register slash commands
    registerCommands(api, client, cfg)

    // Register service for lifecycle management
    api.registerService({
      id: "openclaw-nyne",
      start: () => {
        api.logger.info("nyne: connected")
      },
      stop: () => {
        api.logger.info("nyne: stopped")
      },
    })
  },
}
