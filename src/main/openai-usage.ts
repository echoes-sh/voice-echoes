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

export interface OpenAIUsageSnapshot {
  monthUsageUsd: number | null
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
      periodStart: startDate,
      periodEnd: endDate,
      fetchedAt: now.toISOString(),
      error: 'Add an OpenAI API key to view usage.'
    }
  }

  const startTime = Math.floor(periodStart.getTime() / 1000)
  const endTime = Math.floor(periodEndExclusive.getTime() / 1000)

  try {
    const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}`
    const data = await requestJson<OrganizationCostsResponse>(url, apiKey)

    const total = (data.data ?? []).reduce((sum, bucket) => {
      return sum + (typeof bucket.amount?.value === 'number' ? bucket.amount.value : 0)
    }, 0)

    return {
      monthUsageUsd: total,
      periodStart: startDate,
      periodEnd: endDate,
      fetchedAt: now.toISOString()
    }
  } catch (err) {
    const message = (err as Error).message
    const isPermission = message.includes('403') || message.includes('permission') || message.includes('admin')

    return {
      monthUsageUsd: null,
      periodStart: startDate,
      periodEnd: endDate,
      fetchedAt: now.toISOString(),
      error: isPermission
        ? 'Requires an admin API key. Create one at platform.openai.com/api-keys with the "Usage: Read" permission.'
        : message
    }
  }
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
