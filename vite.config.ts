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
 * .bib と \input で取り込んだ .mdx はモジュールグラフに入らない(slides.mdx の変換中に読む)ので、
 * 編集したら全体を読み直す(番号・文献リストを更新するため)
 */
function reloadOnDeckSources(): Plugin {
  return {
    name: 'reload-on-deck-sources',
    handleHotUpdate({ file, server, modules }) {
      // \input で取り込むファイル = JS から import されていない .mdx / .md。
      // modules が空とは限らない: Tailwind が class 名を探すために .mdx を CSS の依存として登録するので、
      // ブラウザが CSS を読んだ後は、このファイル自身が「CSS から読まれるモジュール」として入ってくる。
      // それを取り込み元と見なさないと、CSS だけ入れ替わってデッキが古いままになる
      const importedByJs = modules.some((m) => m.file === file && [...m.importers].some((i) => !/\.css($|\?)/.test(i.id ?? '')))
      const included = /\.mdx?$/.test(file) && !importedByJs
      if (!file.endsWith('.bib') && !included) return
      // Vite 6 では変換結果を環境(client など)ごとに持つ。互換用の server.moduleGraph.invalidateAll() では
      // それが消えず、読み直しても古い原稿のままになるので、環境ごとに消す
      for (const env of Object.values(server.environments)) env.moduleGraph.invalidateAll()
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
    reloadOnDeckSources(),
    {
      enforce: 'pre',
      // 本番ビルドでは原稿の警告も失敗扱い。DECK_ALLOW_WARNINGS=1 で許可
      ...mdx(mdxOptions({ bibliography: BIB, strict: command === 'build' && process.env.DECK_ALLOW_WARNINGS !== '1' })),
    },
    react({
      include: /\.(mdx|js|jsx|ts|tsx)$/,
      // 原稿のコンパイル結果は MathJax の SVG を含み、開発時(要素ごとに原稿の位置が付く)は 500KB を超える。
      // Babel はその大きさで「整形を省いた」と知らせる([BABEL] Note: … deoptimised the styling …)ので、
      // 自動生成のコードである .mdx は最初から整形しない出力にする(ほかのファイルは既定と同じく整形する)
      babel: (id) => ({ compact: /\.mdx(\?|$)/.test(id) }),
    }),
    tailwindcss(),
    ...(mode === 'single' ? [viteSingleFile()] : []),
  ],
}))
