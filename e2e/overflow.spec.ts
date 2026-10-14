/**
 * はみ出しの検査: 本番のビルド(dist/<デッキ>/index.html。デッキのモード)の全デッキを ?check-overflow で開き、開発時と同じ検査
 * (src/devtools/overflow.ts。スライドを最小サイズ 933×700 で組んで、縦横とコードの枠の中のはみ出しを測る)の結果を集める。
 * 原稿を書いて npm run check を通せば、はみ出したスライドが原稿の位置付きで報告される。
 * 検査はモードに依らないので、本番のビルドで回す(どのデッキも本番のモードで起動することも確かめる)。
 */
import { expect, test } from '@playwright/test'
import { allDecks, deckUrl, expectBuilt } from './deck'

for (const deck of allDecks) {
  test(`${deck}: どのスライドも最小サイズからはみ出さない`, async ({ page }) => {
    const [built, missing] = expectBuilt(deck, 'deck')
    expect(built, missing).toBe(true)
    await page.goto(deckUrl(deck, '', '?check-overflow', 'deck'))
    await page.waitForSelector('[data-deck-ready]')
    await page.evaluate(() => document.fonts.ready)
    // 検査は DOM の変化とフォントの読み込みの後に走る(150ms 待って測る)。全スライドに結果が付き、落ち着くまで待つ
    await page.waitForFunction(() => {
      const slides = [...document.querySelectorAll<HTMLElement>('.deck .slide[data-slide-line]')]
      return slides.length > 0 && slides.every((s) => s.dataset.deckOverflow !== undefined)
    })
    await page.waitForTimeout(500)
    const overflows = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.deck .slide[data-slide-line]')]
        .filter((s) => s.dataset.deckOverflow)
        .map((s) => `${s.dataset.slideFile ?? 'deck.mdx'}:${s.dataset.slideLine} ${s.dataset.deckOverflow}`),
    )
    expect(overflows).toEqual([])
  })
}
