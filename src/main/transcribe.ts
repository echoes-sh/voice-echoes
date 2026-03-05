import OpenAI from 'openai'
import { toFile } from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

export async function transcribeAudio(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string | null> {
  const openai = getClient()

  // Determine file extension from mimeType
  const ext = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('webm') ? 'webm'
    : mimeType.includes('wav') ? 'wav'
    : 'webm'

  const nodeBuffer = Buffer.from(buffer)
  const file = await toFile(nodeBuffer, `recording.${ext}`, { type: mimeType || 'audio/webm' })

  const result = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text'
  })

  const text = (result as unknown as string).trim()
  return text || null
}
