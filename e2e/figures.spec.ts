/**
 * 図(src/components/ の visx の図)の操作を、実際のブラウザで確かめる。
 * ドラッグの座標は reveal の拡大縮小に左右されるので、拡大する大きさのウィンドウでも確かめる。
 */
import { expect, test } from '@playwright/test'
import { center, drag, gotoSlide, present } from './deck'

test.describe('一直線上の 4 点', () => {
  for (const viewport of [
    { width: 1900, height: 1080 }, // reveal がスライドを拡大する
    { width: 1000, height: 900 }, // 縮小する(縦長)
  ]) {
    test(`点と線分の端はポインタにぴったりついてくる(${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await gotoSlide(page, '一直線上の 4 点')
      for (const target of [present(page).locator('.figure-point').nth(1), present(page).locator('.figure-handle').nth(0)]) {
        const from = await center(target)
        await drag(page, { x: from.x + 3, y: from.y - 2 }, 60, 40) // 中心から少しずれた所をつかむ
        const to = await center(target)
        expect(to.x).toBeCloseTo(from.x + 60, 0)
        expect(to.y).toBeCloseTo(from.y + 40, 0)
      }
    })
  }

  test('点は線分とは独立に動き、リセットで元に戻る', async ({ page }) => {
    await gotoSlide(page, '一直線上の 4 点')
    const slide = present(page)
    const points = () => slide.locator('.figure-point').evaluateAll((els) => els.map((e) => `${e.getAttribute('cx')},${e.getAttribute('cy')}`))
    const initial = await points()
    await drag(page, await center(slide.locator('.figure-point').first()), 20, 60)
    const moved = await points()
    expect(moved[0]).not.toBe(initial[0])
    // 線分の端を動かしても点は動かない
    await drag(page, await center(slide.locator('.figure-handle').nth(1)), 0, -50)
    expect(await points()).toEqual(moved)
    // リセット(普段は薄く、マウスを乗せるとはっきり出る)
    const reset = slide.getByRole('button', { name: '図を元に戻す' })
    expect(Number(await reset.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(1)
    await reset.click()
    expect(await points()).toEqual(initial)
  })

  test('点は Tab で選び、矢印キーで動かせる(スライドは移らない)', async ({ page }) => {
    await gotoSlide(page, '一直線上の 4 点')
    const hash = await page.evaluate(() => location.hash)
    const point = present(page).getByRole('button', { name: '点 b' })
    const before = Number(await point.locator('circle').getAttribute('cx'))
    await point.focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    expect(Number(await point.locator('circle').getAttribute('cx'))).toBeGreaterThan(before)
    expect(await page.evaluate(() => location.hash)).toBe(hash)
  })
})

test('対数螺旋: スライダーで形が変わり、曲線の上の点はキーボードでも曲線に沿って動く', async ({ page }) => {
  await gotoSlide(page, '対数螺旋')
  const slide = present(page)
  const a = slide.locator('input[type=range]').first()
  await a.fill('1')
  await expect(slide.locator('.figure-controls output').first()).toHaveText('1.00')
  const glider = slide.getByRole('button', { name: /曲線の上の点/ })
  const before = await glider.getAttribute('cx')
  await glider.focus()
  await page.keyboard.press('Shift+ArrowUp')
  expect(await glider.getAttribute('cx')).not.toBe(before)
})

test.describe('カスプの速度と法線', () => {
  test('再生中は動き、一時停止中は曲線に沿ってドラッグでき、原点では速度ベクトルだけが消える', async ({ page }) => {
    await gotoSlide(page, 'カスプの速度と法線')
    const slide = present(page)
    const point = slide.locator('.figure-point')
    const a = await center(point)
    await page.waitForTimeout(400)
    expect(await center(point)).not.toEqual(a) // 再生中は動く

    await slide.getByRole('button', { name: '一時停止' }).click()
    await expect(slide.getByRole('button', { name: '再生' })).toBeVisible()
    const b = await center(point)
    await page.waitForTimeout(400)
    expect(await center(point)).toEqual(b) // 止まっている

    // 原点(軸の交点)へドラッグ: 速度ベクトルは消え、単位法線ベクトルは残る
    const origin = await slide.locator('svg.figure').evaluate((svg: SVGSVGElement) => {
      const r = svg.getBoundingClientRect()
      const vb = svg.viewBox.baseVal
      const unit = vb.height / 3 // 縦は −1.5〜1.5
      return { x: r.left + (0.3 * unit * r.width) / vb.width, y: r.top + (1.5 * unit * r.height) / vb.height }
    })
    await drag(page, b, origin.x - b.x, origin.y - b.y)
    await expect(slide.locator('.figure-velocity')).toHaveCount(0)
    await expect(slide.locator('.figure-normal')).toHaveCount(1)
  })
})

test('正規分布の族: 点を動かすと値と曲線が変わる', async ({ page }) => {
  await gotoSlide(page, '正規分布の族')
  const slide = present(page)
  const before = await slide.locator('.figure-series').nth(1).getAttribute('d')
  await drag(page, await center(slide.locator('.figure-series-point').nth(1)), 60, 50)
  await expect(slide.locator('.figure-legend').nth(1)).not.toHaveText('(0.00, 0.50)')
  expect(await slide.locator('.figure-series').nth(1).getAttribute('d')).not.toBe(before)
})

test('地球儀: 表示中のスライドのときだけ自転し、一時停止できる', async ({ page }) => {
  const land = () => page.locator('.figure-globe-land').evaluateAll((els) => els.map((e) => e.getAttribute('d')).join('|'))
  await gotoSlide(page, 'INTRODUCTION') // 地球儀のスライドは隠れている
  const hidden = await land()
  await page.waitForTimeout(500)
  expect(await land()).toBe(hidden)

  await gotoSlide(page, '地球儀')
  const a = await land()
  await page.waitForTimeout(500)
  expect(await land()).not.toBe(a)

  await present(page).getByRole('button', { name: '一時停止' }).click()
  const b = await land()
  await page.waitForTimeout(500)
  expect(await land()).toBe(b)
})
