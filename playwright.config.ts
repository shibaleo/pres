import { defineConfig } from '@playwright/test'

/**
 * e2e テスト: ビルドしたデッキの単一 HTML(dist/<デッキ>/index.html。図の操作は legendre、PDF の段階表示は landau)を実際のブラウザで開き、図の操作(ドラッグ・キーボード・
 * 再生と一時停止)と PDF 用の表示を確かめる。`npm run build:single` の後に走らせる(npm run check がそうする)。
 * ブラウザは入っている Chrome をそのまま使う(Playwright のブラウザはダウンロードしない)。
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    channel: 'chrome',
    viewport: { width: 1244, height: 700 },
  },
})
