/**
 * 各モードを本番のビルド(dist/<デッキ>/index.html。デッキの motion.ts のモードと、style.css の見た目)で動かして確かめる。
 * ほかの e2e テストは reveal モードのビルドを使うので、reveal 以外のモードの動きはここで見る。
 *
 * 今のスライドは、モードとの約束の「今のスライドの知らせ」(deck/mode.ts の deck:present。detail はスライドの要素)で読む。
 */
import { expect, test, type Page } from '@playwright/test'
import { deckUrl, expectBuilt } from './deck'

/** 見本のデッキと、そのモード */
const DECKS = {
  landau: 'reveal',
  manifold: 'impress',
  manual: 'shower',
  legendre: 'spectacle',
  'trial-balance': 'swiper',
} as const

/** ページを開く前に、今のスライドの知らせを window.__present(スライドの原稿の行。スライドでない step は '')に写す */
async function watchPresent(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('deck:present', (e) => {
      ;(window as unknown as { __present: string }).__present = ((e as CustomEvent<Element>).detail as HTMLElement).dataset.slideLine ?? ''
    })
  })
}
const presentLine = (page: Page) => page.evaluate(() => (window as unknown as { __present?: string }).__present)

async function open(page: Page, deck: string, query = '') {
  const [built, missing] = expectBuilt(deck, 'deck')
  expect(built, missing).toBe(true)
  await watchPresent(page)
  await page.goto(deckUrl(deck, '', query, 'deck'))
  await page.waitForSelector('[data-deck-ready]')
}

for (const [deck, mode] of Object.entries(DECKS)) {
  test(`${deck}(${mode}): 本番のモードで起動し、→ で次のスライドへ進む`, async ({ page }) => {
    // Shower は一覧から始まるので、全画面(?full)で開く
    await open(page, deck, mode === 'shower' ? '?full' : '')
    const mounted = { reveal: '.reveal', impress: '#impress', shower: '.shower-slides', spectacle: '.spectacle-body', swiper: '.swiper' }[mode]
    await expect(page.locator(mounted).first()).toBeAttached()
    await expect.poll(() => presentLine(page)).not.toBeUndefined()
    const first = await presentLine(page)
    // 段階表示のあるスライドでは段が進むだけなので、何度か押す
    for (let i = 0; i < 4 && (await presentLine(page)) === first; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(1300)
    }
    expect(await presentLine(page)).not.toBe(first)
  })
}

test('manifold(impress の zoom): 全体の見渡しから始まり、→ で表紙へ寄り、O で見渡しと行き来する', async ({ page }) => {
  await open(page, 'manifold')
  await expect(page.locator('#overview-start')).toHaveClass(/active/)
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#impress .step.slide').first()).toHaveClass(/active/)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1200)
  const slide = await presentLine(page)
  await page.keyboard.press('o')
  await expect(page.locator('#overview')).toHaveClass(/active/)
  await page.keyboard.press('o')
  await expect.poll(() => presentLine(page)).toBe(slide)
})

test('trial-balance(Swiper): Esc で一覧を開き、押したスライドへ移って一覧を閉じる', async ({ page }) => {
  await open(page, 'trial-balance')
  await page.keyboard.press('Escape')
  await expect(page.locator('.swiper')).toHaveClass(/overview/)
  const target = page.locator('.swiper-slide').nth(2)
  const line = await target.getAttribute('data-slide-line')
  await target.click()
  await expect(page.locator('.swiper')).not.toHaveClass(/overview/)
  await expect.poll(() => presentLine(page)).toBe(line)
})

test('landau(reveal のスクロールビュー): ?view=scroll でスライドを縦に並べ、スクロールで進む', async ({ page }) => {
  await open(page, 'landau', '?view=scroll')
  const pages = await page.locator('.scroll-page').count()
  expect(pages).toBe(await page.locator('.reveal .slides .slide[data-slide-line]').count())
  const first = await presentLine(page)
  await page.mouse.move(640, 360)
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(300)
  }
  await expect.poll(() => presentLine(page)).not.toBe(first)
})

test('demonstration: 枠の中に、各モードの本物のデッキが起動する', async ({ page }) => {
  await open(page, 'demonstration')
  for (const [deck, mode] of Object.entries(DECKS)) {
    // そのデッキを埋め込んだスライドへ移る(枠は表示されてから読み込む)
    const slide = page.locator(`.reveal .slides section.slide:has(iframe[src*="/${deck}/index.html"]:not([src*="view="]))`)
    const indices = await slide.evaluate((el) => {
      const sections = [...document.querySelectorAll('.reveal .slides > section')]
      const top = el.parentElement?.matches('section.stack') ? el.parentElement : el
      return { h: sections.indexOf(top as Element), v: top === el ? 0 : [...top!.children].indexOf(el) }
    })
    await page.evaluate(({ h, v }) => (location.hash = `#/${h}/${v}`), indices)
    const frame = page.frameLocator(`section.present:not(.stack) iframe[src*="/${deck}/index.html"]`)
    // 起動の印(data-deck-ready)と、そのモードの要素(Spectacle は印の後にスライドを描く)
    const mounted = { reveal: '.reveal', impress: '#impress', shower: '.shower-slides', spectacle: '.spectacle-body', swiper: '.swiper' }[mode]
    await expect(frame.locator('html[data-deck-ready]'), `${deck} が枠の中で起動しない`).toBeAttached({ timeout: 30000 })
    await expect(frame.locator(mounted).first(), `${deck} が枠の中で ${mode} モードで描かれない`).toBeAttached({ timeout: 15000 })
  }
})

test('manual(Shower): 全画面で、入るスライドに motion.ts の遷移の動きが付く(戻るときは逆向き)', async ({ page }) => {
  await open(page, 'manual', '?full')
  const active = () => page.locator('.shower .slide.active')
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => active().evaluate((e) => getComputedStyle(e).animationName)).toBe('shower-slide')
  expect(await page.evaluate(() => document.body.dataset.direction)).toBe('forward')
  await page.waitForTimeout(800)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => page.evaluate(() => document.body.dataset.direction)).toBe('backward')
})

test('段の現れ方(motion.ts の step): reveal は fragment の型、impress は CSS で、出ていない段の形が決まる', async ({ page }) => {
  // landau(reveal・fade-up): 現れる側の fragment に reveal の型 fade-up が付き、出ていない間は下にずれている
  await open(page, 'landau')
  expect(await page.evaluate(() => document.documentElement.dataset.stepEffect)).toBe('fade-up')
  const fragment = page.locator('.reveal .fragment.fade-up').first()
  await expect(fragment).toBeAttached()
  expect(await fragment.evaluate((e) => getComputedStyle(e).transform)).not.toBe('none')
  // manifold(impress・blur): 出ていない段はぼけている
  await open(page, 'manifold')
  expect(await page.evaluate(() => document.documentElement.dataset.stepEffect)).toBe('blur')
  const hidden = page.locator('#impress .overlay.overlay-hidden').first()
  expect(await hidden.evaluate((e) => getComputedStyle(e).filter)).toContain('blur')
})

test('見本のデッキに、モードのライブラリの既定の見た目が当たっている', async ({ page }) => {
  const look: Record<string, (p: Page) => Promise<string>> = {
    // reveal black の地
    landau: (p) => p.locator('.reveal .slides .slide.present').first().evaluate((e) => getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(e).textAlign),
    // impress デモのスライドの角丸
    manifold: (p) => p.locator('#impress .slide').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius),
    // Shower ribbon のリボン
    manual: (p) => p.locator('.shower .slide .page-number').first().evaluate((e) => getComputedStyle(e).backgroundColor),
    // Spectacle 既定のテーマの地
    legendre: (p) => p.locator('.spectacle-body > .slide').first().evaluate((e) => getComputedStyle(e).color),
    // Swiper デモの面
    'trial-balance': (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor),
  }
  const expected: Record<string, string> = {
    landau: 'rgb(25, 25, 25)|center',
    manifold: '10px',
    manual: 'rgb(204, 0, 0)',
    legendre: 'rgb(235, 229, 218)',
    'trial-balance': 'rgb(238, 238, 238)',
  }
  for (const deck of Object.keys(look)) {
    await open(page, deck)
    expect(await look[deck](page), deck).toBe(expected[deck])
  }
})
