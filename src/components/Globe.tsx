import { useEffect, useMemo, useRef, useState } from 'react'
import { Orthographic } from '@visx/geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'
// world-atlas をローカルバンドル (CDN fetch を廃止 → オフラインでも描画される)
import worldData from 'world-atlas/countries-110m.json'
import { useSvgDrag, type Point } from './figure/useSvgDrag'
import ResetButton from './figure/ResetButton'

/**
 * 回る地球儀(SVG・visx の正射図法)。
 *   - ゆっくり自転する。ドラッグすると向きを変えられる(ドラッグ中は自転を止める)
 *   - 右上のボタンで初期の向きに戻す
 * SVG なので拡大しても鮮明で、印刷・PDF にもそのまま残る。
 */
const world = worldData as unknown as Topology
const countries = (feature(world, world.objects.countries as GeometryCollection) as FeatureCollection<Geometry>).features

const SPEED: [number, number] = [0.5, -0.1] // 1 コマ(約 1/30 秒)あたりの回転(度)
const FRAME_MS = 33

export default function Globe({ size = 500 }: { size?: number }) {
  const [rotation, setRotation] = useState<[number, number]>([0, 0])
  const dragging = useRef<{ start: Point; rotation: [number, number] } | null>(null)

  // 自転。ドラッグ中は止める
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (now - last >= FRAME_MS && !dragging.current) {
        last = now
        setRotation(([lon, lat]) => [lon + SPEED[0], lat + SPEED[1]])
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const bind = useSvgDrag((_, point, start) => {
    if (dragging.current?.start !== start) dragging.current = { start, rotation }
    const [lon, lat] = dragging.current.rotation
    setRotation([lon + (point.x - start.x) * 0.5, lat - (point.y - start.y) * 0.5])
  })
  const handlers = bind('globe')
  const sphere = useMemo(() => ({ type: 'Sphere' }) as const, [])

  return (
    <div className="figure-block">
      <svg
        className="figure figure-globe"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        {...handlers}
        onPointerUp={(e) => {
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
      <ResetButton onClick={() => setRotation([0, 0])} />
    </div>
  )
}
