import { defineConfig } from 'vitest/config'

// テストは 2 群:
//   transform … 原稿変換(vite/)の単体・結合テスト。Node だけで動く
//   render    … デッキ(src/slides.mdx)を実際に描いて確かめるテスト。開発時と同じ Vite の設定
//               (MDX の変換・@/ の別名・画像の import)で読み込み、DOM は happy-dom
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'transform', include: ['vite/**/*.test.ts'], environment: 'node' } },
      { extends: './vite.config.ts', test: { name: 'render', include: ['src/**/*.test.tsx'], environment: 'happy-dom' } },
    ],
  },
})
