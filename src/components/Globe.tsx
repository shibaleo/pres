import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
// world-atlas をローカルバンドル (CDN fetch を廃止 → オフラインでも描画される)
import worldData from 'world-atlas/countries-110m.json'

/**
 * 回転する地球 (3d-chart.js の移植).
 *
 * 旧版の問題点を2つ修正:
 *   1) グローバル変数 (rotation, velocity, countries...) → クロージャ内に閉じた
 *   2) interval を fetch 成功後に開始していた → データ同期読み込みにし、即座に描画開始
 *      (旧版は CDN fetch が失敗すると青い地球すら出なかった)
 */
export default function Globe({ size = 500 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')!

    const world = worldData as unknown as Topology
    const countries = feature(
      world,
      world.objects.countries as GeometryCollection,
    ) as unknown as d3.GeoPermissibleObjects

    const projection = d3.geoOrthographic()
      .scale(size / 2 - 10)
      .translate([size / 2, size / 2])
      .clipAngle(90)
    const path = d3.geoPath(projection, context)
    const globe: d3.GeoPermissibleObjects = { type: 'Sphere' }

    let rotation: [number, number] = [0, 0]
    const velocity: [number, number] = [0.5, -0.1]

    function draw() {
      context.clearRect(0, 0, size, size)
      projection.rotate(rotation)
      rotation = [rotation[0] + velocity[0], rotation[1] + velocity[1]]
      context.beginPath(); path(globe); context.fillStyle = '#0077be'; context.fill()
      context.beginPath(); path(countries); context.fillStyle = '#0a0a0a'; context.fill()
      context.beginPath(); path(countries); context.strokeStyle = '#fff'; context.lineWidth = 0.3; context.stroke()
    }

    const timer = d3.interval(draw, 33)

    let last: [number, number] | null = null
    const drag = d3.drag<HTMLCanvasElement, unknown>()
      .on('start', (e) => { last = [e.x, e.y] })
      .on('drag', (e) => {
        if (!last) return
        rotation = [rotation[0] + (e.x - last[0]) * 0.5, rotation[1] - (e.y - last[1]) * 0.5]
        last = [e.x, e.y]
      })
      .on('end', () => { last = null })
    d3.select(canvas).call(drag)

    return () => {
      timer.stop()
      d3.select(canvas).on('.drag', null)
    }
  }, [size])

  return <canvas ref={canvasRef} width={size} height={size} style={{ cursor: 'grab' }} />
}
