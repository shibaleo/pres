import type { ModeName, TransitionName } from './names'

/**
 * デッキの動きの設定(decks/<名前>/motion.ts の default export)。原稿(本文)には動きの指定を書かず、ここに書く。
 *
 *   import type { MotionConfig } from '@/modes/motion'
 *   export default {
 *     mode: 'spectacle',
 *     transition: 'slide',
 *     transitions: { 主定理の紹介: 'cube' },
 *   } satisfies MotionConfig
 *
 * ビルドのときに原稿の変換(vite/remark-beamer)が読み、題で指したスライドに遷移の名前を付ける。
 * 見つからない題・2 枚に当たる題・そのモードで使えない遷移は原稿の警告になる(開発時は一覧に出て、本番のビルドは失敗する)。
 * Node がそのまま読む(型の注釈を外して読む)ので、import は型だけ(import type)にする。
 */
export type MotionConfig = {
  /** このデッキの既定のモード(URL の ?mode= で一時的に上書きできる)。省略すると reveal */
  mode?: ModeName
  /** 既定の遷移(そのモードの既定の動きのままなら省略) */
  transition?: TransitionName
  /**
   * そのスライドへ入るときの遷移(出るときもそのスライドの遷移で動く)。スライドは題で指す: スライドの先頭の見出しの文字
   * (節番号は除く。数式は原稿と同じ $…$ の形)。題の無いスライドは、その中の最初の見出し
   */
  transitions?: Record<string, TransitionName>
}
