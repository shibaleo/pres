import type { ImpressMotion, ImpressPlace } from '../motion'

/**
 * impress モードのスライドの置き場所を決める(デッキの動きの設定 motion.ts の impress)。
 * 全体の並べ方(layout)で全スライドを置き、ラベルで指したスライド(positions)は書いた項目だけ置き直す。
 * スライドの大きさは窓と同じ縦横比(deck/view-size.ts)なので、間隔もその大きさから決める。
 */

/** スライドの大きさ(論理座標の px) */
export type Size = { width: number; height: number }

/** 置き場所(impress の step の data-x などに書く値) */
export type Place = Required<ImpressPlace>

/** 並べるスライド。h・v は並び(横の位置と、縦の続きの中の位置)、id は題の \label */
export type SlideKey = { h: number; v: number; id?: string }

/** grid の間隔: スライドの大きさにこの分を足す(横の並び(h)は右へ、縦の続き(v)は下へ) */
export const GAP_MARGIN = { x: 270, y: 200 }

/**
 * spiral の形: 原点のまわりを時計回りに外へ広がるアルキメデスの螺旋(半径 = 周の間隔 / 2π × 角度)に沿って、
 * 文書の順に置く。スライドは螺旋の進む向きに傾ける(カメラも一緒に回るので、読むときはまっすぐに見える)。
 * 隣の周との間隔と、隣のスライドまでの弧の長さはスライドの対角線より広くし、どう傾いても重ならないようにする
 */
const SPIRAL_RING_MARGIN = 330
const SPIRAL_STEP_MARGIN = 100
/** 最初のスライドの角度(1 周。これより内側では周が小さく、隣のスライドとの間が対角線より狭くなる) */
const SPIRAL_START = 2 * Math.PI

const diagonal = ({ width, height }: Size) => Math.hypot(width, height)

const origin = (): Place => ({ x: 0, y: 0, z: 0, rotate: 0, rotateX: 0, rotateY: 0, scale: 1 })

function grid(slides: SlideKey[], size: Size): Place[] {
  const gap = { x: size.width + GAP_MARGIN.x, y: size.height + GAP_MARGIN.y }
  return slides.map(({ h, v }) => ({ ...origin(), x: h * gap.x, y: v * gap.y }))
}

function spiral(slides: SlideKey[], size: Size): Place[] {
  const step = diagonal(size) + SPIRAL_STEP_MARGIN
  const c = (diagonal(size) + SPIRAL_RING_MARGIN) / (2 * Math.PI)
  let theta = SPIRAL_START
  return slides.map(() => {
    const r = c * theta
    // 螺旋の進む向き(角度で微分した向き)
    const dx = c * Math.cos(theta) - r * Math.sin(theta)
    const dy = c * Math.sin(theta) + r * Math.cos(theta)
    const place = { ...origin(), x: r * Math.cos(theta), y: r * Math.sin(theta), rotate: (Math.atan2(dy, dx) * 180) / Math.PI }
    // 次のスライドまでの弧の長さが step になる角度だけ進む(弧の長さ ≈ √(r² + c²) × 角度の増分)
    theta += step / Math.hypot(r, c)
    return place
  })
}

/** 全スライドの置き場所(slides と同じ順)。size はスライドの大きさ */
export function placeSlides(slides: SlideKey[], size: Size, motion: ImpressMotion = {}): Place[] {
  const placed = (motion.layout === 'spiral' ? spiral : grid)(slides, size)
  return placed.map((place, i) => {
    const id = slides[i].id
    return id && motion.positions?.[id] ? { ...place, ...motion.positions[id] } : place
  })
}

/**
 * 全体を見渡す置き場所: 全スライドの範囲の中央に置き、範囲が画面に収まる倍率にする。
 * スライドはどの向きに傾いていてもよいように、中心から対角線の半分(× そのスライドの倍率)の円で範囲を測る
 */
export function overviewOf(places: Place[], size: Size): Place {
  const half = diagonal(size) / 2
  const minX = Math.min(...places.map((p) => p.x - half * p.scale))
  const maxX = Math.max(...places.map((p) => p.x + half * p.scale))
  const minY = Math.min(...places.map((p) => p.y - half * p.scale))
  const maxY = Math.max(...places.map((p) => p.y + half * p.scale))
  return { ...origin(), x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: 1.05 * Math.max((maxX - minX) / size.width, (maxY - minY) / size.height) }
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
