import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  // Shower: 全ページを並べた一覧から入り、押したページを全画面で読む。手順書を見渡してから読む使い方に
  mode: 'shower',
} satisfies MotionConfig
