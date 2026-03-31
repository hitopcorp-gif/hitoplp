export async function generateNarration(narrationText: string, slug: string): Promise<string> {
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const resp = await fetch(`${API_BASE}/api/tts`, {
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
