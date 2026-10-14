import type { ModeName, TransitionName } from './names'

/**
 * デッキの動きの設定(decks/<名前>/motion.ts の default export)。原稿(本文)には動きの指定を書かず、ここに書く。
 *
 *   import type { MotionConfig } from '@/modes/motion'
 *   export default {
 *     mode: 'spectacle',
 *     transition: 'slide',
 *     section: 'cube',
 *     transitions: { 'sec:main': 'zoom' },
 *   } satisfies MotionConfig
 *
 * どのスライドへ入るときの遷移かは、文書の構造(新しい節・節の中の続き)か、スライドの題のラベル(\label)で指す。
 * 本文の文字(題)では指さない(題は内容の都合で直すので)。優先は ラベル → 構造の規則 → 既定。
 * ビルドのときに原稿の変換(vite/remark-beamer)が読み、各スライドに遷移の名前を付ける。
 * 無いラベル・スライドの題のものではないラベル・そのモードで使えない遷移は原稿の警告になる
 * (開発時は一覧に出て、本番のビルドは失敗する)。
 * Node がそのまま読む(型の注釈を外して読む)ので、import は型だけ(import type)にする。
 */
export type MotionConfig = {
  /** このデッキの既定のモード(URL の ?mode= で一時的に上書きできる)。省略すると reveal */
  mode?: ModeName
  /** 既定の遷移(そのモードの既定の動きのままなら省略) */
  transition?: TransitionName
  /** 新しい節(原稿の ---)のスライドへ入るときの遷移 */
  section?: TransitionName
  /** 節の中の続き(原稿の --)のスライドへ入るときの遷移 */
  continuation?: TransitionName
  /**
   * 個別のスライドへ入るときの遷移(出るときもそのスライドの遷移で動く)。スライドは、題に書いた \label の名前で指す:
   *   ## 主定理の紹介 \label{sec:main}   →   transitions: { 'sec:main': 'cube' }
   */
  transitions?: Record<string, TransitionName>
}
