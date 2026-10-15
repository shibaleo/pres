import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  // 講演の文献が勧めるとおり、動きは控えめに: 切り替えは静かに、段は区切りとしてだけ使う
  mode: 'reveal',
  transition: 'fade',
  step: 'fade',
} satisfies MotionConfig
