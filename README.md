# OpenClaw Nyne Plugin

OpenClaw plugin for [Nyne](https://nyne.ai) — People intelligence for your AI agents.

Give your OpenClaw agent the ability to enrich profiles, search for people, analyze psychographics, discover press mentions, run deep research, track competitor engagements, and pull social interactions — all through natural language.

## Installation

```bash
openclaw plugins install @nyne/openclaw-nyne
```

## Quick Start

Run the interactive setup wizard:

```bash
openclaw openclaw-nyne setup
```

The wizard will:
1. Prompt for your Nyne API key and secret (from [nyne.ai](https://nyne.ai))
2. Verify credentials against the API
3. Write config to `~/.openclaw/openclaw.json` and secrets to `~/.openclaw/.env`

That's it — your agent now has access to all Nyne tools.

## Manual Configuration

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "openclaw-nyne": {
      "apiKey": "${NYNE_API_KEY}",
      "apiSecret": "${NYNE_API_SECRET}"
    }
  }
}
```

Set environment variables in `~/.openclaw/.env`:

```bash
NYNE_API_KEY=your-api-key
NYNE_API_SECRET=your-api-secret
```

## AI Tools

The plugin registers 7 tools that the AI agent can use autonomously:

### `nyne_enrich_person`

Enrich a person's profile with contact info, career history, education, social profiles, and social media posts.

```
"Enrich john@acme.com"
"Look up the LinkedIn profile linkedin.com/in/johndoe"
"Get me contact info for +1-555-123-4567"
```

**Parameters:** `email`, `linkedin_url`, `phone`, `social_media_url`, `name`, `company`, `city`, `newsfeed`, `lite_enrich`, `ai_enhanced_search`, `probability_score`

### `nyne_search_people`

Search for people using natural language queries.

```
"Find VP of Sales at fintech startups in New York"
"Search for ML engineers at Google with startup experience"
```

**Parameters:** `query` (required), `limit`, `show_emails`, `show_phone_numbers`, `insights`, `profile_scoring`, `type` (light/medium/premium), `custom_filters`

### `nyne_deep_research`

Run comprehensive deep research on a person. Combines enrichment, social following analysis, article discovery, and generates a 13-section AI intelligence dossier. Takes 2-5 minutes. Costs 100 credits.

```
"Run deep research on michael@nyne.ai"
"Deep research the CEO of Stripe"
```

**Parameters:** `email`, `phone`, `social_media_url`, `name` (requires `company` or `city`)

### `nyne_person_interests`

Psychographic analysis from social media — archetypes, interest graph, brand affinities, values, cultural DNA. Works best with Twitter or Instagram URLs.

```
"Analyze interests for twitter.com/elonmusk"
```

**Parameters:** `social_media_url` (required)

### `nyne_article_search`

Find articles, press mentions, podcasts, interviews, and thought leadership content about a person.

```
"Find press mentions of Sam Altman at OpenAI"
```

**Parameters:** `person_name` (required), `company_name`, `sort` (recent/relevance), `limit`

### `nyne_competitor_engagements`

Analyze LinkedIn engagement activity — comments and reactions on posts. Useful for lead generation and competitive intelligence. Up to 50 profiles per request.

```
"Show me what linkedin.com/in/johndoe has been engaging with"
```

**Parameters:** `linkedin_urls` (required, array), `max_items`

### `nyne_interactions`

Get social media followers, following lists, or tweet replies. Works with Twitter/X and Instagram.

```
"Who does @elonmusk follow on Twitter?"
"Get replies to this tweet: twitter.com/elonmusk/status/123"
```

**Parameters:** `type` (replies/followers/following), `social_media_url` (required), `max_results`

## Slash Commands

### `/enrich <email, URL, or phone>`

Quick person enrichment.

```
/enrich michael@nyne.ai
/enrich linkedin.com/in/michaelfanous1
```

### `/search <query>`

Natural language people search.

```
/search CTO at AI startups in San Francisco
/search senior engineers at Stripe
```

### `/lookup <social URL>`

Full lookup — runs enrichment and psychographic analysis in parallel.

```
/lookup twitter.com/elonmusk
/lookup instagram.com/zuck
```

## CLI Commands

### `openclaw openclaw-nyne setup`

Interactive setup wizard for API credentials.

### `openclaw openclaw-nyne status`

Check configuration and API connectivity.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | `${NYNE_API_KEY}` | Nyne API key |
| `apiSecret` | string | `${NYNE_API_SECRET}` | Nyne API secret |
| `debug` | boolean | `false` | Enable verbose debug logging |
| `defaultPollTimeout` | number | `60` | Max seconds to wait for async results |

## Testing

Run the smoke test to verify your credentials and API connectivity:

```bash
npx tsx test.ts
```

This tests enrichment and search without needing OpenClaw installed.

## Credit Costs

| Endpoint | Credits |
|----------|---------|
| Person Enrichment | 6 per match (3 for lite) |
| Person Search (light) | 1 per result |
| Person Search (premium) | 5 per result |
| Search + Emails | +2 per result |
| Search + Phones | +14 per result |
| Newsfeed add-on | +6 when data found |
| Deep Research | 100 per request |
| Competitor Engagements | 5 per engagement found |
| Interactions | 3 per lookup |

## Rate Limits

| Endpoint | Per Minute | Per Hour |
|----------|-----------|----------|
| Enrichment | 60 | 1,000 |
| Search | 60 | 1,000 |
| Deep Research | 10 | 100 |
| Competitor Engagements | 60 | 1,000 |
| Interactions | 60 | 1,000 |

## License

MIT
