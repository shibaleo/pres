import type { ComponentProps } from 'react'
import { Fragment as RevealFragment, Slide, Stack } from '@revealjs/react'
import Frame from '../components/Frame'
import Notes from '../components/Notes'
import { Theorem, Lemma, Proposition, Corollary, Definition, Proof, ThmTitle } from '../components/Theorem'
import { Overlay, OverlaySteps } from '../components/Overlay'
import { Center, Cols, Col, Byline, Note, Code } from '../components/layout'

/**
 * 段階表示。reveal の既定は <span> だが、スライドでは段落や定理を囲む使い方が主なので
 * <div> を既定にする(文中で使うときは as="span")。
 */
function Fragment(props: ComponentProps<typeof RevealFragment>) {
  return <RevealFragment as="div" {...(props as object)} />
}

/**
 * スライド原稿(slides.mdx)から import なしで使える部品。
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
  Fragment, // 段階表示: <Fragment>…</Fragment>
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
