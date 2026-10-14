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
})
