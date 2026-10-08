import { defineConfig } from 'vitest/config'

// 原稿変換(vite/deck/)の単体テスト。ブラウザ側の設定(vite.config.ts)は読み込まない
export default defineConfig({
  test: {
    include: ['vite/**/*.test.ts'],
    environment: 'node',
  },
})
