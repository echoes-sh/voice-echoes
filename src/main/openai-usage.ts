import https from 'https'
import { readSettings } from './settings'

interface LegacyCreditsResponse {
  total_granted?: number
  total_used?: number
  total_available?: number
}

interface LegacyUsageResponse {
  total_usage?: number
}

interface OrganizationCostsResponse {
  data?: Array<{
    amount?: {
      value?: number
    }
  }>
}

export interface OpenAIUsageSnapshot {
  creditsGrantedUsd: number | null
  creditsUsedUsd: number | null
  creditsRemainingUsd: number | null
  monthUsageUsd: number | null
  periodStart: string
  periodEnd: string
  fetchedAt: string
  error?: string
}

export async function fetchOpenAIUsage(apiKeyOverride?: string): Promise<OpenAIUsageSnapshot> {
  const apiKey = (apiKeyOverride ?? readSettings().apiKey).trim()
  const now = new Date()
  const periodStartDate = formatUtcDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const periodEndDate = formatUtcDate(now)
  const periodEndExclusive = formatUtcDate(addDaysUtc(now, 1))

  if (!apiKey) {
    return {
      creditsGrantedUsd: null,
      creditsUsedUsd: null,
      creditsRemainingUsd: null,
      monthUsageUsd: null,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      fetchedAt: now.toISOString(),
      error: 'Add an OpenAI API key to view usage.'
    }
  }

  const creditsPromise = getLegacyCredits(apiKey)
  const usagePromise = getLegacyUsage(apiKey, periodStartDate, periodEndExclusive)

  const [creditsResult, usageResult] = await Promise.allSettled([creditsPromise, usagePromise])

  const credits = creditsResult.status === 'fulfilled' ? creditsResult.value : null
  let monthUsageUsd = usageResult.status === 'fulfilled' ? usageResult.value : null

  if (monthUsageUsd === null) {
    monthUsageUsd = await getOrganizationCostsUsage(apiKey, periodStartDate, periodEndExclusive).catch(() => null)
  }

  const errorMessages: string[] = []
  if (creditsResult.status === 'rejected') errorMessages.push(creditsResult.reason.message)
  if (usageResult.status === 'rejected' && monthUsageUsd === null) errorMessages.push(usageResult.reason.message)

  return {
    creditsGrantedUsd: credits?.granted ?? null,
    creditsUsedUsd: credits?.used ?? null,
    creditsRemainingUsd: credits?.remaining ?? null,
    monthUsageUsd,
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    fetchedAt: now.toISOString(),
    error: errorMessages.length > 0 ? errorMessages.join(' ') : undefined
  }
}

async function getLegacyCredits(apiKey: string): Promise<{ granted: number; used: number; remaining: number } | null> {
  const data = await requestJson<LegacyCreditsResponse>('https://api.openai.com/v1/dashboard/billing/credit_grants', apiKey)

  if (
    typeof data.total_granted === 'number' &&
    typeof data.total_used === 'number' &&
    typeof data.total_available === 'number'
  ) {
    return {
      granted: data.total_granted,
      used: data.total_used,
      remaining: data.total_available
    }
  }

  return null
}

async function getLegacyUsage(apiKey: string, startDate: string, endDate: string): Promise<number | null> {
  const url = `https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`
  const data = await requestJson<LegacyUsageResponse>(url, apiKey)

  if (typeof data.total_usage === 'number') {
    return data.total_usage / 100
  }

  return null
}

async function getOrganizationCostsUsage(apiKey: string, startDate: string, endDate: string): Promise<number | null> {
  const startTime = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
  const endTime = Math.floor(new Date(`${endDate}T00:00:00Z`).getTime() / 1000)
  const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}`
  const data = await requestJson<OrganizationCostsResponse>(url, apiKey)

  if (!Array.isArray(data.data)) {
    return null
  }

  const total = data.data.reduce((sum, bucket) => {
    const value = bucket.amount?.value
    return sum + (typeof value === 'number' ? value : 0)
  }, 0)

  return total
}

async function requestJson<T>(url: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      },
      (res) => {
        const chunks: Buffer[] = []

        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          const statusCode = res.statusCode ?? 500

          if (statusCode < 200 || statusCode >= 300) {
            const message = extractErrorMessage(body)
            reject(new Error(`OpenAI request failed (${statusCode}): ${message}`))
            return
          }

          try {
            resolve(JSON.parse(body) as T)
          } catch {
            reject(new Error('OpenAI request returned invalid JSON.'))
          }
        })
      }
    )

    req.on('error', (err) => reject(err))
    req.end()
  })
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // Ignore parse errors and fall back to raw text
  }
  return body || 'Unknown error'
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}
