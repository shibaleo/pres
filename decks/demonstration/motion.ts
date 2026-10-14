import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  // 外のデッキは reveal(枠の中に、ほかのモードのデッキを本物のまま埋め込む)
  mode: 'reveal',
  transition: 'fade',
} satisfies MotionConfig
