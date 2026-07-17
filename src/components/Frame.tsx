import type { ReactNode } from 'react'

/**
 * 色付きフレーム (旧 _mixins.scss の frame() / math-frame() を移植).
 *
 * 旧構成では .frame-blue 等をグローバル class として全 CSS に撒いていた。
 * ここでは色を props で受け、色ごとの modifier class 地獄をコンポーネントに閉じる。
 * タイトル下線 = 濃い色、背景 = 白 85% と混ぜた淡色 (旧 mix(white,$c,85%))。
 */
const FRAME_COLORS = {
  gray: 'gray',
  red: 'orangered',
  blue: '#4360f4',
  gold: 'gold',
  green: 'green',
  purple: 'purple',
} as const

export type FrameColor = keyof typeof FRAME_COLORS

export default function Frame({
  color = 'red',
  title,
  math = false,
  children,
}: {
  color?: FrameColor
  title?: ReactNode
  /** 定理枠など: 背景を数式グレーにする (旧 math-frame) */
  math?: boolean
  children: ReactNode
}) {
  const c = FRAME_COLORS[color]
  const background = math ? 'var(--color-eq)' : `color-mix(in srgb, white 85%, ${c})`
  return (
    <div className="my-1 px-1 py-0.5" style={{ backgroundColor: background }}>
      {title && (
        <div
          className="font-heading m-2.5 font-bold"
          style={{ borderBottom: `4px solid ${c}`, paddingBottom: '0.1em' }}
        >
          {title}
        </div>
      )}
      <div className="pl-4">{children}</div>
    </div>
  )
}
