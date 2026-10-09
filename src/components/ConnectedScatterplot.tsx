import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { connectedScatterData } from '../data/connectedScatter'

/**
 * connected scatterplot + クリックで系列トグルする凡例 (旧 connected-scatterplot.js).
 *
 * 旧版: グローバル IIFE + CDN CSV fetch + `currentOpacity` がグローバル漏れ。
 * ここ: データはローカルバンドル、d3 の命令的描画も useEffect 内に閉じ、
 *       再マウント時に前回の SVG を作り直す(重複追加を防ぐ)。
 */
export default function ConnectedScatterplot() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const root = d3.select(ref.current)
    root.selectAll('*').remove() // 再実行時のクリーンアップ

    const margin = { top: 10, right: 100, bottom: 30, left: 30 }
    const width = 360 - margin.left - margin.right
    const height = 300 - margin.top - margin.bottom

    const svg = root
      .append('svg')
      // 列の幅に合わせて縮む(.figure: max-width 100%)。座標は viewBox のまま
      .attr('class', 'figure')
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const allGroup = ['valueA', 'valueB', 'valueC'] as const
    const dataReady = allGroup.map((name) => ({
      name,
      values: connectedScatterData.map((d) => ({ time: d.time, value: d[name] })),
    }))

    const color = d3.scaleOrdinal<string>().domain(allGroup).range(d3.schemeSet2)
    const x = d3.scaleLinear().domain([0, 10]).range([0, width])
    const y = d3.scaleLinear().domain([0, 20]).range([height, 0])

    svg.append('g').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(x))
    svg.append('g').call(d3.axisLeft(y))

    const line = d3
      .line<{ time: number; value: number }>()
      .x((d) => x(d.time))
      .y((d) => y(d.value))

    svg
      .selectAll('.line')
      .data(dataReady)
      .join('path')
      .attr('class', (d) => d.name)
      .attr('d', (d) => line(d.values))
      .attr('stroke', (d) => color(d.name))
      .style('stroke-width', 4)
      .style('fill', 'none')

    svg
      .selectAll('.dotgroup')
      .data(dataReady)
      .join('g')
      .style('fill', (d) => color(d.name))
      .attr('class', (d) => d.name)
      .selectAll('circle')
      .data((d) => d.values)
      .join('circle')
      .attr('cx', (d) => x(d.time))
      .attr('cy', (d) => y(d.value))
      .attr('r', 5)
      .attr('stroke', 'white')

    // クリックで系列の表示/非表示をトグル
    svg
      .selectAll('.legend')
      .data(dataReady)
      .join('text')
      .attr('x', (_d, i) => 30 + i * 60)
      .attr('y', 30)
      .text((d) => d.name)
      .style('fill', (d) => color(d.name))
      .style('font-size', '15px')
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        // svg 配下だけを選択する(d3.selectAll だとページ全体の同名 class に波及する)
        const series = svg.selectAll<SVGElement, unknown>('.' + d.name)
        const opacity = series.style('opacity')
        series
          .transition()
          .style('opacity', opacity === '1' ? 0 : 1)
      })

    return () => {
      root.selectAll('*').remove()
    }
  }, [])

  return <div ref={ref} className="mx-auto" />
}
