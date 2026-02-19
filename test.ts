/**
 * Quick smoke test — run with: npx tsx test.ts
 *
 * Tests the Nyne API client directly (no OpenClaw needed).
 * Uses credentials from environment or ~/.env
 */

import { NyneClient } from "./client.ts"
import { parseConfig } from "./config.ts"
import { initLogger } from "./logger.ts"

// Load env from ~/.env if not already set
if (!process.env.NYNE_API_KEY) {
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { homedir } = await import("node:os")
  try {
    const envFile = readFileSync(join(homedir(), ".env"), "utf-8")
    for (const line of envFile.split("\n")) {
      const [key, ...rest] = line.split("=")
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim()
    }
  } catch { /* no .env file */ }
}

const cfg = parseConfig({
  apiKey: process.env.NYNE_API_KEY,
  apiSecret: process.env.NYNE_API_SECRET,
  debug: true,
})

initLogger(console, true)

const client = new NyneClient(cfg)

async function test() {
  // Test 1: Enrich a person
  console.log("\n=== 1. Enrich Person ===")
  const enrich = await client.enrichPerson({
    email: "michael@nyne.ai",
  })
  const data = enrich.data as any
  console.log("Status:", data?.status)
  const person = data?.result ?? data
  console.log("Name:", person?.displayname ?? `${person?.firstname} ${person?.lastname}`)
  console.log("Bio:", person?.bio)
  console.log("Location:", person?.location)
  console.log("Emails:", person?.altemails)
  console.log("Orgs:", person?.organizations?.map((o: any) => `${o.title} at ${o.name}`))

  // Test 2: Search People (natural language query)
  console.log("\n=== 2. Search People ===")
  const search = await client.searchPeople({
    query: "CEO at AI startups in San Francisco",
    limit: 3,
  })
  const searchData = search.data as any
  console.log("Status:", searchData?.status)
  const profiles = searchData?.results ?? []
  console.log(`Found ${Array.isArray(profiles) ? profiles.length : 0} results`)
  if (Array.isArray(profiles)) {
    for (const p of profiles.slice(0, 3)) {
      console.log(`  - ${p.displayname ?? p.full_name ?? p.name} — ${p.headline ?? ""}`)
    }
  }

  console.log("\n=== All tests passed! ===\n")
}

test().catch((err) => {
  console.error("\nTest failed:", err.message)
  process.exit(1)
})
