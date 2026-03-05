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
    : 'webm'

  const blob = new Blob([buffer], { type: mimeType })
  const audioFile = await toFile(blob, `recording.${ext}`, { type: mimeType })

  const result = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: audioFile,
    language: undefined, // auto-detect French + English
    response_format: 'text'
  })

  // response_format: 'text' returns a string directly
  const text = (result as unknown as string).trim()
  return text || null
}
