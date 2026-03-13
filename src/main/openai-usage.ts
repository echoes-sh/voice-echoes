import https from 'https'
import { readSettings } from './settings'

interface CostsBucket {
  amount?: { value?: number; currency?: string }
  line_item?: string
}

interface OrganizationCostsResponse {
  object?: string
  data?: CostsBucket[]
}

interface CreditGrantsResponse {
  total_granted?: number
  total_used?: number
  total_available?: number
}

export interface OpenAIUsageSnapshot {
  monthUsageUsd: number | null
  creditRemainingUsd: number | null
  periodStart: string
  periodEnd: string
  fetchedAt: string
  error?: string
}

export async function fetchOpenAIUsage(apiKeyOverride?: string): Promise<OpenAIUsageSnapshot> {
  const apiKey = (apiKeyOverride ?? readSettings().apiKey).trim()
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEndExclusive = addDaysUtc(now, 1)

  const startDate = formatUtcDate(periodStart)
  const endDate = formatUtcDate(now)

  if (!apiKey) {
    return {
      monthUsageUsd: null,
      creditRemainingUsd: null,
      periodStart: startDate,
      periodEnd: endDate,
      fetchedAt: now.toISOString(),
      error: 'Add an OpenAI API key to view usage.'
    }
  }

  const startTime = Math.floor(periodStart.getTime() / 1000)
  const endTime = Math.floor(periodEndExclusive.getTime() / 1000)

  let monthUsageUsd: number | null = null
  let creditRemainingUsd: number | null = null
  const errors: string[] = []

  // Fetch monthly costs
  try {
    const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}`
    const data = await requestJson<OrganizationCostsResponse>(url, apiKey)
    monthUsageUsd = (data.data ?? []).reduce((sum, bucket) => {
      return sum + (typeof bucket.amount?.value === 'number' ? bucket.amount.value : 0)
    }, 0)
  } catch (err) {
    errors.push((err as Error).message)
  }

  // Fetch credit balance
  try {
    const credits = await requestJson<CreditGrantsResponse>(
      'https://api.openai.com/dashboard/billing/credit_grants',
      apiKey,
      {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://platform.openai.com',
        'Referer': 'https://platform.openai.com/'
      }
    )
    if (typeof credits.total_available === 'number') {
      creditRemainingUsd = credits.total_available
    }
  } catch (err) {
    console.log('[usage] credit_grants failed:', (err as Error).message)
  }

  return {
    monthUsageUsd,
    creditRemainingUsd,
    periodStart: startDate,
    periodEnd: endDate,
    fetchedAt: now.toISOString(),
    error: errors.length > 0 ? errors.join('; ') : undefined
  }
}

async function requestJson<T>(url: string, apiKey: string, extraHeaders?: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...extraHeaders
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
    // fall through
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
