import { describe, expect, it } from 'vitest'
import {
  LP_INDEX_KEY, LpIndexConflictError, LpIndexUnreadableError, parseLpIndexUpdate, updateLpIndex, type LpIndexEntry,
} from '../lp-index'
import { FakeR2Bucket } from './helpers'

function entry(slug: string, status: 'published' | 'sold' = 'published'): LpIndexEntry {
  return { slug, name: `Car ${slug}`, nameJa: '', year: 2020, price: '¥1,000,000', heroUrl: 'https://example.com/a.webp', status }
}

async function readIndex(bucket: FakeR2Bucket): Promise<Array<{ slug: string }>> {
  return JSON.parse(await bucket.objects.get(LP_INDEX_KEY)!.text())
}

describe('updateLpIndex', () => {
  it('追加は先頭へ、同じ slug は差し替え、null は外す', async () => {
    const bucket = new FakeR2Bucket()
    await bucket.put(LP_INDEX_KEY, JSON.stringify([entry('a'), entry('b')]))
    await updateLpIndex(bucket.asR2(), { slug: 'c', entry: entry('c') })
    expect((await readIndex(bucket)).map((e) => e.slug)).toEqual(['c', 'a', 'b'])
    await updateLpIndex(bucket.asR2(), { slug: 'b', entry: entry('b', 'sold') })
    expect((await readIndex(bucket)).map((e) => e.slug)).toEqual(['b', 'c', 'a'])
    const { count } = await updateLpIndex(bucket.asR2(), { slug: 'c', entry: null })
    expect(count).toBe(2)
    expect((await readIndex(bucket)).map((e) => e.slug)).toEqual(['b', 'a'])
  })

  it('読んだ直後に他の公開が入っても、どちらの車も一覧から落ちない', async () => {
    const bucket = new FakeR2Bucket()
    await bucket.put(LP_INDEX_KEY, JSON.stringify([entry('a')]))
    // 1台目の書き込み直前に、別の人が2台目を公開した状況を作る
    bucket.beforePut = async () => {
      await updateLpIndex(bucket.asR2(), { slug: 'other', entry: entry('other') })
    }
    await updateLpIndex(bucket.asR2(), { slug: 'mine', entry: entry('mine') })
    expect((await readIndex(bucket)).map((e) => e.slug).sort()).toEqual(['a', 'mine', 'other'])
  })

  it('R2 の回数制限で書けなかった時は待ってやり直す。やり直しが尽きたら「混み合い」で止める', async () => {
    const noWait = async () => {}
    const bucket = new FakeR2Bucket()
    await bucket.put(LP_INDEX_KEY, JSON.stringify([entry('a')]))
    bucket.failNextPuts = 3
    await updateLpIndex(bucket.asR2(), { slug: 'b', entry: entry('b') }, noWait)
    expect((await readIndex(bucket)).map((e) => e.slug)).toEqual(['b', 'a'])

    bucket.failNextPuts = 100
    await expect(updateLpIndex(bucket.asR2(), { slug: 'c', entry: entry('c') }, noWait)).rejects.toBeInstanceOf(LpIndexConflictError)
    expect((await readIndex(bucket)).map((e) => e.slug)).toEqual(['b', 'a'])
  })

  it('一覧が壊れて読めない時は上書きしない', async () => {
    const bucket = new FakeR2Bucket()
    await bucket.put(LP_INDEX_KEY, '{not json')
    await expect(updateLpIndex(bucket.asR2(), { slug: 'x', entry: entry('x') })).rejects.toBeInstanceOf(LpIndexUnreadableError)
    expect(await bucket.objects.get(LP_INDEX_KEY)!.text()).toBe('{not json')
  })

  it('一覧がまだ無ければ作る', async () => {
    const bucket = new FakeR2Bucket()
    await updateLpIndex(bucket.asR2(), { slug: 'x', entry: entry('x') })
    expect((await readIndex(bucket)).map((e) => e.slug)).toEqual(['x'])
  })

  it('一覧がまだ無い時に2人が同時に作っても、どちらも残る', async () => {
    const bucket = new FakeR2Bucket()
    bucket.beforePut = async () => {
      await updateLpIndex(bucket.asR2(), { slug: 'other', entry: entry('other') })
    }
    await updateLpIndex(bucket.asR2(), { slug: 'mine', entry: entry('mine') })
    expect((await readIndex(bucket)).map((e) => e.slug).sort()).toEqual(['mine', 'other'])
  })
})

describe('parseLpIndexUpdate', () => {
  it('正しい入力を受け付ける', () => {
    expect(parseLpIndexUpdate({ slug: 'a', entry: entry('a') })).toEqual({ slug: 'a', entry: entry('a') })
    expect(parseLpIndexUpdate({ slug: 'a', entry: null })).toEqual({ slug: 'a', entry: null })
    expect(parseLpIndexUpdate({ slug: 'a', entry: { ...entry('a'), heroUrl: '' } })).not.toBeTypeOf('string')
  })

  it('形が違う入力は理由を返す', () => {
    expect(parseLpIndexUpdate({ slug: 'A B', entry: null })).toBeTypeOf('string')
    expect(parseLpIndexUpdate({ slug: 'a', entry: entry('b') })).toBeTypeOf('string')
    expect(parseLpIndexUpdate({ slug: 'a', entry: { ...entry('a'), status: 'draft' } })).toBeTypeOf('string')
    expect(parseLpIndexUpdate({ slug: 'a', entry: { ...entry('a'), heroUrl: 'javascript:alert(1)' } })).toBeTypeOf('string')
    expect(parseLpIndexUpdate({ slug: 'a', entry: { ...entry('a'), year: '2020' } })).toBeTypeOf('string')
    expect(parseLpIndexUpdate({ slug: 'a' })).toBeTypeOf('string')
    expect(parseLpIndexUpdate(null)).toBeTypeOf('string')
  })
})
