import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import type { ImpressMotion, ImpressPlace } from '../motion'

/**
 * impress モードのスライドの置き場所を決める(デッキの動きの設定 motion.ts の impress)。
 * 全体の並べ方(layout)で全スライドを置き、ラベルで指したスライド(positions)は書いた項目だけ置き直す。
 */

/** 置き場所(impress の step の data-x などに書く値) */
export type Place = Required<ImpressPlace>

/** 並べるスライド。h・v は並び(横の位置と、縦の続きの中の位置)、id は題の \label */
export type SlideKey = { h: number; v: number; id?: string }

/** grid の間隔(論理座標の px)。横の並び(h)は右へ、縦の続き(v)は下へ */
export const GAP = { x: 1200, y: 900 }

/**
 * spiral の形: 原点のまわりを時計回りに外へ広がるアルキメデスの螺旋(半径 = SPIRAL_RING / 2π × 角度)に沿って、
 * 文書の順に SPIRAL_STEP ずつ置く。スライドは螺旋の進む向きに傾ける(カメラも一緒に回るので、読むときはまっすぐに見える)。
 * 隣の周との間隔(SPIRAL_RING)はスライドの対角線より広くし、どう傾いても周どうしが重ならないようにする
 */
const SPIRAL_RING = 1500
const SPIRAL_STEP = MIN_WIDTH + 300
/** 最初のスライドの角度(1 周。これより内側では周が小さく、隣のスライドとの間が対角線より狭くなる) */
const SPIRAL_START = 2 * Math.PI

const origin = (): Place => ({ x: 0, y: 0, z: 0, rotate: 0, rotateX: 0, rotateY: 0, scale: 1 })

function grid(slides: SlideKey[]): Place[] {
  return slides.map(({ h, v }) => ({ ...origin(), x: h * GAP.x, y: v * GAP.y }))
}

function spiral(slides: SlideKey[]): Place[] {
  const c = SPIRAL_RING / (2 * Math.PI)
  let theta = SPIRAL_START
  return slides.map(() => {
    const r = c * theta
    // 螺旋の進む向き(角度で微分した向き)
    const dx = c * Math.cos(theta) - r * Math.sin(theta)
    const dy = c * Math.sin(theta) + r * Math.cos(theta)
    const place = { ...origin(), x: r * Math.cos(theta), y: r * Math.sin(theta), rotate: (Math.atan2(dy, dx) * 180) / Math.PI }
    // 次のスライドまでの弧の長さが SPIRAL_STEP になる角度だけ進む(弧の長さ ≈ √(r² + c²) × 角度の増分)
    theta += SPIRAL_STEP / Math.hypot(r, c)
    return place
  })
}

/** 全スライドの置き場所(slides と同じ順) */
export function placeSlides(slides: SlideKey[], motion: ImpressMotion = {}): Place[] {
  const placed = (motion.layout === 'spiral' ? spiral : grid)(slides)
  return placed.map((place, i) => {
    const id = slides[i].id
    return id && motion.positions?.[id] ? { ...place, ...motion.positions[id] } : place
  })
}

/**
 * 全体を見渡す置き場所: 全スライドの範囲の中央に置き、範囲が画面に収まる倍率にする。
 * スライドはどの向きに傾いていてもよいように、中心から対角線の半分(× そのスライドの倍率)の円で範囲を測る
 */
export function overviewOf(places: Place[]): Place {
  const half = Math.hypot(MIN_WIDTH, SLIDE_HEIGHT) / 2
  const minX = Math.min(...places.map((p) => p.x - half * p.scale))
  const maxX = Math.max(...places.map((p) => p.x + half * p.scale))
  const minY = Math.min(...places.map((p) => p.y - half * p.scale))
  const maxY = Math.max(...places.map((p) => p.y + half * p.scale))
  return { ...origin(), x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: 1.05 * Math.max((maxX - minX) / MIN_WIDTH, (maxY - minY) / SLIDE_HEIGHT) }
}

/** 置き場所を impress の step の data 属性に書く */
export function applyPlace(step: HTMLElement, place: Place) {
  Object.assign(step.dataset, {
    x: String(place.x),
    y: String(place.y),
    z: String(place.z),
    rotate: String(place.rotate),
    rotateX: String(place.rotateX),
    rotateY: String(place.rotateY),
    scale: String(place.scale),
  })
}
