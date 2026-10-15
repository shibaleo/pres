import { Slide as RevealSlide, Stack } from '@revealjs/react'
import { documentComponents } from '../../components'
import { MODE_TRANSITIONS, type TransitionName } from '../names'
import { slideAttributes, stepsOf, type SlideProps } from '../structure'
import { Overlay, OverlaySteps } from './Overlay'

/** 共通の遷移の名前を reveal の遷移にする(reveal にあるものだけ。名前は同じ)。無ければ undefined */
type RevealTransition = 'none' | 'slide' | 'fade' | 'zoom' | 'convex' | 'concave'
export function revealTransition(t: TransitionName | undefined): RevealTransition | undefined {
  return t && MODE_TRANSITIONS.reveal.slide.includes(t) ? (t as RevealTransition) : undefined
}

/**
 * reveal モードのスライド 1 枚(theme/base.css の .deck .slide)。h・v は使わない(reveal は並びを DOM の入れ子(<Stack>)から数える)。
 * 段の数だけ見えない fragment を末尾に置き、reveal のステップ数を Beamer と揃える。
 * 遷移(motion.ts)は reveal のスライドごとの遷移(data-transition)にする。reveal に無い遷移(cube など)は付けない
 */
function Slide(props: SlideProps) {
  const steps = stepsOf(props)
  const transition = revealTransition(props.transition)
  return (
    <RevealSlide className="slide" transition={transition} {...slideAttributes(props)}>
      {props.children}
      {steps >= 2 && <OverlaySteps steps={steps} />}
    </RevealSlide>
  )
}

/** reveal モードの部品: 文書の部品 + 構造の部品(縦の続き(--)は reveal の縦のスライドの束 <Stack>) */
export const revealComponents = { ...documentComponents, Slide, Stack, Overlay }
