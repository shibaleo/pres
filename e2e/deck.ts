import { pathToFileURL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'

/**
 * 全デッキの名前(decks/<名前>/deck.mdx を持つフォルダと、1 ファイルのデッキ decks/<名前>.mdx)。
 * デッキに依らない規則(はみ出し・書体)のテストは全デッキで回す。
 * ビルドしていないデッキがあれば、そのテストがビルドが無いと報告する(expectBuilt)
 */
export const allDecks = readdirSync(resolve('decks'), { withFileTypes: true })
  .flatMap((d) =>
    d.isDirectory() && existsSync(join('decks', d.name, 'deck.mdx')) ? [d.name] : d.isFile() && d.name.endsWith('.mdx') ? [d.name.slice(0, -4)] : [],
  )
  .sort()

/**
 * 開くビルド。reveal は reveal モードでビルドしたもの(dist/<名前>/reveal/index.html。npm run build:single -- --mode reveal)で、
 * reveal の並び・hash・PDF 用の表示を使うテストが開く(デッキの動きの設定(motion.ts)で既定のモードが別のデッキもあるため)。
 * deck は本番のビルド(dist/<名前>/index.html。デッキのモード)で、モードに依らないテスト(はみ出し)が開く
 */
export type Build = 'reveal' | 'deck'
const builtFile = (deck: string, build: Build) => join('dist', deck, ...(build === 'reveal' ? ['reveal'] : []), 'index.html')

/** デッキがビルドされているか。無ければ、その場所とビルドのコマンドを報告する */
export function expectBuilt(deck: string, build: Build = 'reveal') {
  const command = build === 'reveal' ? 'npm run build:single -- --mode reveal' : 'npm run build:single'
  return [existsSync(builtFile(deck, build)), `${builtFile(deck, build).split('\\').join('/')} が無い(${command})`] as const
}

/** ビルドしたデッキの単一 HTML の URL(hash でスライドを指定する。例: '#/7/2') */
export const deckUrl = (deck: string, hash = '', query = '', build: Build = 'reveal') =>
  pathToFileURL(resolve(builtFile(deck, build))).href + query + hash

/**
 * 題に text を含むスライドへ移動する(スライドの番号は原稿を足し引きすると変わるので、題で探す)。
 * reveal の並び(横の位置 h、縦の束の中の位置 v)を DOM から求めて、URL の hash で移動する。
 */
export async function gotoSlide(page: Page, deck: string, text: string, query = '') {
  await page.goto(deckUrl(deck, '', query))
  await page.waitForSelector('[data-deck-ready]')
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
