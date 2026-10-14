import { Slide as RevealSlide, Stack } from '@revealjs/react'
import { documentComponents } from '../../components'
import { slideAttributes, stepsOf, type SlideProps } from '../structure'
import { Overlay, OverlaySteps } from './Overlay'

/**
 * reveal モードのスライド 1 枚(theme/base.css の .deck .slide)。h・v は使わない(reveal は並びを DOM の入れ子(<Stack>)から数える)。
 * 段の数だけ見えない fragment を末尾に置き、reveal のステップ数を Beamer と揃える
 */
function Slide(props: SlideProps) {
  const steps = stepsOf(props)
  return (
    <RevealSlide className="slide" {...slideAttributes(props)}>
      {props.children}
      {steps >= 2 && <OverlaySteps steps={steps} />}
    </RevealSlide>
  )
}

/** reveal モードの部品: 文書の部品 + 構造の部品(縦の続き(--)は reveal の縦のスライドの束 <Stack>) */
export const revealComponents = { ...documentComponents, Slide, Stack, Overlay }
