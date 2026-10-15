import { useMemo, useRef, useState } from 'react'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { useSvgDrag, type Point } from '@/figure/useSvgDrag'
import ResetButton from '@/figure/ResetButton'

/**
 * 表紙の 2 つの曲面(SVG・visx)。斜めから見た網目の曲面と、その下の定義域の平面。
 *   - graph: 母関数 f(x, y) = x²/2 + y³/3 のグラフ。黒の線は y = 0 の切り口と、平面上のその位置
 *   - dual:  f のルジャンドル変換 f*(p, q) = p²/2 ± (2/3) q^{3/2}(q ≥ 0)。p = x, q = y² なので y = ±√q の
 *            2 枚の枝になり、q = 0(赤の線)で尖った辺をなして繋がる。平面は定義域 q ≥ 0(緑)と、
 *            対応する点の無い q < 0(金)に分かれる。黒の線は p = 0 の切り口
 * ドラッグ(と矢印キー)で見る向きを変えられる。右上のボタンで初めの向きに戻す。
 * 網目の四角形を見る向きに投影し、奥から順に塗る(画家のアルゴリズム)。陰影は面の向きから付ける。
 * 色はすべてトークンから(style.css の .figure-surface-*)。
 */
type Vec = [number, number, number]
type Face = { pts: Vec[]; className: string; shade?: boolean }
type Curve = { pts: Vec[]; className: string }

const N = 20 // 網目の分割数
const PLANE_GAP = 0.5 // 曲面の最も低い所から平面までの距離
const INITIAL = { azimuth: -0.6, elevation: 0.55 }
const LIGHT: Vec = normalize([-0.4, -0.5, 1])

function normalize([x, y, z]: Vec): Vec {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)

/** 曲面 z = h(u, v) の網目 */
function sheet(h: (u: number, v: number) => number, [u0, u1]: [number, number], [v0, v1]: [number, number], n = N): Face[] {
  const us = range(u0, u1, n)
  const vs = range(v0, v1, n)
  const faces: Face[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const corners: [number, number][] = [[us[i], vs[j]], [us[i + 1], vs[j]], [us[i + 1], vs[j + 1]], [us[i], vs[j + 1]]]
      faces.push({ pts: corners.map(([u, v]) => [u, v, h(u, v)]), className: 'figure-surface-sheet', shade: true })
    }
  }
  return faces
}
/** 平面 z = z0 の長方形(定義域の色分けに使う) */
const rect = ([u0, u1]: [number, number], [v0, v1]: [number, number], z0: number, className: string): Face => ({
  pts: [[u0, v0, z0], [u1, v0, z0], [u1, v1, z0], [u0, v1, z0]],
  className,
})
/** 曲線 (u(t), v(t), z(t)) */
const curve = (f: (t: number) => Vec, [t0, t1]: [number, number], className: string, n = 2 * N): Curve => ({
  pts: range(t0, t1, n).map(f),
  className,
})

const f = (x: number, y: number) => (x * x) / 2 + (y * y * y) / 3
const dual = (sign: 1 | -1) => (p: number, q: number) => (p * p) / 2 + sign * (2 / 3) * Math.pow(Math.max(q, 0), 1.5)

function scene(kind: 'graph' | 'dual'): { faces: Face[]; curves: Curve[] } {
  if (kind === 'graph') {
    const z0 = -1 / 3 - PLANE_GAP
    return {
      faces: [rect([-1, 1], [-1, 1], z0, 'figure-surface-domain'), ...sheet(f, [-1, 1], [-1, 1])],
      curves: [
        curve((t) => [t, 0, f(t, 0)], [-1, 1], 'figure-surface-cut'),
        curve((t) => [t, 0, z0], [-1, 1], 'figure-surface-cut'),
      ],
    }
  }
  const z0 = -2 / 3 - PLANE_GAP
  return {
    faces: [
      rect([-1, 1], [0, 1], z0, 'figure-surface-domain'),
      rect([-1, 1], [-1, 0], z0, 'figure-surface-outside'),
      ...sheet(dual(1), [-1, 1], [0, 1]),
      ...sheet(dual(-1), [-1, 1], [0, 1]),
    ],
    curves: [
      curve((t) => [0, t, dual(1)(0, t)], [0, 1], 'figure-surface-cut'),
      curve((t) => [0, t, dual(-1)(0, t)], [0, 1], 'figure-surface-cut'),
      curve((t) => [0, t, z0], [0, 1], 'figure-surface-cut'),
      curve((t) => [t, 0, dual(1)(t, 0)], [-1, 1], 'figure-surface-edge'),
      curve((t) => [t, 0, z0], [-1, 1], 'figure-surface-edge'),
    ],
  }
}

export default function Surface({ kind, size = 300 }: { kind: 'graph' | 'dual'; size?: number }) {
  const [view, setView] = useState(INITIAL)
  const dragging = useRef<{ start: Point; view: typeof INITIAL } | null>(null)
  const { faces, curves } = useMemo(() => scene(kind), [kind])
  // どの向きから見ても箱に収まるよう、全体を囲む球(中心と半径)から縮尺を決める(向きを変えても大きさは変わらない)
  const bounds = useMemo(() => {
    const all = [...faces.flatMap((f) => f.pts), ...curves.flatMap((c) => c.pts)]
    const mid = (k: 0 | 1 | 2) => (Math.min(...all.map((p) => p[k])) + Math.max(...all.map((p) => p[k]))) / 2
    const center: Vec = [mid(0), mid(1), mid(2)]
    const radius = Math.max(...all.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])))
    return { center, radius }
  }, [faces, curves])

  const bind = useSvgDrag((_, point, start) => {
    if (dragging.current?.start !== start) dragging.current = { start, view }
    const base = dragging.current.view
    const elevation = Math.min(1.4, Math.max(0.05, base.elevation + (point.y - start.y) * 0.01))
    setView({ azimuth: base.azimuth + (point.x - start.x) * 0.01, elevation })
  })

  // 見る向き: z 軸のまわりに azimuth 回し、elevation だけ上から見下ろす。画面の x・y と、手前ほど大きい奥行き
  const { azimuth, elevation } = view
  const project = ([px, py, pz]: Vec) => {
    const [x, y, z] = [px - bounds.center[0], py - bounds.center[1], pz - bounds.center[2]]
    const u = x * Math.cos(azimuth) - y * Math.sin(azimuth)
    const w = x * Math.sin(azimuth) + y * Math.cos(azimuth)
    return {
      x: u,
      y: -(z * Math.cos(elevation) + w * Math.sin(elevation)),
      depth: -w * Math.cos(elevation) + z * Math.sin(elevation),
    }
  }
  const scale = (size / 2) * 0.96 / bounds.radius
  const toScreen = (p: Vec): [number, number] => {
    const q = project(p)
    return [size / 2 + q.x * scale, size / 2 + q.y * scale]
  }

  const drawn = faces
    .map((face) => {
      const depth = face.pts.reduce((s, p) => s + project(p).depth, 0) / face.pts.length
      let light = 1
      if (face.shade) {
        const [a, b, c] = face.pts
        const n = normalize([
          (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
          (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
          (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        ])
        light = 0.55 + 0.45 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])
      }
      return { face, depth, light }
    })
    .sort((a, b) => a.depth - b.depth)

  const handlers = bind('surface', kind === 'graph' ? '母関数のグラフ(ドラッグ・矢印キーで向きを変える)' : 'ルジャンドル変換の曲面(ドラッグ・矢印キーで向きを変える)')

  return (
    <div className="figure-block">
      <svg className="figure figure-surface" viewBox={`0 0 ${size} ${size}`} width={size} height={size} {...handlers} tabIndex={0}>
        <Group>
          {drawn.map(({ face, light }, i) => (
            <polygon
              key={i}
              className={face.className}
              points={face.pts.map((p) => toScreen(p).join(',')).join(' ')}
              style={face.shade ? { fill: `color-mix(in oklab, var(--figure-surface) ${Math.round(light * 100)}%, black)` } : undefined}
            />
          ))}
          {curves.map((c, i) => (
            <LinePath key={i} className={c.className} data={c.pts.map(toScreen)} x={(d) => d[0]} y={(d) => d[1]} />
          ))}
        </Group>
      </svg>
      <div className="figure-buttons">
        <ResetButton onClick={() => setView(INITIAL)} />
      </div>
    </div>
  )
}
