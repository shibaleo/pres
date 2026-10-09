import { defineConfig } from '@playwright/test'

/**
 * e2e テスト: ビルドした単一 HTML(dist/index.html)を実際のブラウザで開き、図の操作(ドラッグ・キーボード・
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
