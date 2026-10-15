import { deckSlides } from '../deck/mode'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../deck/slide-metrics'

/** はみ出したスライド(原稿の位置・超過の内容・文書の順での番号(deckSlides の何番目か)) */
export type Overflow = { file: string; line: string; message: string; index: number }

/**
 * 開発時(と、ビルドしたデッキを ?check-overflow で開いたとき。e2e/overflow.spec.ts): スライドの最小サイズ(MIN_WIDTH × SLIDE_HEIGHT)からはみ出したスライドを検出する。
 * どのモードでも同じ(スライドは deckSlides。モードとの約束は deck/mode.ts)。
 *
 * スライドは窓に合わせて広がったり(reveal)、縮小して並べられたり(Shower の一覧)するので、いま見えている大きさで測ると見落とす。
 * そこで検査のときだけスライドを最小の幅で組み直して縦横を測り、すぐ戻す(描画の前に戻るので画面には出ない)。
 *
 * ライブラリははみ出し部分を黙って切るので、気づけるように
 *   - 最小サイズの範囲に赤い破線の枠と超過量のバッジ(theme/base.css の .deck-overflow)
 *   - 開発時の画面右上の一覧(devtools/DevDiagnostics.tsx。押すとそのスライドへ)と、開発サーバーの端末
 *   - 開発サーバーにつながっていないとき(ビルドしたデッキを ?check-overflow で開いたとき)はコンソールに警告
 * を出す。本文の変更(HMR)やフォント読み込みで大きさが変わるので、DOM 変化のたびに測り直す。
 */
export function watchOverflow(onChange?: (overflows: Overflow[]) => void): () => void {
  const reported = new Map<string, string>()
  let last = ''

  const check = () => {
    const overflows: Overflow[] = []
    deckSlides().forEach((slide, index) => {
      const { width, height, code } = measureAtMinimum(slide)
      const excess = [
        height - SLIDE_HEIGHT > 1 && `縦 ${height - SLIDE_HEIGHT}px`,
        width - MIN_WIDTH > 1 && `横 ${width - MIN_WIDTH}px`,
        code > 1 && `コードの行が枠を ${code}px`,
      ].filter(Boolean)
      const message = excess.length
        ? `最小サイズ ${MIN_WIDTH}×${SLIDE_HEIGHT} を ${excess.join('・')} はみ出し`
        : ''
      slide.classList.toggle('deck-overflow', !!message)
      slide.dataset.deckOverflow = message
      // data-slide-file / data-slide-line は原稿でのスライドの開始位置(vite/remark-beamer が付ける。\input で取り込んだものはそのファイル)
      const path = `${slide.dataset.slideFile ?? 'deck.mdx'}:${slide.dataset.slideLine ?? '?'}`
      // コンソールへは開発サーバーにつながっていないときだけ(つながっていれば端末に出す。Vite はブラウザの
      // console.warn も端末へ転送するので、両方に出すと端末に 2 回出る)
      if (!import.meta.hot && message && reported.get(path) !== message) console.warn(`[deck] ${path} が${message}ています`)
      if (message) reported.set(path, message)
      else reported.delete(path)
      if (message) overflows.push({ file: slide.dataset.slideFile ?? 'deck.mdx', line: slide.dataset.slideLine ?? '?', message, index })
    })
    // 変わったときだけ知らせる(開発時の一覧と、開発サーバーの端末。vite.config.ts の decksPlugin が受け取る)
    const now = JSON.stringify(overflows)
    if (now === last) return
    last = now
    onChange?.(overflows)
    import.meta.hot?.send('deck:overflow', { page: location.pathname, overflows })
  }

  let timer = 0
  const schedule = () => {
    clearTimeout(timer)
    timer = window.setTimeout(check, 150)
  }
  const observer = new MutationObserver(schedule)
  // 属性の変化(ライブラリが付ける今のスライドの class や、ここで付ける class・style)には反応しない
  observer.observe(document.getElementById('root')!, { childList: true, subtree: true, characterData: true })
  document.fonts.ready.then(schedule)
  // 書体は、その書体を使う要素が表示されて初めて読み込まれる(表示していないスライドだけが使う書体は、測るために
  // 表示したときに読み込みが始まり、その回は代わりの書体で測ってしまう)。読み込みが終わるたびに測り直す
  document.fonts.addEventListener('loadingdone', schedule)
  schedule()

  return () => {
    clearTimeout(timer)
    observer.disconnect()
    document.fonts.removeEventListener('loadingdone', schedule)
  }
}

/**
 * スライドを最小の幅で組んだときの中身の縦横(はみ出しを含む)と、コード(pre)の枠の中の横のはみ出しの最大。
 * コードの枠は overflow: auto なので、長い行は枠の中でスクロールになり、スライドの大きさには出ない(発表では行の続きが見えない)。
 * ライブラリは今のスライドから遠いものを描かないことがある(display: none。スライドにも、それを包む要素にも付く)ので、
 * 測る間だけ表示し、縮小(zoom。Shower の一覧)も外す。スライドは窓と同じ縦横比で最小サイズより広い・高いことがあるので
 * (deck/view-size.ts)、測る間だけ幅と高さを最小サイズにする(高さはそれより中身が高ければ scrollHeight に出る)。
 * reveal のスクロールビューはスライドの幅と高さを !important で決めるので、測る間の値にも !important を付ける
 */
function measureAtMinimum(slide: HTMLElement): { width: number; height: number; code: number } {
  const hidden: HTMLElement[] = []
  for (let el: HTMLElement | null = slide; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).display === 'none') hidden.push(el)
  }
  const OVERRIDES = { width: `${MIN_WIDTH}px`, height: `${SLIDE_HEIGHT}px`, zoom: '1' }
  const prev = {
    display: hidden.map((el) => el.style.display),
    slide: Object.keys(OVERRIDES).map((name) => [name, slide.style.getPropertyValue(name), slide.style.getPropertyPriority(name)] as const),
  }
  for (const el of hidden) el.style.display = 'block'
  for (const [name, value] of Object.entries(OVERRIDES)) slide.style.setProperty(name, value, 'important')
  const code = Math.max(0, ...[...slide.querySelectorAll('pre')].map((p) => p.scrollWidth - p.clientWidth))
  const size = { width: slide.scrollWidth, height: slide.scrollHeight, code }
  for (const [name, value, priority] of prev.slide) slide.style.setProperty(name, value, priority)
  hidden.forEach((el, i) => (el.style.display = prev.display[i]))
  return size
}
