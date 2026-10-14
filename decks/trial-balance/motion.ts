import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  // Swiper: スワイプやドラッグでも送れる。伝票をめくるように、カードが重なって入れ替わる
  mode: 'swiper',
  transition: 'cards',
} satisfies MotionConfig
