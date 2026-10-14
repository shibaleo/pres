import type { MotionConfig } from '@/modes/motion'

export default {
  mode: 'spectacle',
  transition: 'slide',
  transitions: {
    '導入：ルジャンドル曲線': 'zoom',
    '主定理の紹介': 'cube',
    '主定理の解釈': 'cards',
    '主定理の背景：波面': 'flip',
  },
} satisfies MotionConfig
