import type { NyneConfig } from "./config.ts"
import { log } from "./logger.ts"

const API_BASE = "https://api.nyne.ai"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class NyneClient {
  private config: NyneConfig

  constructor(config: NyneConfig) {
    this.config = config
    log.info("client initialized")
  }

  private async request(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${API_BASE}${endpoint}`

    log.debugRequest(`${method} ${endpoint}`, body ?? {})

    const headers: Record<string, string> = {
      "X-API-Key": this.config.apiKey,
      "X-API-Secret": this.config.apiSecret,
      "Content-Type": "application/json",
    }

    const options: RequestInit = { method, headers }
    if (body && method === "POST") {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      const text = await response.text()
      throw new Error(`API returned non-JSON response (${response.status}): ${text.substring(0, 200)}`)
    }

    const data = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      let errorMsg = JSON.stringify(data)
      errorMsg = errorMsg.replace(new RegExp(this.config.apiKey, "g"), "[REDACTED]")
      errorMsg = errorMsg.replace(new RegExp(this.config.apiSecret, "g"), "[REDACTED]")
      throw new Error(`API Error (${response.status}): ${errorMsg}`)
    }

    log.debugResponse(`${method} ${endpoint}`, { status: response.status })
    return data
  }

  private async waitForResult(
    requestId: string,
    kind: "search" | "enrichment" | "interests" | "articlesearch" | "deep-research" | "competitor-engagements" | "interactions",
    options?: { intervalMs?: number; maxAttempts?: number },
  ): Promise<Record<string, unknown>> {
    const intervalMs = options?.intervalMs ?? 2000
    const maxAttempts = options?.maxAttempts ?? Math.ceil(this.config.defaultPollTimeout / intervalMs)

    const endpointMap: Record<string, string> = {
      search: "/person/search",
      enrichment: "/person/enrichment",
      interests: "/person/interests",
      articlesearch: "/person/articlesearch",
      "deep-research": "/person/deep-research",
      "competitor-engagements": "/person/competitor-engagements",
      interactions: "/person/interactions",
    }

    const endpoint = endpointMap[kind]

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await this.request(`${endpoint}?request_id=${requestId}`, "GET")
      const data = res.data as Record<string, unknown> | undefined
      const status = data?.status as string | undefined

      if (status && status !== "queued" && status !== "processing" && status !== "pending") {
        return res
      }

      log.debug(`polling ${kind} (attempt ${attempt + 1}/${maxAttempts}): status=${status}`)
      await delay(intervalMs)
    }

    throw new Error(`Timed out waiting for ${kind} result (request_id=${requestId})`)
  }

  async searchPeople(params: {
    company_name?: string
    role?: string
    geography?: string
    person_name?: string
    college?: string
    tenure?: number
    keywords?: string
    high_connection_count?: boolean
    limit?: number
    page?: number
    exact_match?: boolean
    enrich_results?: boolean
  }): Promise<Record<string, unknown>> {
    const postRes = await this.request("/person/search", "POST", params as Record<string, unknown>)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    return this.waitForResult(requestId, "search")
  }

  async enrichPerson(params: {
    email?: string
    linkedin_url?: string
    phone?: string
    social_media_url?: string
    newsfeed?: string | string[]
    lite_enrich?: boolean
  }): Promise<Record<string, unknown>> {
    // Map linkedin_url to social_media_url if provided
    const body: Record<string, unknown> = { ...params }
    if (params.linkedin_url && !params.social_media_url) {
      body.social_media_url = params.linkedin_url
      delete body.linkedin_url
    }

    const postRes = await this.request("/person/enrichment", "POST", body)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    return this.waitForResult(requestId, "enrichment")
  }

  async getPersonInterests(params: {
    social_media_url: string
  }): Promise<Record<string, unknown>> {
    const postRes = await this.request("/person/interests", "POST", params as Record<string, unknown>)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    return this.waitForResult(requestId, "interests")
  }

  async searchArticles(params: {
    person_name: string
    company_name?: string
    sort?: "recent" | "relevance"
    limit?: number
  }): Promise<Record<string, unknown>> {
    const postRes = await this.request("/person/articlesearch", "POST", params as Record<string, unknown>)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    return this.waitForResult(requestId, "articlesearch")
  }

  async deepResearch(params: {
    email?: string
    phone?: string
    social_media_url?: string | string[]
    name?: string
    company?: string
    city?: string
  }): Promise<Record<string, unknown>> {
    const postRes = await this.request("/person/deep-research", "POST", params as Record<string, unknown>)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    // Deep research takes 2-5 minutes, use 5s interval and up to 120 attempts (10 min max)
    return this.waitForResult(requestId, "deep-research", {
      intervalMs: 5000,
      maxAttempts: 120,
    })
  }

  async competitorEngagements(params: {
    linkedin_urls: string[]
    max_items?: number
  }): Promise<Record<string, unknown>> {
    const postRes = await this.request("/person/competitor-engagements", "POST", params as Record<string, unknown>)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    return this.waitForResult(requestId, "competitor-engagements")
  }

  async getInteractions(params: {
    type: "replies" | "followers" | "following" | "followers,following"
    social_media_url: string
    max_results?: number
  }): Promise<Record<string, unknown>> {
    const postRes = await this.request("/person/interactions", "POST", params as Record<string, unknown>)
    const requestId = (postRes.data as Record<string, unknown>)?.request_id as string

    if (!requestId) return postRes

    return this.waitForResult(requestId, "interactions")
  }

  async getUsage(params?: { month?: number; year?: number }): Promise<Record<string, unknown>> {
    const queryParts: string[] = []
    if (params?.month) queryParts.push(`month=${params.month}`)
    if (params?.year) queryParts.push(`year=${params.year}`)
    const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : ""

    return this.request(`/usage${query}`, "GET")
  }
}
