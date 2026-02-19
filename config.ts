export interface NyneConfig {
  apiKey: string
  apiSecret: string
  debug: boolean
  defaultPollTimeout: number
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_match, varName) => {
    return process.env[varName] ?? ""
  })
}

export function parseConfig(raw: unknown): NyneConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>

  const apiKey = resolveEnvVars(String(cfg.apiKey ?? process.env.NYNE_API_KEY ?? ""))
  const apiSecret = resolveEnvVars(String(cfg.apiSecret ?? process.env.NYNE_API_SECRET ?? ""))

  if (!apiKey || !apiSecret) {
    throw new Error("Nyne API key and secret are required. Run 'openclaw openclaw-nyne setup' to configure.")
  }

  return {
    apiKey,
    apiSecret,
    debug: cfg.debug === true,
    defaultPollTimeout: typeof cfg.defaultPollTimeout === "number" ? cfg.defaultPollTimeout * 1000 : 60_000,
  }
}

export const nyneConfigSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    apiKey: { type: "string" as const },
    apiSecret: { type: "string" as const },
    debug: { type: "boolean" as const },
    defaultPollTimeout: { type: "number" as const, minimum: 10, maximum: 300 },
  },
  required: [] as string[],
}
