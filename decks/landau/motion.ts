import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  // reveal: 段階表示・縦の続き・発表者ビュー・PDF がそろった完成品。導出を 1 段ずつ追う資料に
  mode: 'reveal',
  transition: 'slide',
  // 導出の式は、段ごとに下から上がってくる
  step: 'fade-up',
  // 付録(記法の見本。縦の続き)は静かに切り替える
  continuation: 'fade',
  transitions: {
    // 導出の行き着く先の分散関係(題に \label{sec:dispersion})は寄って見せる
    'sec:dispersion': 'zoom',
  },
} satisfies MotionConfig
