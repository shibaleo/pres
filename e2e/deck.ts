import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'

/** ビルドした単一 HTML の URL(hash でスライドを指定する。例: '#/7/2') */
export const deckUrl = (hash = '', query = '') =>
  pathToFileURL(resolve('dist/index.html')).href + query + hash

/**
 * 題に text を含むスライドへ移動する(スライドの番号は原稿を足し引きすると変わるので、題で探す)。
 * reveal の並び(横の位置 h、縦の束の中の位置 v)を DOM から求めて、URL の hash で移動する。
 */
export async function gotoSlide(page: Page, text: string, query = '') {
  await page.goto(deckUrl('', query))
  await page.waitForSelector('.reveal.ready')
  const hash = await page.evaluate((t) => {
    const top = [...document.querySelectorAll('.reveal .slides > section')]
    for (let h = 0; h < top.length; h++) {
      const leaves = top[h].querySelector(':scope > section') ? [...top[h].querySelectorAll(':scope > section')] : [top[h]]
      for (let v = 0; v < leaves.length; v++) if (leaves[v].querySelector('h1,h2')?.textContent?.includes(t)) return `#/${h}/${v}`
    }
    throw new Error(`題に「${t}」を含むスライドがありません`)
  }, text)
  await page.evaluate((h) => (location.hash = h), hash)
  await page.waitForFunction((h) => location.hash === h && !!document.querySelector('section.present:not(.stack)'), hash)
  await page.waitForTimeout(300) // reveal のスライドの切り替え
}

/** いま表示しているスライド(縦の束ではなく 1 枚) */
export const present = (page: Page) => page.locator('section.present:not(.stack)')

/** 要素の画面上の中心 */
export async function center(target: Locator) {
  const box = (await target.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** from から (dx, dy) だけマウスでドラッグする(途中を何回かに分けて動かす) */
export async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let k = 1; k <= 6; k++) await page.mouse.move(from.x + (dx * k) / 6, from.y + (dy * k) / 6)
  await page.mouse.up()
}
