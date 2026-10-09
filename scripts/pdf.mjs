/**
 * PDF の書き出し: ビルドした単一 HTML(dist/index.html)を PDF 用の表示で開き、Chrome の印刷で PDF にする。
 *   pdf/slides.pdf   … ?print-pdf(段階表示はステップごとに 1 ページ)
 *   pdf/handout.pdf  … ?print-pdf&handout(配布用。各スライドを最後の状態の 1 ページだけ)
 * `npm run build:single` の後に走らせる(npm run pdf が両方を行う)。
 * ページの大きさは reveal が @page に書く大きさ(deck/slide-size.ts の PRINT_PAPER)で、余白なし・背景あり
 * (README の「PDF 出力」で手で印刷するときの推奨設定と同じ)。
 * ブラウザは e2e テストと同じく、入っている Chrome をそのまま使う。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = join(root, 'dist', 'index.html')
const outDir = join(root, 'pdf')

if (!existsSync(html)) {
  console.error('dist/index.html がありません。先に npm run build:single を実行してください')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
try {
  for (const [name, query] of [
    ['slides.pdf', '?print-pdf'],
    ['handout.pdf', '?print-pdf&handout'],
  ]) {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(html).href + query)
    await page.waitForFunction(() => document.querySelectorAll('.pdf-page .slide-number-pdf').length > 0)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500) // reveal がページを組み終え、番号を書き直すまで(e2e/print.spec.ts と同じ)
    const n = await page.locator('.pdf-page').count()
    await page.pdf({ path: join(outDir, name), preferCSSPageSize: true, printBackground: true })
    await page.close()
    console.log(`pdf/${name}(${n} ページ)を書き出しました`)
  }
} finally {
  await browser.close()
}
