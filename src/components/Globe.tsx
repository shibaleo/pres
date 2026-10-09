import { useEffect, useMemo, useRef, useState } from 'react'
import { Orthographic } from '@visx/geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'
// world-atlas をローカルバンドル (CDN fetch を廃止 → オフラインでも描画される)
import worldData from 'world-atlas/countries-110m.json'
import { useSvgDrag, type Point } from './figure/useSvgDrag'
import ResetButton from './figure/ResetButton'
import PlayPauseButton from './figure/PlayPauseButton'
import { prefersReducedMotion, useOnPresentSlide } from './figure/motion'

/**
 * 回る地球儀(SVG・visx の正射図法)。
 *   - ゆっくり自転する。ドラッグすると向きを変えられる(ドラッグ中は自転を止める)
 *   - 右上のボタンで自転の再生・一時停止と、初期の向きへの戻し
 *   - 自転は表示中のスライドのときだけ回す。OS で動きを控える設定のときは一時停止の状態で始める
 * SVG なので拡大しても鮮明で、印刷・PDF にもそのまま残る。
 */
const world = worldData as unknown as Topology
const countries = (feature(world, world.objects.countries as GeometryCollection) as FeatureCollection<Geometry>).features

const SPEED: [number, number] = [0.5, -0.1] // 1 コマ(約 1/30 秒)あたりの回転(度)
const FRAME_MS = 33

export default function Globe({ size = 500 }: { size?: number }) {
  const [rotation, setRotation] = useState<[number, number]>([0, 0])
  // ドラッグの起点(始めたときの向き)と、ボタンを押しているか(押している間は自転を止める)。
  // 矢印キーで動かしたときも起点は記録されるので、自転を止める判定は押しているかだけで行う
  const dragging = useRef<{ start: Point; rotation: [number, number] } | null>(null)
  const pressed = useRef(false)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const block = useRef<HTMLDivElement>(null)
  const present = useOnPresentSlide(block)

  // 自転(再生中かつ表示中のスライドのとき)。ドラッグ中は止める
  useEffect(() => {
    if (!playing || !present) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (now - last >= FRAME_MS && !pressed.current) {
        last = now
        setRotation(([lon, lat]) => [lon + SPEED[0], lat + SPEED[1]])
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, present])

  const bind = useSvgDrag((_, point, start) => {
    if (dragging.current?.start !== start) dragging.current = { start, rotation }
    const [lon, lat] = dragging.current.rotation
    setRotation([lon + (point.x - start.x) * 0.5, lat - (point.y - start.y) * 0.5])
  })
  const handlers = bind('globe', '地球儀(ドラッグ・矢印キーで回転)')
  const sphere = useMemo(() => ({ type: 'Sphere' }) as const, [])

  return (
    <div className="figure-block" ref={block}>
      <svg
        className="figure figure-globe"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        {...handlers}
        onPointerDown={(e) => {
          pressed.current = true
          handlers.onPointerDown(e)
        }}
        onPointerUp={(e) => {
          pressed.current = false
          dragging.current = null
          handlers.onPointerUp(e)
        }}
      >
        <Orthographic
          data={countries}
          scale={size / 2 - 10}
          translate={[size / 2, size / 2]}
          rotate={rotation}
          clipAngle={90}
        >
          {({ path, features }) => (
            <g>
              <path d={path(sphere) ?? ''} className="figure-globe-sea" />
              {features.map(({ path: d }, i) => (
                <path key={i} d={d ?? ''} className="figure-globe-land" />
              ))}
            </g>
          )}
        </Orthographic>
      </svg>
      <div className="figure-buttons">
        <PlayPauseButton playing={playing} onToggle={() => setPlaying((p) => !p)} />
        <ResetButton onClick={() => setRotation([0, 0])} />
      </div>
    </div>
  )
}
