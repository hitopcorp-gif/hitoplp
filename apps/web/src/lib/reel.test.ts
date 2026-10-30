import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// fal.ai の生成と Worker への保存を偽物にして、「生成は済んだが保存だけ失敗した」時の動きを見る
const subscribe = vi.fn()
const uploadObject = vi.fn()
vi.mock('@fal-ai/client', () => ({ fal: { config: vi.fn(), subscribe } }))
vi.mock('./api', () => ({ uploadObject }))

async function loadReel() {
  vi.resetModules()
  vi.stubEnv('VITE_FAL_KEY', 'test-fal-key')
  return import('./reel')
}

describe('リール生成の保存失敗からのやり直し', () => {
  beforeEach(() => {
    subscribe.mockReset()
    uploadObject.mockReset()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('縦長画像: 保存だけ失敗したら、やり直しでは生成し直さず保存から', async () => {
    const reel = await loadReel()
    subscribe.mockResolvedValue({ data: { images: [{ url: 'https://fal.example/v.png' }] } })
    uploadObject
      .mockRejectedValueOnce(new Error('アップロード失敗: 503'))
      .mockResolvedValueOnce({ key: 'sns/vertical/car.jpg', url: 'https://api/sns/vertical/car.jpg' })

    await expect(reel.generateVerticalImage('https://api/hero.webp', 'car')).rejects.toThrow('503')
    await expect(reel.generateVerticalImage('https://api/hero.webp', 'car')).resolves.toBe('https://api/sns/vertical/car.jpg')
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(uploadObject).toHaveBeenCalledTimes(2)
  })

  it('リール動画: 保存だけ失敗したら、やり直しでは生成し直さず保存から。保存できたら次は生成する', async () => {
    const reel = await loadReel()
    subscribe.mockResolvedValue({ data: { video: { url: 'https://fal.example/r.mp4' } } })
    uploadObject
      .mockRejectedValueOnce(new Error('アップロード失敗: 401'))
      .mockResolvedValue({ key: 'sns/reel/car.mp4', url: 'https://api/sns/reel/car.mp4' })

    await expect(reel.generateReelVideo('https://api/v.jpg', 'car')).rejects.toThrow('401')
    await reel.generateReelVideo('https://api/v.jpg', 'car')
    expect(subscribe).toHaveBeenCalledTimes(1)
    // 保存が済んだ後の「もう一度」は新しく生成する
    await reel.generateReelVideo('https://api/v.jpg', 'car')
    expect(subscribe).toHaveBeenCalledTimes(2)
  })

  it('作り直しを選んだら、保存できていない成果物も使わずに生成し直す', async () => {
    const reel = await loadReel()
    subscribe.mockResolvedValue({ data: { images: [{ url: 'https://fal.example/v.png' }] } })
    uploadObject.mockRejectedValueOnce(new Error('アップロード失敗: 503')).mockResolvedValue({ key: 'k', url: 'u' })

    await expect(reel.generateVerticalImage('https://api/hero.webp', 'car')).rejects.toThrow()
    reel.forgetUnsavedReelOutputs('car')
    await reel.generateVerticalImage('https://api/hero.webp', 'car')
    expect(subscribe).toHaveBeenCalledTimes(2)
  })
})
