import { describe, expect, it } from 'vitest'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { GAP_MARGIN, overviewOf, placeSlides } from './layout'

// 表紙・節 1(続き 1 枚)・節 2(題に \label{sec:main})
const slides = [{ h: 0, v: 0 }, { h: 1, v: 0 }, { h: 1, v: 1 }, { h: 2, v: 0, id: 'sec:main' }]
// スライドの大きさ: 最小サイズ(4:3)・16:9 の窓・縦長の窓
const sizes = [
  { width: MIN_WIDTH, height: SLIDE_HEIGHT },
  { width: Math.round((SLIDE_HEIGHT * 16) / 9), height: SLIDE_HEIGHT },
  { width: MIN_WIDTH, height: 1400 },
]
const size = sizes[1]
const GAP = { x: size.width + GAP_MARGIN.x, y: size.height + GAP_MARGIN.y }

describe('impress の置き方(motion.ts の impress)', () => {
  it('既定(grid)は横の並びを右へ、縦の続きを下へ', () => {
    expect(placeSlides(slides, size).map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [GAP.x, 0],
      [GAP.x, GAP.y],
      [2 * GAP.x, 0],
    ])
  })

  it('positions はラベルのスライドの、書いた項目だけを置き換える', () => {
    const places = placeSlides(slides, size, { positions: { 'sec:main': { z: -1500, scale: 2 } } })
    expect(places[3]).toMatchObject({ x: 2 * GAP.x, y: 0, z: -1500, scale: 2 })
    expect(places[0]).toMatchObject({ z: 0, scale: 1 })
  })

  it.each(sizes)('spiral はどのスライドも重ならない(中心どうしが対角線より離れている。$width×$height)', (size) => {
    const many = Array.from({ length: 60 }, (_, h) => ({ h, v: 0 }))
    const places = placeSlides(many, size, { layout: 'spiral' })
    const diagonal = Math.hypot(size.width, size.height)
    for (let i = 0; i < places.length; i++) {
      for (let j = i + 1; j < places.length; j++) {
        expect(Math.hypot(places[i].x - places[j].x, places[i].y - places[j].y)).toBeGreaterThan(diagonal)
      }
    }
  })

  it.each(sizes)('全体を見渡す置き場所は、全スライドを収める($width×$height)', (size) => {
    const places = placeSlides(slides, size, { layout: 'spiral' })
    const o = overviewOf(places, size)
    const half = Math.hypot(size.width, size.height) / 2
    for (const p of places) {
      expect(Math.abs(p.x - o.x) + half).toBeLessThanOrEqual((o.scale * size.width) / 2)
      expect(Math.abs(p.y - o.y) + half).toBeLessThanOrEqual((o.scale * size.height) / 2)
    }
  })

  it.each(sizes)('zoom は続きを節の枠の下半分に、重ならずに並べ、節の枠どうしも重ならない($width×$height)', (size) => {
    // 節 0(続きなし)・節 1(続き 3 枚)・節 2(続き 5 枚。2 列になる)・節 3(続き 1 枚)
    const deck = [
      { h: 0, v: 0 },
      ...[0, 1, 2, 3].map((v) => ({ h: 1, v })),
      ...[0, 1, 2, 3, 4, 5].map((v) => ({ h: 2, v })),
      { h: 3, v: 0 },
      { h: 3, v: 1 },
    ]
    const places = placeSlides(deck, size, { layout: 'zoom' })
    const box = (i: number) => {
      const p = places[i]
      return { left: p.x - (size.width * p.scale) / 2, right: p.x + (size.width * p.scale) / 2, top: p.y - (size.height * p.scale) / 2, bottom: p.y + (size.height * p.scale) / 2 }
    }
    const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    const sections = deck.map((s, i) => [s, i] as const).filter(([s]) => s.v === 0)
    for (const [, i] of sections) for (const [, j] of sections) if (i < j) expect(overlaps(box(i), box(j))).toBe(false)
    for (const [section, i] of sections) {
      const frame = box(i)
      const tiles = deck.map((s, k) => [s, k] as const).filter(([s]) => s.h === section.h && s.v > 0).map(([, k]) => k)
      for (const k of tiles) {
        const t = box(k)
        expect(places[k].scale).toBeLessThan(1)
        // 枠の下半分(題と一言の下)に収まる
        expect(t.left).toBeGreaterThanOrEqual(frame.left)
        expect(t.right).toBeLessThanOrEqual(frame.right)
        expect(t.top).toBeGreaterThanOrEqual(places[i].y - size.height * 0.05)
        expect(t.bottom).toBeLessThanOrEqual(frame.bottom)
        for (const m of tiles) if (k < m) expect(overlaps(t, box(m))).toBe(false)
      }
    }
  })
})
