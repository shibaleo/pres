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
 * 段の現れ方(motion.ts の step。段階表示で、次の段の要素が現れるときの動き)。先頭が既定。どのモードでも同じに効く:
 * reveal は fragment の型(fade-up など。blur と none はこのリポジトリの CSS)、ほかのモードは theme/base.css の .overlay の規則。
 * fade は今の見え方(その場で薄く現れる)、fade-up などはその向きから滑り込み、zoom-in は小さい所から、blur はぼかしから、none はすぐ出る。
 * \only(出ていない間は場所も取らない段)は、どのモードでもすぐ出る
 */
export const STEP_EFFECTS = ['fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in', 'blur', 'none'] as const
export type StepEffect = (typeof STEP_EFFECTS)[number]

/**
 * reveal モードの表示(motion.ts の reveal.view)。省略すると 1 枚ずつのスライド。
 * scroll は reveal のスクロールビュー(スライドを縦に並べた 1 ページにし、スクロールで進む。段階表示もスクロールで進む)
 */
export const REVEAL_VIEWS = ['scroll'] as const
export type RevealView = (typeof REVEAL_VIEWS)[number]

/**
 * 遷移(スライドへ入るときの動き)の名前。デッキの動きの設定(decks/<名前>/motion.ts。modes/motion.ts)で使う共通の語彙で、
 * 各モードは持っているものだけを自分の演出に対応させる
 */
// convex・concave は reveal の型(立体的に外向き・内向きに回り込む)、coverflow・creative は Swiper の型
// (傾いたカードが並ぶ・奥へ下がりながら傾いて出入りする)
export const TRANSITIONS = ['none', 'slide', 'fade', 'zoom', 'convex', 'concave', 'cube', 'cards', 'flip', 'coverflow', 'creative'] as const
export type TransitionName = (typeof TRANSITIONS)[number]

/**
 * モードごとに使える遷移。slide はスライドごとに指定できるもの、deck はデッキ全体の既定にできるもの
 * (Swiper は演出を作るときに 1 つだけ決める作りなので、スライドごとには指定できない)
 */
export const MODE_TRANSITIONS: Record<ModeName, { slide: readonly TransitionName[]; deck: readonly TransitionName[] }> = {
  reveal: { slide: ['none', 'slide', 'fade', 'zoom', 'convex', 'concave'], deck: ['none', 'slide', 'fade', 'zoom', 'convex', 'concave'] },
  impress: { slide: [], deck: [] },
  shower: { slide: TRANSITIONS, deck: TRANSITIONS },
  spectacle: { slide: TRANSITIONS, deck: TRANSITIONS },
  swiper: { slide: [], deck: ['slide', 'fade', 'cube', 'cards', 'flip', 'coverflow', 'creative'] },
}
