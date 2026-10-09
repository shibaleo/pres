/**
 * PDF 用の表示(?print-pdf)を確かめる。reveal はこの表示でスライドをページ(.pdf-page)に並べる。
 */
import { expect, test } from '@playwright/test'
import { deckUrl } from './deck'

test('PDF 用の表示: 題の帯が切れず、ページ番号は「i/全体」、図のボタンは出ない', async ({ page }) => {
  await page.goto(deckUrl('', '?print-pdf'))
  await page.waitForFunction(() => document.querySelectorAll('.pdf-page .slide-number-pdf').length > 0)
  await page.waitForTimeout(500) // reveal がページを組み終え、番号を書き直すまで

  const pages = page.locator('.pdf-page')
  const n = await pages.count()
  expect(n).toBeGreaterThan(10)
  const numbers = await page.locator('.slide-number-pdf').allTextContents()
  expect(numbers).toEqual(numbers.map((_, i) => `${i + 1}/${n}`))

  // 題の帯はページの上端から始まり、ページの内側にある(余白が 0 にされて外に押し出されていない)
  const bands = await page.locator('.pdf-page > section > h2:first-child').evaluateAll((hs) =>
    hs.map((h) => {
      const r = h.getBoundingClientRect()
      const p = h.closest('.pdf-page')!.getBoundingClientRect()
      return r.left >= p.left - 1 && r.top >= p.top - 1 && r.height > 10
    }),
  )
  expect(bands.length).toBeGreaterThan(10)
  expect(bands.every(Boolean)).toBe(true)

  for (const b of await page.locator('.figure-buttons').all()) await expect(b).toBeHidden()
})
