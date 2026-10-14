import type { MotionConfig } from '@/modes/motion'

// このデッキの動き(本文には書かない)。書き方は README の「動きの設定」
export default {
  // impress: 大きな面の上を、カメラが寄ったり引いたりして進む
  mode: 'impress',
  impress: {
    // Prezi のように、節の最初のスライドを大きな枠にし、節の中の続き(--)をその下半分に小さく置く。
    // 全体を見渡すところから始まり、節の枠へ寄り、続きへさらに寄って、次の節へは引いてから移る
    layout: 'zoom',
  },
} satisfies MotionConfig
