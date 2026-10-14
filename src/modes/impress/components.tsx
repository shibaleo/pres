import type { ReactNode } from 'react'
import { mdxComponents } from '../../deck/mdx-components'
import { Overlay, markerSteps } from '../marker-steps'

/**
 * impress モードの部品。原稿の変換結果(vite/remark-beamer の Slide / Stack / Overlay / OverlaySteps)を
 * impress.js の形(.step と .substep)にする。それ以外の部品(定理・囲み・段組み …)は reveal モードと同じものを使う。
 */

/** スライドを置く間隔(論理座標の px)。横の並び(h)は右へ、縦の続き(v)は下へ並べる */
export const GAP = { x: 1200, y: 900 }

/** スライド 1 枚 = impress の step。座標は並び(h・v。変換が付ける)から決める */
function Slide({ h, v, children, ...rest }: { h?: number | string; v?: number | string; children?: ReactNode }) {
  return (
    <div className="step slide" data-x={Number(h ?? 0) * GAP.x} data-y={Number(v ?? 0) * GAP.y} {...rest}>
      {children}
    </div>
  )
}

/** 縦の続きの束。impress は座標で並べるので包む要素は要らない */
function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/** 段の印は impress の substep(文書順に 1 つずつ substep-visible が付く) */
export const impressComponents = { ...mdxComponents, Slide, Stack, Overlay, OverlaySteps: markerSteps('substep') }
