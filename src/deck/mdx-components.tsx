import { Fragment } from '@revealjs/react'
import Frame from '../components/Frame'
import Notes from '../components/Notes'
import { Cite, Bibliography } from '../components/Cite'
import { Theorem, Lemma, Proposition, Corollary, Definition, Proof } from '../components/Theorem'
import { Center, Cols, Col, Byline, Note, Code } from '../components/layout'

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
  // 文献(本文の [@key] は自動で <Cite> になる)
  Cite,
  Bibliography,
}
