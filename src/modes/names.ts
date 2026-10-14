/**
 * モードの名前と、モードごとの開き方の変わり種。ブラウザ側(各モード)とビルド側(vite.config.ts の入口と
 * デッキの一覧ページ、原稿の変換)で共有するので、ブラウザに依らない値だけを置く。
 */

/**
 * モード(スライドを動かすライブラリ)。先頭が既定。デッキのモードは動きの設定(motion.ts の mode)で決め、
 * ビルドにはそのモードだけが入る。開発サーバーでは /<デッキ>/<モード>/ でほかのモードも開ける
 */
export const MODE_NAMES = ['reveal', 'impress', 'shower', 'spectacle', 'swiper'] as const
export type ModeName = (typeof MODE_NAMES)[number]

/**
 * 開発サーバーの一覧ページに並べる、モードごとの開き方の変わり種(URL に足す検索の部分と、その名前)。
 * どれもライブラリ自身の開き方(reveal の PDF 用の表示、Shower の全画面、Spectacle の一覧と発表者ビュー)
 */
export const MODE_VARIANTS: Record<ModeName, { query: string; label: string }[]> = {
  reveal: [{ query: 'print-pdf', label: 'PDF 用' }],
  impress: [],
  shower: [{ query: 'full', label: '全画面から' }],
  spectacle: [
    { query: 'overviewMode=true', label: '一覧' },
    { query: 'presenterMode=true', label: '発表者' },
  ],
  swiper: [],
}

/**
 * impress モードのスライドの並べ方(motion.ts の impress.layout)。先頭が既定。
 * grid は横の並び(---)を右へ、縦の続き(--)を下へ。spiral は文書の順に、外へ広がる螺旋に沿って置く。
 * zoom は Prezi のように、節の最初のスライドを大きな枠にして、節の中の続きをその中に小さく置く(寄ったり引いたりして進む。
 * 最初は全体を見渡すところから始まる)
 */
export const IMPRESS_LAYOUTS = ['grid', 'spiral', 'zoom'] as const
export type ImpressLayout = (typeof IMPRESS_LAYOUTS)[number]

/**
 * 遷移(スライドへ入るときの動き)の名前。デッキの動きの設定(decks/<名前>/motion.ts。modes/motion.ts)で使う共通の語彙で、
 * 各モードは持っているものだけを自分の演出に対応させる
 */
export const TRANSITIONS = ['none', 'slide', 'fade', 'zoom', 'cube', 'cards', 'flip'] as const
export type TransitionName = (typeof TRANSITIONS)[number]

/**
 * モードごとに使える遷移。slide はスライドごとに指定できるもの、deck はデッキ全体の既定にできるもの
 * (Swiper は演出を作るときに 1 つだけ決める作りなので、スライドごとには指定できない)
 */
export const MODE_TRANSITIONS: Record<ModeName, { slide: readonly TransitionName[]; deck: readonly TransitionName[] }> = {
  reveal: { slide: ['none', 'slide', 'fade', 'zoom'], deck: ['none', 'slide', 'fade', 'zoom'] },
  impress: { slide: [], deck: [] },
  shower: { slide: [], deck: [] },
  spectacle: { slide: TRANSITIONS, deck: TRANSITIONS },
  swiper: { slide: [], deck: ['slide', 'fade', 'cube', 'cards', 'flip'] },
}
