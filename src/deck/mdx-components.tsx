import type { ComponentProps } from 'react'
import { Slide as RevealSlide, Stack } from '@revealjs/react'
import Frame from '../components/Frame'
import Notes from '../components/Notes'
import { Theorem, Lemma, Proposition, Corollary, Definition, Proof, ThmTitle } from '../components/Theorem'
import { Overlay, OverlaySteps } from '../components/Overlay'
import { Center, Cols, Col, Byline, Note, Code } from '../components/layout'

/**
 * スライド 1 枚(theme/base.css の .deck .slide)。h・v(スライドの並び。vite/remark-beamer が付ける)は
 * reveal が DOM の入れ子(<Stack>)から自分で数えるので使わない
 */
function Slide({ h: _h, v: _v, ...props }: ComponentProps<typeof RevealSlide> & { h?: number | string; v?: number | string }) {
  return <RevealSlide className="slide" {...props} />
}

/**
 * スライド原稿(decks/<名前>/deck.mdx)から import なしで使える部品。
 * MDX は「スコープに無い大文字タグ」をこの components から引く。
 *
 * ここに置くのは文書の構造を表す汎用部品だけ。
 * 個別の図(Globe, LogSpiral など)は原稿の先頭で明示的に import する。
 */
export const mdxComponents = {
  // reveal の構造(原稿の --- / -- を vite/remark-beamer が Slide / Stack に変換する)
  Slide,
  Stack,
  // reveal の機能
  Notes, //    スピーカーノート
  // 囲み・定理環境(\begin{theorem} などの変換先。JSX で直接書いてもよい)
  Frame,
  Theorem,
  Lemma,
  Proposition,
  Corollary,
  Definition,
  Proof,
  ThmTitle,
  // レイアウト
  Center,
  Cols,
  Col,
  Byline,
  Note,
  Code,
  // Beamer の段階表示(\pause / <2-> / \only<2>{…} / \uncover<2->{…})の変換先
  Overlay,
  OverlaySteps,
}
