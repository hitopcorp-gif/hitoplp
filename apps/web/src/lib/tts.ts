import { apiFetch } from './api'

export async function generateNarration(narrationText: string, slug: string): Promise<string> {
  const resp = await apiFetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: narrationText, slug }),
  })

  if (!resp.ok) {
    console.error('TTS generation failed:', await resp.text())
    return ''
  }

  const data: { audioUrl: string } = await resp.json()
  return data.audioUrl
}
