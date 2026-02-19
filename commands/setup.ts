import type { Command } from "commander"
import * as p from "@clack/prompts"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

function getOpenClawDir(): string {
  return join(homedir(), ".openclaw")
}

export function registerCliCommands(program: Command, _pluginConfig: unknown): void {
  const nyne = program.command("openclaw-nyne").description("Nyne people intelligence plugin")

  nyne
    .command("setup")
    .description("Configure Nyne API credentials")
    .action(async () => {
      p.intro("Nyne People Intelligence Setup")

      p.note(
        "Nyne gives your AI agent access to comprehensive people data:\n" +
        "- Person enrichment (contact info, career, education, social profiles)\n" +
        "- People search (by company, role, location, name)\n" +
        "- Psychographic analysis (interests, values, brand affinities)\n" +
        "- Article & press discovery\n\n" +
        "You'll need your API key and secret from nyne.ai",
        "About Nyne",
      )

      const apiKey = await p.text({
        message: "Enter your Nyne API Key:",
        placeholder: "your-api-key",
        validate: (val) => {
          if (!val?.trim()) return "API key is required"
        },
      })

      if (p.isCancel(apiKey)) {
        p.cancel("Setup cancelled.")
        return
      }

      const apiSecret = await p.text({
        message: "Enter your Nyne API Secret:",
        placeholder: "your-api-secret",
        validate: (val) => {
          if (!val?.trim()) return "API secret is required"
        },
      })

      if (p.isCancel(apiSecret)) {
        p.cancel("Setup cancelled.")
        return
      }

      // Test credentials
      const testSpinner = p.spinner()
      testSpinner.start("Testing credentials...")

      try {
        const response = await fetch("https://api.nyne.ai/usage", {
          method: "GET",
          headers: {
            "X-API-Key": apiKey as string,
            "X-API-Secret": apiSecret as string,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          testSpinner.stop("Credentials test failed")
          p.log.error(`API returned ${response.status}. Please check your credentials.`)
          return
        }

        testSpinner.stop("Credentials verified!")
      } catch (err) {
        testSpinner.stop("Connection failed")
        p.log.error(`Could not reach Nyne API: ${err instanceof Error ? err.message : String(err)}`)
        return
      }

      // Write config
      const openclawDir = getOpenClawDir()
      mkdirSync(openclawDir, { recursive: true })

      // Write secrets to .env
      const envPath = join(openclawDir, ".env")
      let envContent = ""
      if (existsSync(envPath)) {
        envContent = readFileSync(envPath, "utf-8")
      }

      // Update or add NYNE_API_KEY
      if (envContent.includes("NYNE_API_KEY=")) {
        envContent = envContent.replace(/NYNE_API_KEY=.*/g, `NYNE_API_KEY=${apiKey}`)
      } else {
        envContent += `\nNYNE_API_KEY=${apiKey}`
      }

      // Update or add NYNE_API_SECRET
      if (envContent.includes("NYNE_API_SECRET=")) {
        envContent = envContent.replace(/NYNE_API_SECRET=.*/g, `NYNE_API_SECRET=${apiSecret}`)
      } else {
        envContent += `\nNYNE_API_SECRET=${apiSecret}`
      }

      writeFileSync(envPath, envContent.trim() + "\n", "utf-8")

      // Write plugin config to openclaw.json
      const configPath = join(openclawDir, "openclaw.json")
      let config: Record<string, unknown> = {}
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf-8"))
        } catch {
          // Start fresh if parse fails
        }
      }

      const plugins = (config.plugins ?? {}) as Record<string, unknown>
      plugins["openclaw-nyne"] = {
        apiKey: "${NYNE_API_KEY}",
        apiSecret: "${NYNE_API_SECRET}",
      }
      config.plugins = plugins

      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8")

      p.outro(
        "Nyne is configured! Your AI agent now has access to:\n" +
        "  - /enrich <email or url>  — Enrich a person's profile\n" +
        "  - /search <criteria>      — Search for people\n" +
        "  - /lookup <social url>    — Full psychographic analysis\n\n" +
        "The AI can also use these tools autonomously when relevant.",
      )
    })

  nyne
    .command("status")
    .description("Check Nyne configuration and API status")
    .action(async () => {
      p.intro("Nyne Status")

      const apiKey = process.env.NYNE_API_KEY
      const apiSecret = process.env.NYNE_API_SECRET

      if (!apiKey || !apiSecret) {
        p.log.error("Not configured. Run 'openclaw openclaw-nyne setup' first.")
        return
      }

      p.log.info(`API Key: ***${apiKey.slice(-4)}`)

      const spinner = p.spinner()
      spinner.start("Checking API...")

      try {
        const response = await fetch("https://api.nyne.ai/usage", {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            "X-API-Secret": apiSecret,
            "Content-Type": "application/json",
          },
        })

        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>
          spinner.stop("API is reachable")
          p.log.info(`Usage: ${JSON.stringify(data, null, 2)}`)
        } else {
          spinner.stop(`API returned ${response.status}`)
        }
      } catch (err) {
        spinner.stop(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
      }

      p.outro("Done")
    })
}
