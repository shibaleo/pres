/**
 * モードの名前と、モードごとの開き方の変わり種。ブラウザ側(main.tsx・各モード)と開発サーバー側(vite.config.ts の
 * デッキの一覧ページ)で共有するので、ブラウザに依らない値だけを置く。
 */

/** モード(URL の ?mode=<名前>)。先頭が既定 */
export const MODE_NAMES = ['reveal', 'impress', 'shower', 'spectacle', 'swiper'] as const
export type ModeName = (typeof MODE_NAMES)[number]

/** Swiper モードの切り替えの演出(URL の &effect=<名前>)。先頭が既定 */
export const SWIPER_EFFECTS = ['slide', 'fade', 'cube', 'coverflow', 'flip', 'cards', 'creative'] as const
export type SwiperEffect = (typeof SWIPER_EFFECTS)[number]

/** 一覧ページに並べる、モードごとの開き方の変わり種(URL に足す検索の部分と、その名前) */
export const MODE_VARIANTS: Record<ModeName, { query: string; label: string }[]> = {
  reveal: [{ query: 'print-pdf', label: 'PDF 用' }],
  impress: [],
  shower: [{ query: 'full', label: '全画面から' }],
  spectacle: [
    { query: 'overviewMode=true', label: '一覧' },
    { query: 'presenterMode=true', label: '発表者' },
  ],
  swiper: SWIPER_EFFECTS.slice(1).map((effect) => ({ query: `effect=${effect}`, label: effect })),
}

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
