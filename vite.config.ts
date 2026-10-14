import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import type { Plugin, UserConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { basename, relative } from 'node:path'
import mdx from '@mdx-js/rollup'
import { mdxOptions } from './vite/mdx-options.ts'
import { DECK_NAME, ROOT, bibliographyFor, deckDirOf, deckTitle, listDecks, resolveDeck } from './vite/decks.js'

/** デッキのページの入口(仮想モジュール)の URL。/@deck/<名前> */
const ENTRY_PREFIX = '/@deck/'
const ENTRY_ID = '\0deck-entry:'

/** ルートからのパスを、Vite の URL(/ で始まるルート相対)にする */
const rootUrl = (file: string) => '/' + relative(ROOT, file).split('\\').join('/')

/**
 * デッキのページ。index.html(全デッキで共通の器)に、デッキの題と入口のスクリプトを入れる。
 *   - 開発時: 1 つの開発サーバーで全デッキを配信する。/<名前>/ がそのデッキ、/ はデッキの一覧
 *   - ビルド: deck に渡した 1 つのデッキだけを組む
 * 入口(/@deck/<名前>)は「土台(src/main.tsx)→ デッキの style.css → 原稿」の順に読み込んで起動する
 * 仮想モジュールで、ページごとに違うのはこの入口だけ。
 */
function decksPlugin(deck: string | undefined): Plugin {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  /** 開発時のデッキの一覧(/ で開くページ) */
  const indexPage = () => {
    const items = listDecks().map((name) => `<li><a href="./${name}/">${escape(deckTitle(resolveDeck(name)))}</a> <code>${name}</code></li>`)
    return `<!doctype html><html lang="ja"><head><meta charset="UTF-8" /><title>デッキの一覧</title></head>
<body style="font-family: sans-serif; margin: 2em"><h1>デッキの一覧</h1><ul>${items.join('')}</ul>
<p>decks/&lt;名前&gt;/ に deck.mdx と style.css を置くと一覧に加わります(npm run new -- &lt;名前&gt;)。</p></body></html>`
  }
  return {
    name: 'decks',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split(/[?#]/)[0]
        if (path === '/' || path === '/index.html') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(indexPage())
          return
        }
        // /<名前> は /<名前>/ に揃える(ページの中の相対パスと sessionStorage の鍵が 1 つになるように)
        const m = path.match(/^\/([^/.@]+)$/)
        if (m && DECK_NAME.test(m[1])) {
          res.statusCode = 302
          res.setHeader('Location', `/${m[1]}/`)
          res.end()
          return
        }
        next()
      })
    },
    resolveId(id) {
      if (id.startsWith(ENTRY_PREFIX)) return ENTRY_ID + id.slice(ENTRY_PREFIX.length)
    },
    load(id) {
      if (!id.startsWith(ENTRY_ID)) return
      const d = resolveDeck(id.slice(ENTRY_ID.length))
      const main = rootUrl(d.main)
      return [
        `import { startDeck } from '/src/main.tsx'`,
        `import '${rootUrl(d.style)}'`,
        `import Slides, { deckWarnings } from '${main}'`,
        `const update = startDeck({ Slides, warnings: deckWarnings })`,
        // 原稿の更新(HMR)はここで受け取り、同じ App を新しい原稿で描き直す(ページを読み直さないので、
        // 表示中のスライドの位置が保たれる)。原稿は部品と警告の一覧を export するので、React の差し替えの境界にならない
        `if (import.meta.hot) import.meta.hot.accept('${main}', (m) => m && update({ Slides: m.default, warnings: m.deckWarnings }))`,
      ].join('\n')
    },
    transformIndexHtml: {
      // Vite が HTML の script を集めて束ねる前に入れる(後に入れると、ビルドで入口が束ねられない)
      order: 'pre',
      handler(html, ctx) {
        // 開発時は URL の最初の段がデッキの名前(/landau/ → landau)。無いデッキは resolveDeck がエラーにする
        const name = deck ?? decodeURIComponent((ctx.originalUrl ?? '/').split(/[?#]/)[0].split('/')[1] ?? '')
        const d = resolveDeck(name)
        return html
          .replace(/<title>.*<\/title>/, `<title>${escape(deckTitle(d))}</title>`)
          .replace('</body>', `  <script type="module" src="${ENTRY_PREFIX}${d.name}"></script>\n  </body>`)
      },
    },
  }
}

/**
 * @font-face の src から woff2 以外(woff/ttf/eot/svg)を削り、woff2 を持たない @font-face は
 * ブロックごと除去する。reveal の white テーマは Source Sans Pro を woff の base64 で埋め込んでいるが、
 * 書体はすべてテーマで上書きしていて使わないので、これで単一 HTML から外れる。
 * アセット解決前に走らせるため enforce:'pre'。
 */
function woff2OnlyFonts(): Plugin {
  return {
    name: 'woff2-only-fonts',
    enforce: 'pre',
    transform(code, id) {
      // Vite は CSS モジュール id に ?used 等のクエリを付けるので拡張子判定はクエリを無視する
      if (!/\.css(\?|$)/.test(id)) return null
      const out = code.replace(/@font-face\s*\{([^}]*)\}/g, (block, body: string) => {
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
 * .bib と \input で取り込んだ .mdx はモジュールグラフに入らない(deck.mdx の変換中に読む)ので、
 * 編集したら、そのファイルが属するデッキの原稿(decks/<名前>/deck.mdx)を変換し直す(番号・文献リストを更新するため)。
 * 原稿の更新はページの入口が受け取って描き直すので(decksPlugin)、ページは読み直さず、ほかのデッキにも影響しない。
 * デッキの外のファイル(複数のデッキで共有して \import するものなど)は、どのデッキの原稿かが分からないので、
 * 全体を読み直す。
 */
function reloadOnDeckSources(): Plugin {
  return {
    name: 'reload-on-deck-sources',
    hotUpdate({ file, modules }) {
      // \input で取り込むファイル = JS から import されていない .mdx / .md。
      // modules が空とは限らない: Tailwind が class 名を探すために .mdx を CSS の依存として登録するので、
      // ブラウザが CSS を読んだ後は、このファイル自身が「CSS から読まれるモジュール」として入ってくる。
      // それを取り込み元と見なさないと、CSS だけ入れ替わってデッキが古いままになる
      const importedByJs = modules.some((m) => m.file === file && [...m.importers].some((i) => !/\.css($|\?)/.test(i.id ?? '')))
      const included = /\.mdx?$/.test(file) && !importedByJs
      if (!file.endsWith('.bib') && !included) return
      const graph = this.environment.moduleGraph
      const dir = deckDirOf(file)
      const main = dir && graph.getModulesByFile(normalizePath(resolveDeck(basename(dir)).main))
      if (main && main.size > 0) {
        // 原稿の変換結果を捨てて、原稿の更新として扱う(入口の import.meta.hot.accept が受け取る)
        for (const m of main) graph.invalidateModule(m)
        return [...main]
      }
      // 変換結果は環境(client など)ごとに持つので、この環境の分を消して読み直す
      graph.invalidateAll()
      this.environment.hot.send({ type: 'full-reload' })
      return []
    },
  }
}

export type DeckBuild = {
  /** ビルドするデッキの名前(decks/<名前>/) */
  deck: string
  /** 全アセットを 1 枚の index.html にインラインする(subset 済 woff2 込み)。ダブルクリックで開ける配布用 */
  single?: boolean
  /** 原稿の警告(参照先の無い \ref など)があってもビルドする。既定では警告も失敗扱い */
  allowWarnings?: boolean
}

/**
 * 設定。build を渡すとそのデッキのビルド(出力は dist/<名前>/)、渡さなければ全デッキを配信する開発サーバー
 * (テストもこちら)。デッキのビルドは scripts/deck.mjs がデッキの名前を引数で受け取り、この関数に渡して行う
 * (Vite のコマンドは任意の引数を設定に渡せないので、vite build を直接は使わない)。
 */
export function deckConfig(build?: DeckBuild): UserConfig {
  const out = build && resolveDeck(build.deck)
  return {
    base: './',
    resolve: {
      // スライドがフォルダの深さに依存せず `@/components/...` で import できるように
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: out ? { outDir: out.outDir, emptyOutDir: true } : undefined,
    // 開発サーバーが起動時に依存パッケージを束ねるための起点。index.html には入口の script が無い(デッキごとに
    // decksPlugin が入れる)ので明示する。無いと、デッキを開いてから依存を見つけて束ね直し、開いている全ページを読み直す
    optimizeDeps: { entries: ['src/**/*.tsx', '!src/**/*.test.tsx', 'decks/**/*.{ts,tsx,js,jsx}'] },
    plugins: [
      decksPlugin(out?.name),
      woff2OnlyFonts(),
      reloadOnDeckSources(),
      {
        enforce: 'pre',
        // ビルドでは原稿の警告も失敗扱い。文献ファイルは原稿の属するデッキのもの(decks/<名前>/references.bib)
        ...mdx(mdxOptions({ bibliography: bibliographyFor, strict: !!build && !build.allowWarnings })),
      },
      // 原稿(.mdx)は Fast Refresh の対象にしない。原稿は部品と警告の一覧(deckWarnings)を export するので
      // Fast Refresh では差し替えられず、ページの読み直しになる。原稿の更新はページの入口が受け取って描き直す
      // (decksPlugin)。JSX は @mdx-js/rollup が JS に変換済みなので、ここを通さなくてよい
      react({ include: /\.(js|jsx|ts|tsx)$/ }),
      tailwindcss(),
      ...(build?.single ? [viteSingleFile()] : []),
    ],
  }
}

export default defineConfig(({ command }) => {
  if (command === 'build') throw new Error('ビルドは npm run build -- <デッキ名>(省略すると全デッキ)で行ってください')
  return deckConfig()
})
