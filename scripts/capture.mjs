/**
 * ビルドしたデッキ(単一 HTML)の撮影と PDF の書き出し。scripts/deck.mjs の shots / pdf が使う。
 * PDF 用の表示(?print-pdf)で開き、ブラウザは e2e テストと同じく入っている Chrome をそのまま使う。
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

/** PDF 用の表示を開き、reveal がページを組み終えるまで待つ */
async function openPrint(browser, html, handout) {
  const page = await browser.newPage()
  // PDF 用の表示は reveal モードのもの(デッキの既定のモードが別でも reveal で開く)
  await page.goto(pathToFileURL(html).href + (handout ? '?print-pdf&handout&mode=reveal' : '?print-pdf&mode=reveal'))
  await page.waitForFunction(() => document.querySelectorAll('.pdf-page .slide-number-pdf').length > 0)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500) // reveal がページを組み終え、番号を書き直すまで(e2e/print.spec.ts と同じ)
  return page
}

/**
 * 各ページ(段階表示はステップごとに 1 ページ。handout では最後の状態の 1 ページだけ)を outDir/NN.png に、
 * 全ページを縮小して並べた一覧を outDir/all.png に保存する。前回の画像は消す(ページ数が減ったときに残らないように)
 * @returns {Promise<number>} ページ数
 */
export async function captureScreenshots(html, outDir, { handout = false } = {}) {
  mkdirSync(outDir, { recursive: true })
  for (const name of readdirSync(outDir)) if (name.endsWith('.png')) rmSync(join(outDir, name))
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await openPrint(browser, html, handout)
    const pages = page.locator('.pdf-page')
    const n = await pages.count()
    const digits = Math.max(2, String(n).length)
    const shots = []
    for (let i = 0; i < n; i++) {
      shots.push(await pages.nth(i).screenshot({ path: join(outDir, `${String(i + 1).padStart(digits, '0')}.png`) }))
    }
    // 一覧: COLUMNS 列に並べた 1 枚。ページの境目が分かるよう、灰色の地に細い隙間を空ける
    const COLUMNS = 4
    const sheet = await browser.newPage({ viewport: { width: COLUMNS * 560 + (COLUMNS + 1) * 16, height: 100 } })
    await sheet.setContent(`<!doctype html>
<style>
  body { margin: 0; padding: 16px; background: #ccc; display: grid; grid-template-columns: repeat(${COLUMNS}, 560px); gap: 16px; }
  img { width: 560px; display: block; box-shadow: 0 0 4px rgb(0 0 0 / 0.2); }
</style>
${shots.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}">`).join('\n')}`)
    await sheet.evaluate(() => Promise.all([...document.images].map((img) => img.decode())))
    await sheet.screenshot({ path: join(outDir, 'all.png'), fullPage: true })
    return n
  } finally {
    await browser.close()
  }
}

/**
 * はみ出しの検査: ビルドしたデッキを ?check-overflow で開き、開発時と同じ検査(src/devtools/overflow.ts)の結果を集める
 * (e2e/overflow.spec.ts と同じ手順)。
 * @returns {Promise<{ file: string; line: string; message: string }[]>} はみ出したスライド(原稿の位置と超過の内容)
 */
export async function checkOverflow(html) {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(html).href + '?check-overflow')
    await page.waitForSelector('[data-deck-ready]')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => {
      const slides = [...document.querySelectorAll('.deck .slide[data-slide-line]')]
      return slides.length > 0 && slides.every((s) => s.dataset.deckOverflow !== undefined)
    })
    await page.waitForTimeout(500) // フォントの読み込みの後の測り直しが落ち着くまで
    // await してから返す(finally でブラウザを閉じる前に結果を受け取る)
    return await page.evaluate(() =>
      [...document.querySelectorAll('.deck .slide[data-slide-line]')]
        .filter((s) => s.dataset.deckOverflow)
        .map((s) => ({ file: s.dataset.slideFile ?? 'deck.mdx', line: s.dataset.slideLine ?? '?', message: s.dataset.deckOverflow })),
    )
  } finally {
    await browser.close()
  }
}

/**
 * PDF を書き出す。ページの大きさは reveal が @page に書く大きさ(modes/reveal/slide-size.ts の PRINT_PAPER)で、
 * 余白なし・背景あり(README の「PDF 出力」で手で印刷するときの推奨設定と同じ)
 * @returns {Promise<number>} ページ数
 */
export async function exportPdf(html, outPath, { handout = false } = {}) {
  mkdirSync(dirname(outPath), { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await openPrint(browser, html, handout)
    const n = await page.locator('.pdf-page').count()
    await page.pdf({ path: outPath, preferCSSPageSize: true, printBackground: true })
    return n
  } finally {
    await browser.close()
  }
}
