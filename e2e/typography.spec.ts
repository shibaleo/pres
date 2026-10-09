/**
 * 書体の規則を、実際に描いたデッキの全要素で確かめる。
 */
import { expect, test } from '@playwright/test'
import { deckUrl } from './deck'

test('本文の書体(明朝)のまま、本文より太くなる要素はない(太くする所はゴシックで際立たせる)', async ({ page }) => {
  await page.goto(deckUrl())
  await page.waitForSelector('.reveal.ready')
  const bold = await page.evaluate(() => {
    const found: string[] = []
    // 書体の名前の書き方(引用符・空白)をそろえて比べる
    const norm = (f: string) => f.replace(/["']/g, '').replace(/\s*,\s*/g, ',').trim()
    // reveal は遠いスライドを描かない(display: none)ので、測る間だけすべて表示する
    for (const s of document.querySelectorAll<HTMLElement>('.reveal .slides section')) s.style.display = 'block'
    for (const el of document.querySelectorAll<HTMLElement>('.reveal .slides *')) {
      if (!el.textContent?.trim()) continue
      const style = getComputedStyle(el)
      // 本文の書体と見出しの書体はその要素の範囲のトークン(プリセットで変わる)。
      // 本文もゴシックのプリセット(manual)では、太さで強調するので対象にしない
      const body = norm(style.getPropertyValue('--font-body'))
      const heading = norm(style.getPropertyValue('--font-heading'))
      // 太字かどうかは、その範囲の本文の太さ(トークン --body-weight。クローンやプリセットで変わる)より太いかで決める
      const bodyWeight = Number(style.getPropertyValue('--body-weight'))
      if (Number(style.fontWeight) > bodyWeight && body !== heading && norm(style.fontFamily) === body) {
        found.push(`<${el.tagName.toLowerCase()}> ${el.textContent.trim().slice(0, 30)}`)
      }
    }
    return found
  })
  expect(bold).toEqual([])
})

test('数式の字形は塗りだけで描き、輪郭に線を足さない(リンクの中も。PDF で太く見えないように)', async ({ page }) => {
  await page.goto(deckUrl())
  await page.waitForSelector('.reveal.ready')
  const stroked = await page.evaluate(() => {
    const glyphs = [...document.querySelectorAll('.reveal mjx-container[jax="SVG"] :is(path, use)[data-c]')]
    const linked = glyphs.filter((g) => g.closest('a')).length
    return { total: glyphs.length, linked, stroked: glyphs.filter((g) => getComputedStyle(g).stroke !== 'none').length }
  })
  expect(stroked.total).toBeGreaterThan(0)
  expect(stroked.linked).toBeGreaterThan(0) // \eqref のリンクの中の字形も調べている
  expect(stroked.stroked).toBe(0)
})
