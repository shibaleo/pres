import type { ReactNode } from 'react'
import type { TransitionName } from './names'

/**
 * 構造の部品(Slide・Stack・Overlay)の、モードに共通の約束。原稿の変換(vite/remark-beamer)が出すものの形と、
 * 段の表示の判定。実体(ライブラリ向けの要素)は各モードが作る。
 */

/**
 * <Slide> の属性。h・v はスライドの並び(横の位置と、縦の続き(--)の中の位置)、steps は段の数(Beamer と同じ数え方。
 * 段階表示の無いスライドは 1)。data-slide-line / data-slide-file は原稿の位置(開発時のはみ出しの警告で使う)。
 * transition はそのスライドへ入るときの遷移(デッキの動きの設定 motion.ts で題で指したもの。変換が付ける)。
 * MDX の属性は文字列で渡るので、数は文字列でも受け付ける
 */
export type SlideProps = {
  h?: number | string
  v?: number | string
  steps?: number | string
  transition?: TransitionName
  /** 題の \label(スライドの要素の id。\ref と #名前 のリンクと motion.ts が指す) */
  id?: string
  children?: ReactNode
  'data-slide-line'?: number | string
  'data-slide-file'?: string
}

/** スライドの段の数 */
export const stepsOf = (props: SlideProps) => Number(props.steps ?? 1)

/** 要素に渡す属性(並び・段の数・遷移を除いたもの。原稿の位置 data-slide-* は残す) */
export function slideAttributes({ h: _h, v: _v, steps: _steps, transition: _transition, children: _children, ...rest }: SlideProps) {
  return rest
}

/** <Stack>(縦の続きの束)。スライドを一列に並べるモードでは、包まずに並べる */
export function FlatStack({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/**
 * <Overlay> の属性(Beamer の \pause・<2->・\only<2>{…}・<Fragment> の変換先)。
 * from から表示し、to まで表示する(次の段で消える)。only は非表示の間に場所も取らない(\only)。as は包む要素
 */
export type OverlayProps = {
  from: number | string
  to?: number | string
  as?: 'div' | 'span'
  only?: boolean
  children?: ReactNode
}

/** 段 k で表示するか */
export function isShown(k: number, from: number | string, to?: number | string): boolean {
  return k >= Number(from) && (to === undefined || k <= Number(to))
}

/**
 * 段 k の状態で描く Overlay の class(段階表示の見た目は theme/base.css の .overlay・.overlay-hidden)
 */
export function overlayClass(shown: boolean, only = false): string {
  return ['overlay', only && 'only', !shown && 'overlay-hidden'].filter(Boolean).join(' ')
}
