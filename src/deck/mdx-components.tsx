import Frame from '../components/Frame'
import Notes from '../components/Notes'
import { Theorem, Lemma, Proposition, Corollary, Definition, Proof, ThmTitle } from '../components/Theorem'
import { Center, Cols, Col, Byline, Note, Code } from '../components/layout'

/**
 * 文書の部品: スライド原稿(decks/<名前>/deck.mdx)から import なしで使える部品のうち、どのモードでも同じもの。
 * MDX は「スコープに無い大文字タグ」を components から引く。
 *
 * 構造の部品(Slide・Stack・Overlay。原稿の --- / -- と段階表示の変換先)はモードごとに違うので、ここには置かない。
 * 各モードが {...documentComponents, Slide, Stack, Overlay} にして MDX に渡す(src/modes/)。
 * 個別の図(Globe, LogSpiral など)は原稿の先頭で明示的に import する。
 */
export const documentComponents = {
  // スピーカーノート(<aside class="notes">。発表者ビューのあるモードはそこに出す)
  Notes,
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
}
