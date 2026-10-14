import type { ImpressLayout, ModeName, TransitionName } from './names'

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
  /** impress モードでのスライドの置き方(impress は平面・空間にスライドを置き、カメラが移る) */
  impress?: ImpressMotion
}

/**
 * impress モードでのスライドの置き方。layout で全体を並べ、positions でラベルのスライドだけ置き直す:
 *   impress: { layout: 'spiral', positions: { 'sec:main': { z: -1500, scale: 2 } } }
 */
export type ImpressMotion = {
  /** 全体の並べ方(grid: 横の並びを右へ・縦の続きを下へ(既定)、spiral: 文書の順に螺旋に沿って) */
  layout?: ImpressLayout
  /**
   * 個別のスライドの置き場所。スライドは題に書いた \label の名前で指す。書いた項目だけが layout の値を置き換える
   * (書かない項目は layout のまま)
   */
  positions?: Record<string, ImpressPlace>
}

/**
 * impress の step の置き場所(impress の data-x などと同じ意味)。x・y・z はスライドの中心の座標(論理座標の px。
 * スライドは 933×700、y は下向き)、rotate は画面の面の中での回転(度。時計回り)、rotateX・rotateY は奥行きの方向の傾き(度)、
 * scale は大きさの倍率
 */
export type ImpressPlace = {
  x?: number
  y?: number
  z?: number
  rotate?: number
  rotateX?: number
  rotateY?: number
  scale?: number
}
