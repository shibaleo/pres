import { documentComponents } from '../../components'
import { Overlay, StepMarkers } from '../marker-steps'
import { FlatStack, slideAttributes, stepsOf, type SlideProps } from '../structure'

/**
 * impress モードの部品: 文書の部品 + 構造の部品(impress.js の .step と .substep)。
 */

/** スライドを置く間隔(論理座標の px)。横の並び(h)は右へ、縦の続き(v)は下へ並べる */
export const GAP = { x: 1200, y: 900 }

/** スライド 1 枚 = impress の step。座標は並び(h・v)から決める。段の印は impress の substep(文書順に 1 つずつ substep-visible が付く) */
function Slide(props: SlideProps) {
  return (
    <div className="step slide" data-x={Number(props.h ?? 0) * GAP.x} data-y={Number(props.v ?? 0) * GAP.y} {...slideAttributes(props)}>
      {props.children}
      <StepMarkers steps={stepsOf(props)} markerClass="substep" />
    </div>
  )
}

/** 縦の続きの束は包まない(impress は座標で並べる) */
export const impressComponents = { ...documentComponents, Slide, Stack: FlatStack, Overlay }
