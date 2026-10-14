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

/**
 * zoom の形(Prezi のように、大きな面の上で寄ったり引いたりする): 節の最初のスライド(---)を大きな枠として横に並べ
 * (一つおきに少し上下にずらす)、節の中の続き(--)を、その枠の下半分(ZOOM_AREA)に縮めて並べる。
 * 続きへ進むとカメラが枠の中へ寄り、次の節へは引いてから移る。節の最初のスライドを題と一言だけにしておくと、
 * 枠の下半分が空き、続きと重ならない
 */
/** 節の枠どうしの間(枠の幅・高さに対する割合)と、一つおきの上下のずれ(高さに対する割合) */
const ZOOM_SECTION_GAP = 0.35
const ZOOM_SECTION_SHIFT = 0.45
/** 続きを並べる範囲(枠の中の位置。幅・高さに対する割合。中心が原点で、y は下向き)と、続きどうしの間・一列の数・最大の倍率 */
const ZOOM_AREA = { left: -0.45, right: 0.45, top: -0.02, bottom: 0.46 }
const ZOOM_TILE_GAP = 0.03
const ZOOM_COLUMNS = 3
const ZOOM_MAX_SCALE = 0.3

function zoom(slides: SlideKey[], size: Size): Place[] {
  const { width: w, height: h } = size
  // 節(h)ごとの枠の中心
  const sectionCenter = (index: number) => ({
    x: index * w * (1 + ZOOM_SECTION_GAP),
    y: (index % 2 === 0 ? -1 : 1) * h * ZOOM_SECTION_SHIFT * (index === 0 ? 0 : 1),
  })
  const continuations = new Map<number, number>()
  for (const s of slides) if (s.v > 0) continuations.set(s.h, Math.max(continuations.get(s.h) ?? 0, s.v))
  return slides.map(({ h: section, v }) => {
    const c = sectionCenter(section)
    if (v === 0) return { ...origin(), ...c }
    // 続き: 枠の下半分に、一列 ZOOM_COLUMNS 枚まで並べる(収まる最大の倍率で、ZOOM_MAX_SCALE まで)
    const count = continuations.get(section)!
    const cols = Math.min(count, ZOOM_COLUMNS)
    const rows = Math.ceil(count / cols)
    const areaW = (ZOOM_AREA.right - ZOOM_AREA.left) * w
    const areaH = (ZOOM_AREA.bottom - ZOOM_AREA.top) * h
    const gap = ZOOM_TILE_GAP * w
    const scale = Math.min(ZOOM_MAX_SCALE, (areaW - (cols - 1) * gap) / (cols * w), (areaH - (rows - 1) * gap) / (rows * h))
    const i = v - 1
    const row = Math.floor(i / cols)
    const inRow = row === rows - 1 ? count - row * cols : cols // 最後の列は残りの数だけで中央に寄せる
    const col = i - row * cols
    const tileW = w * scale
    const tileH = h * scale
    const rowWidth = inRow * tileW + (inRow - 1) * gap
    const areaTop = c.y + ZOOM_AREA.top * h
    const blockHeight = rows * tileH + (rows - 1) * gap
    return {
      ...origin(),
      x: c.x - rowWidth / 2 + tileW / 2 + col * (tileW + gap),
      y: areaTop + (areaH - blockHeight) / 2 + tileH / 2 + row * (tileH + gap),
      scale,
    }
  })
}

const LAYOUTS = { grid, spiral, zoom }

/** 全スライドの置き場所(slides と同じ順)。size はスライドの大きさ */
export function placeSlides(slides: SlideKey[], size: Size, motion: ImpressMotion = {}): Place[] {
  const placed = LAYOUTS[motion.layout ?? 'grid'](slides, size)
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
