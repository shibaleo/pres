/**
 * スクリーンショット: ビルドした単一 HTML(dist/index.html)を PDF 用の表示(?print-pdf)で開き、
 * 各ページ(段階表示はステップごとに 1 ページ)を screenshots/NN.png に、全ページを並べた一覧を screenshots/all.png に保存する。
 * 見た目の確認用。`npm run build:single` の後に走らせる(npm run shots が両方を行う)。
 * --handout を付けると配布用の表示(?print-pdf&handout。段階表示は最後の状態の 1 ページだけ)で撮る。
 * ブラウザは e2e テストと同じく、入っている Chrome をそのまま使う。
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = join(root, 'dist', 'index.html')
const handout = process.argv.includes('--handout')
const outDir = join(root, 'screenshots', handout ? 'handout' : '')

if (!existsSync(html)) {
  console.error('dist/index.html がありません。先に npm run build:single を実行してください')
  process.exit(1)
}

// 前回の画像を消す(ページ数が減ったときに古いページが残らないように)
mkdirSync(outDir, { recursive: true })
for (const name of readdirSync(outDir)) if (name.endsWith('.png')) rmSync(join(outDir, name))

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(html).href + (handout ? '?print-pdf&handout' : '?print-pdf'))
  await page.waitForFunction(() => document.querySelectorAll('.pdf-page .slide-number-pdf').length > 0)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500) // reveal がページを組み終え、番号を書き直すまで(e2e/print.spec.ts と同じ)

  const pages = page.locator('.pdf-page')
  const n = await pages.count()
  const width = String(n).length
  const shots = []
  for (let i = 0; i < n; i++) {
    shots.push(await pages.nth(i).screenshot({ path: join(outDir, `${String(i + 1).padStart(Math.max(2, width), '0')}.png`) }))
  }

  // 一覧: 全ページを縮小して COLUMNS 列に並べた 1 枚(all.png)。ページの境目が分かるよう、灰色の地に細い隙間を空ける
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

  const dir = handout ? 'screenshots/handout/' : 'screenshots/'
  console.log(`${n} ページと一覧(all.png)を ${dir} に保存しました`)
} finally {
  await browser.close()
}
