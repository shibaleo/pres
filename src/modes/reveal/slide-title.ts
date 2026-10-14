/**
 * スライドの題(メニューに出す文字)。スライドの最初の見出しの文字で、節番号(4.1. など)も含む。
 * 節番号はビルド時に見出しの文字として振られる(vite/remark-beamer)ので、メニューと見出しは必ず一致する。
 */
export function slideTitle(slide: Element): string {
  return slide.querySelector('h1,h2,h3,h4')?.textContent?.trim() || '(無題)'
}
