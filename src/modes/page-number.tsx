import { deckSlides } from '../deck/mode'

/**
 * ページ番号「i/全体」(reveal の slideNumber: 'c/t' と同じ数え方: 文書の順のスライド。段は数えない)。
 * ページ番号を持たないライブラリのモード(impress・Shower・Swiper)と、Spectacle(template の番号は今のスライドの番号なので、
 * 一覧と PDF 用の表示ではどのスライドも同じ番号になる)で使う。
 * 各モードの Slide がスライドの中に PageNumber を置き、watchPageNumbers が番号を書く。スライドの中に置くので、
 * 一覧(Shower・Spectacle)や見渡し(impress)でもスライドごとの番号が出る。見た目は theme/base.css の .page-number
 */
export function PageNumber() {
  return <span className="page-number" aria-hidden />
}

/**
 * 全スライドの PageNumber に番号を書き、スライドが増減するたび(開発時の HMR、Spectacle が後から描くスライド)に書き直す。
 * 番号は全スライドが揃ってからでないと決まらないので、1 枚ずつではなくまとめて数える。返す関数で止める
 */
export function watchPageNumbers(): () => void {
  let frame = 0
  const update = () => {
    frame = 0
    // 原稿の位置(data-slide-file / data-slide-line)で数える。同じスライドが 2 度描かれていても(Spectacle の発表者ビューは
    // 今と次の 2 つのデッキを描く)、同じ番号・同じ全体になる
    const slides = deckSlides()
    const keyOf = (slide: HTMLElement) => `${slide.dataset.slideFile ?? ''}:${slide.dataset.slideLine}`
    const order = [...new Set(slides.map(keyOf))]
    slides.forEach((slide) => {
      const el = slide.querySelector(':scope > .page-number')
      const page = String(order.indexOf(keyOf(slide)) + 1)
      const text = `${page}/${order.length}`
      if (!el || el.textContent === text) return // 同じなら書かない(書くと監視がまた呼ばれる)
      el.textContent = text
      // 番号だけ(全体なし)を出す見た目のため(theme/presets/shower-ribbon.css のリボン)
      ;(el as HTMLElement).dataset.page = page
    })
  }
  const observer = new MutationObserver(() => {
    if (!frame) frame = requestAnimationFrame(update)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  update()
  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
}
