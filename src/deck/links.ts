import { goToSlide, SLIDE_SELECTOR } from './mode'

/**
 * 文書の中のリンク(href="#名前")を押したら、その名前(id)の要素を含むスライドへ移る。どのモードでも同じ。
 *
 * 原稿は標準の書き方だけで飛び先を書く: \ref{…}(変換が <a href="#…"> にする)、CommonMark の [文字](#名前)、
 * JSX の <a href="#名前">。飛び先はスライドの題の \label(スライドの id)、定理のラベル、式の番号(MathJax の mjx-eqn:…)。
 * ブラウザの普通の動き(その要素までスクロール)はスライドの切り替えにならず、移り方はライブラリごとに違うので、
 * モードが登録した「このスライドへ移る」(deck/mode.ts の registerGoTo)で移る。
 * ライブラリ自身の形の hash(reveal の #/4 など)と、文書の外への飛び先には手を出さない。返す関数で止める
 */
export function watchInternalLinks(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
    if (!a) return
    const href = a.getAttribute('href')!
    if (href.startsWith('#/')) return // ライブラリの hash(reveal・impress)
    const target = document.getElementById(decodeURIComponent(href.slice(1)))
    const slide = target?.closest<HTMLElement>(SLIDE_SELECTOR)
    if (!slide) return
    // ライブラリにはこのクリックを渡さない(impress は「今のスライドではない step を押したら、その step へ移る」ので、
    // 移った直後に元のスライドへ戻してしまう)。そのため捕捉の段階(ライブラリより先)で受ける
    e.preventDefault()
    e.stopPropagation()
    goToSlide(slide)
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}
