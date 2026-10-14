import { documentComponents } from '../../components'
import { Overlay, StepMarkers } from '../marker-steps'
import { PageNumber } from '../page-number'
import { FlatStack, slideAttributes, stepsOf, type SlideProps } from '../structure'

/**
 * impress モードの部品: 文書の部品 + 構造の部品(impress.js の .step と .substep)。
 */

/**
 * スライド 1 枚 = impress の step。並び(h・v)を data-h・data-v に置き、置き場所(data-x など)は ImpressApp が
 * デッキの動きの設定から決めて書く(layout.ts)。段の印は impress の substep(文書順に 1 つずつ substep-visible が付く)
 */
function Slide(props: SlideProps) {
  return (
    <div className="step slide" data-h={Number(props.h ?? 0)} data-v={Number(props.v ?? 0)} {...slideAttributes(props)}>
      {props.children}
      <PageNumber />
      <StepMarkers steps={stepsOf(props)} markerClass="substep" />
    </div>
  )
}

/** 縦の続きの束は包まない(impress は座標で並べる) */
export const impressComponents = { ...documentComponents, Slide, Stack: FlatStack, Overlay }
