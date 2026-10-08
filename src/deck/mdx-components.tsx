import type { ComponentProps } from 'react'
import { Fragment as RevealFragment } from '@revealjs/react'
import Frame from '../components/Frame'
import Notes from '../components/Notes'
import { Cite, Bibliography } from '../components/Cite'
import { Theorem, Lemma, Proposition, Corollary, Definition, Proof } from '../components/Theorem'
import { Center, Cols, Col, Byline, Note, Code } from '../components/layout'

/**
 * 段階表示。reveal の既定は <span> だが、スライドでは段落や定理を囲む使い方が主なので
 * <div> を既定にする(文中で使うときは as="span")。
 */
function Fragment(props: ComponentProps<typeof RevealFragment>) {
  return <RevealFragment as="div" {...(props as object)} />
}

/**
 * どのスライドからも import なしで使える部品。
 * MDX は「スコープに無い大文字タグ」をこの components から引く。
 *
 * ここに置くのは文書の構造を表す汎用部品だけ。
 * 個別の図(Globe, LogSpiral など)は使うスライドで明示的に import する。
 */
export const mdxComponents = {
  // reveal の機能
  Fragment, // 段階表示: <Fragment>…</Fragment>
  Notes, //    スピーカーノート
  // 囲み・定理環境
  Frame,
  Theorem,
  Lemma,
  Proposition,
  Corollary,
  Definition,
  Proof,
  // レイアウト
  Center,
  Cols,
  Col,
  Byline,
  Note,
  Code,
  // 文献(本文の \cite{key} は自動で <Cite> になる)
  Cite,
  Bibliography,
}
