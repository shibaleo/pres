/**
 * 文書の中のリンク(#名前。\ref・[文字](#名前)・\eqref)を押すと、その飛び先を含むスライドへ移る(src/deck/links.ts)。
 * 飛び先はスライドの題の \label・定理のラベル・式の番号。ここでは既定のモード(reveal)で確かめる
 * (ほかのモードでも同じ仕組みで、モードが登録した「このスライドへ移る」を使う)。
 */
import { expect, test } from '@playwright/test'
import { gotoSlide, present } from './deck'

for (const href of ['#sec:main', '#thm:main']) {
  test(`legendre: 「主定理の重要性」の ${href} のリンクで、主定理のスライドへ移る`, async ({ page }) => {
    await gotoSlide(page, 'legendre', '主定理の重要性')
    await present(page).locator(`a[href="${href}"]`).first().click()
    // 飛び先(スライドの id・定理の id)を含むスライド「主定理の紹介」が表示中になる
    await expect(present(page).locator('h2')).toContainText('主定理の紹介')
  })
}

test('landau: 別のスライドの式を指す \\eqref で、その式のスライドへ移る', async ({ page }) => {
  await gotoSlide(page, 'landau', '')
  // 別のスライドの式を指している最初の \eqref のリンク
  const found = await page.evaluate(() => {
    for (const a of document.querySelectorAll('.slide[data-slide-line] a[href^="#mjx-eqn"]')) {
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href')!.slice(1)))
      const from = a.closest('.slide[data-slide-line]')!
      const to = target?.closest('.slide[data-slide-line]')
      if (to && to !== from) return { from: from.querySelector('h2')!.textContent!, to: to.querySelector('h2')!.textContent!, href: a.getAttribute('href')! }
    }
    return null
  })
  expect(found).not.toBeNull()
  await gotoSlide(page, 'landau', found!.from)
  await present(page).locator(`a[href="${found!.href}"]`).first().click({ force: true })
  await expect(present(page).locator('h2')).toHaveText(found!.to)
})
