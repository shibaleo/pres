import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import mdx from '@mdx-js/rollup'
import { mdxOptions } from './vite/mdx-options'

const BIB = 'src/references.bib'

/**
 * @font-face の src から woff2 以外(woff/ttf/eot/svg)を削り、
 * woff2 を持たない @font-face(= reveal white テーマの Source Sans Pro。
 * 我々は全フォントを上書きするので未使用)はブロックごと除去する。
 * アセット解決前に走らせるため enforce:'pre'。
 */
function woff2OnlyFonts(): Plugin {
  return {
    name: 'woff2-only-fonts',
    enforce: 'pre',
    transform(code, id) {
      // Vite は CSS モジュール id に ?used 等のクエリを付けるので拡張子判定はクエリを無視する
      if (!/\.css(\?|$)/.test(id)) return null
      let out = code
      // (1) reveal white テーマが @import する Source Sans Pro(未使用・全上書き済)を除去
      out = out.replace(/@import\s+url\([^)]*source-sans-pro[^)]*\)\s*;?/gi, '')
      // (2) @font-face の src から woff2 以外を削り、woff2 が無いものはブロックごと削除
      out = out.replace(/@font-face\s*\{([^}]*)\}/g, (block, body: string) => {
        const src = body.match(/src\s*:\s*([^;]+);?/i)
        if (!src) return block
        const kept = src[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /\.woff2\b/i.test(s) || /format\(\s*['"]?woff2/i.test(s))
        if (kept.length === 0) return ''
        return `@font-face {${body.replace(/src\s*:\s*[^;]+;?/i, `src: ${kept.join(', ')};`)}}`
      })
      return out === code ? null : out
    },
  }
}

/**
 * .bib はモジュールグラフに入らないので、編集したら全体を読み直す(引用の番号・文献リストを更新するため)
 */
function reloadOnBib(): Plugin {
  return {
    name: 'reload-on-bib',
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.bib')) return
      server.moduleGraph.invalidateAll()
      server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}

// `--mode single` で全アセットを 1 枚の index.html にインライン(subset 済 woff2 込み)。
export default defineConfig(({ command, mode }) => ({
  base: './',
  resolve: {
    // スライドがフォルダの深さに依存せず `@/components/...` で import できるように
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    woff2OnlyFonts(),
    reloadOnBib(),
    {
      enforce: 'pre',
      // 本番ビルドでは原稿の警告も失敗扱い。DECK_ALLOW_WARNINGS=1 で許可
      ...mdx(mdxOptions({ bibliography: BIB, strict: command === 'build' && process.env.DECK_ALLOW_WARNINGS !== '1' })),
    },
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    tailwindcss(),
    ...(mode === 'single' ? [viteSingleFile()] : []),
  ],
}))
