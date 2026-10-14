import { describe, expect, it } from 'vitest'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { GAP, overviewOf, placeSlides } from './layout'

// 表紙・節 1(続き 1 枚)・節 2(題に \label{sec:main})
const slides = [{ h: 0, v: 0 }, { h: 1, v: 0 }, { h: 1, v: 1 }, { h: 2, v: 0, id: 'sec:main' }]

describe('impress の置き方(motion.ts の impress)', () => {
  it('既定(grid)は横の並びを右へ、縦の続きを下へ', () => {
    expect(placeSlides(slides).map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [GAP.x, 0],
      [GAP.x, GAP.y],
      [2 * GAP.x, 0],
    ])
  })

  it('positions はラベルのスライドの、書いた項目だけを置き換える', () => {
    const places = placeSlides(slides, { positions: { 'sec:main': { z: -1500, scale: 2 } } })
    expect(places[3]).toMatchObject({ x: 2 * GAP.x, y: 0, z: -1500, scale: 2 })
    expect(places[0]).toMatchObject({ z: 0, scale: 1 })
  })

  it('spiral はどのスライドも重ならない(中心どうしが対角線より離れている)', () => {
    const many = Array.from({ length: 60 }, (_, h) => ({ h, v: 0 }))
    const places = placeSlides(many, { layout: 'spiral' })
    const diagonal = Math.hypot(MIN_WIDTH, SLIDE_HEIGHT)
    for (let i = 0; i < places.length; i++) {
      for (let j = i + 1; j < places.length; j++) {
        expect(Math.hypot(places[i].x - places[j].x, places[i].y - places[j].y)).toBeGreaterThan(diagonal)
      }
    }
  })

  it('全体を見渡す置き場所は、全スライドを収める', () => {
    const places = placeSlides(slides, { layout: 'spiral' })
    const o = overviewOf(places)
    const half = Math.hypot(MIN_WIDTH, SLIDE_HEIGHT) / 2
    for (const p of places) {
      expect(Math.abs(p.x - o.x) + half).toBeLessThanOrEqual((o.scale * MIN_WIDTH) / 2)
      expect(Math.abs(p.y - o.y) + half).toBeLessThanOrEqual((o.scale * SLIDE_HEIGHT) / 2)
    }
  })
})
