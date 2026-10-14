import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  mode: 'spectacle',
  transition: 'slide',
  // 新しい節へ入るときは立方体が回り、節の中の続きはカードが重なる
  section: 'cube',
  continuation: 'cards',
  transitions: {
    // 主定理(題に \label{sec:main})は寄って見せる
    'sec:main': 'zoom',
  },
  // impress モード(?mode=impress)では、文書の順に螺旋に沿って置く
  impress: { layout: 'spiral' },
} satisfies MotionConfig
