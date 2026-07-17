import { Deck, Slide } from '@revealjs/react'
import Menu from './components/Menu'
import Title from './slides/Title.mdx'
import Intro from './slides/Intro.mdx'
import Comparison from './slides/Comparison.mdx'
import Frames from './slides/Frames.mdx'
import MathDiagrams from './slides/MathDiagrams.mdx'
import GraphsFourPoints from './slides/GraphsFourPoints.mdx'
import GraphsSpiral from './slides/GraphsSpiral.mdx'
import Globe from './slides/Globe.mdx'
import References from './slides/References.mdx'
import Closing from './slides/Closing.mdx'

// 旧 pres.adoc の include 順を踏襲: abstract → body → conclusion
const SLIDES = [
  Title,
  Intro,
  Comparison,
  Frames,
  MathDiagrams,
  GraphsFourPoints,
  GraphsSpiral,
  Globe,
  References,
  Closing,
]

/**
 * デッキ本体。スライド機構 (ナビ・番号・hash・PDF出力) は reveal.js が担当し、
 * 各スライドの中身は MDX / TSX コンポーネント。
 */
export default function App() {
  return (
    <Deck
      config={{
        width: 960,
        height: 700,
        margin: 0.04,
        center: false,
        slideNumber: 'c/t',
        hash: true,
      }}
    >
      {SLIDES.map((SlideContent, i) => (
        <Slide key={i}>
          <SlideContent />
        </Slide>
      ))}
      <Menu />
    </Deck>
  )
}
