import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import type { Plugin, UserConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { basename, join, relative } from 'node:path'
import mdx from '@mdx-js/rollup'
import { mdxOptions } from './vite/mdx-options.ts'
import { DECK_NAME, ROOT, bibliographyFor, deckDirOf, deckMode, deckTitle, listDecks, motionFor, resolveDeck } from './vite/decks.js'
import { MODE_NAMES, MODE_VARIANTS, type ModeName } from './src/modes/names.ts'

/** デッキのページの入口(仮想モジュール)の URL。/@deck/<名前> */
const ENTRY_PREFIX = '/@deck/'
const ENTRY_ID = '\0deck-entry:'

/** モードの作り(src/modes/<名前>/ の部品)。入口がデッキのモードの分だけを読み込む */
const MODE_APPS: Record<ModeName, string> = {
  reveal: '/src/modes/reveal/RevealApp.tsx',
  impress: '/src/modes/impress/ImpressApp.tsx',
  shower: '/src/modes/shower/ShowerApp.tsx',
  spectacle: '/src/modes/spectacle/SpectacleApp.tsx',
  swiper: '/src/modes/swiper/SwiperApp.tsx',
}
/** 土台の見た目より先に読むライブラリの本体の CSS(土台が上書きする。reveal のスライドの配置と遷移・UI) */
const MODE_LIBRARY_CSS: Partial<Record<ModeName, string>> = { reveal: 'reveal.js/reveal.css' }

const isMode = (name: string | undefined): name is ModeName => (MODE_NAMES as readonly string[]).includes(name ?? '')

/** ルートからのパスを、Vite の URL(/ で始まるルート相対)にする */
const rootUrl = (file: string) => '/' + relative(ROOT, file).split('\\').join('/')

/**
 * デッキのページ。index.html(全デッキで共通の器)に、デッキの題と入口のスクリプトを入れる。
 *   - 開発時: 1 つの開発サーバーで全デッキを配信する。/<名前>/ がそのデッキ(デッキのモード)、/<名前>/<モード>/ がほかのモードで
 *     開いたもの、/ はデッキの一覧
 *   - ビルド: deck に渡した 1 つのデッキだけを組む(mode を渡せばそのモードで)
 * 入口(/@deck/<名前> または /@deck/<名前>/<モード>)は「ライブラリの本体の CSS → 土台(src/main.tsx)→ モード →
 * デッキの style.css → 原稿」の順に読み込んで起動する仮想モジュールで、ページごとに違うのはこの入口だけ。
 * モードを指さなければ、デッキの動きの設定(motion.ts の mode)のモード。入口が読むモードは 1 つだけなので、
 * ビルドにはそのモードだけが入る。
 */
function decksPlugin(deck: string | undefined, mode: ModeName | undefined): Plugin {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  /** 開発時のデッキの一覧(/ で開くページ)。デッキごとの行に、モードごとの列を並べる(モードは src/modes/names.ts) */
  const indexPage = () => {
    const head = MODE_NAMES.map((mode) => `<th>${mode}</th>`).join('')
    const rows = listDecks().map((name) => {
      const cells = MODE_NAMES.map((mode) => {
        const url = (extra = '') => `./${name}/${mode}/${extra && `?${extra}`}`
        const variants = MODE_VARIANTS[mode].map((v) => `<a href="${url(v.query)}">${escape(v.label)}</a>`).join(' ')
        return `<td><a href="${url()}"><b>開く</b></a>${variants && `<br><small>${variants}</small>`}</td>`
      })
      return `<tr><th><a href="./${name}/">${escape(deckTitle(resolveDeck(name)))}</a><br><code>${name}</code></th>${cells.join('')}</tr>`
    })
    return `<!doctype html><html lang="ja"><head><meta charset="UTF-8" /><title>デッキの一覧</title>
<style>
  body { font-family: sans-serif; margin: 2em; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 0.5em 0.8em; text-align: left; vertical-align: top; }
  thead th { background: #f2f2f2; }
  small a { margin-right: 0.4em; }
</style></head>
<body><h1>デッキの一覧</h1>
<table><thead><tr><th>デッキ</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>
<p>デッキの名前のリンクは、デッキの動きの設定(motion.ts)のモードで開く(ビルドにはそのモードだけが入る)。表のリンクは、そのモードで開いた見本(開発時だけ)。
モード(スライドを動かすライブラリ)は docs/motion.md。reveal 以外は試作。小さい字はライブラリ自身の開き方の変わり種。</p>
<p>decks/&lt;名前&gt;/ に deck.mdx と style.css を置くと一覧に加わります(npm run new -- &lt;名前&gt;)。</p></body></html>`
  }
  return {
    name: 'decks',
    configureServer(server) {
      // ブラウザのはみ出しの検査(src/devtools/overflow.ts)の結果を端末にも出す。エディタで原稿を書いていて
      // ブラウザを見ていなくても気づけるように。変わったときだけ届く(出た・増えた・消えた)
      const lastCount = new Map<string, number>()
      server.environments.client.hot.on('deck:overflow', (data: { page: string; overflows: { file: string; line: string; message: string }[] }) => {
        const name = data.page.split('/')[1] ?? ''
        const log = server.config.logger
        const before = lastCount.get(name) ?? 0
        lastCount.set(name, data.overflows.length)
        if (data.overflows.length === 0) {
          if (before > 0) log.info(`[deck] ${name}: はみ出しは解消しました`, { timestamp: true })
          return
        }
        const lines = data.overflows.map((o) => `  decks/${name}/${o.file}:${o.line} ${o.message}`)
        log.warn(`[deck] ${name}: はみ出し ${data.overflows.length} 件\n${lines.join('\n')}`, { timestamp: true })
      })
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split(/[?#]/)[0]
        if (path === '/' || path === '/index.html') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(indexPage())
          return
        }
        // /<名前> と /<名前>/<モード> は、末尾に / を付けたものに揃える(ページの中の相対パスと sessionStorage の鍵が 1 つになるように)
        const m = path.match(/^\/([^/.@]+)(?:\/([^/.@]+))?$/)
        if (m && DECK_NAME.test(m[1]) && (m[2] === undefined || isMode(m[2]))) {
          res.statusCode = 302
          res.setHeader('Location', `${path}/`)
          res.end()
          return
        }
        next()
      })
    },
    resolveId(id) {
      if (id.startsWith(ENTRY_PREFIX)) return ENTRY_ID + id.slice(ENTRY_PREFIX.length)
    },
    async load(id) {
      if (!id.startsWith(ENTRY_ID)) return
      const [name, chosen] = id.slice(ENTRY_ID.length).split('/')
      const d = resolveDeck(name)
      // モード: 指したもの(/@deck/<名前>/<モード>)か、デッキの動きの設定の mode。無いモードは原稿の変換が motion.ts の警告にする
      // (本番のビルドは失敗する)ので、ここでは reveal で開く
      const fromMotion = chosen ?? (await deckMode(d))
      const mode: ModeName = isMode(fromMotion) ? fromMotion : 'reveal'
      const main = rootUrl(d.main)
      // 動きの設定(decks/<名前>/motion.ts)。既定の遷移などに使う(スライドごとの遷移は原稿の変換が付ける)
      const motion = d.motion ? `import motion from '${rootUrl(d.motion)}'` : `const motion = undefined`
      const libraryCss = MODE_LIBRARY_CSS[mode]
      return [
        ...(libraryCss ? [`import '${libraryCss}'`] : []),
        `import { startDeck } from '/src/main.tsx'`,
        `import Mode from '${MODE_APPS[mode]}'`,
        `import '${rootUrl(d.style)}'`,
        `import Slides, { deckWarnings } from '${main}'`,
        motion,
        `const update = startDeck({ Slides, warnings: deckWarnings, motion }, Mode)`,
        // 原稿の更新(HMR)はここで受け取り、同じ App を新しい原稿で描き直す(ページを読み直さないので、
        // 表示中のスライドの位置が保たれる)。原稿は部品と警告の一覧を export するので、React の差し替えの境界にならない
        `if (import.meta.hot) import.meta.hot.accept('${main}', (m) => m && update({ Slides: m.default, warnings: m.deckWarnings, motion }))`,
      ].join('\n')
    },
    transformIndexHtml: {
      // Vite が HTML の script を集めて束ねる前に入れる(後に入れると、ビルドで入口が束ねられない)
      order: 'pre',
      handler(html, ctx) {
        // 開発時は URL の最初の段がデッキの名前、次の段があればモード(/landau/ → landau、/landau/impress/ → landau を impress で)。
        // 無いデッキは resolveDeck がエラーにする
        const [, first = '', second = ''] = (ctx.originalUrl ?? '/').split(/[?#]/)[0].split('/').map(decodeURIComponent)
        const d = resolveDeck(deck ?? first)
        const chosen = deck ? mode : second || undefined
        if (chosen !== undefined && !isMode(chosen)) throw new Error(`モード「${chosen}」はありません(${MODE_NAMES.join('・')})`)
        const entry = `${ENTRY_PREFIX}${d.name}${chosen ? `/${chosen}` : ''}`
        return html
          .replace(/<title>.*<\/title>/, `<title>${escape(deckTitle(d))}</title>`)
          .replace('</body>', `  <script type="module" src="${entry}"></script>\n  </body>`)
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
      // 動きの設定(motion.ts)は、モードも変わりうるのでページを読み直す(原稿の変換も、題とスライドの照合のためにやり直す)
      const motion = basename(file) === 'motion.ts' && !!deckDirOf(file)
      if (!file.endsWith('.bib') && !included && !motion) return
      const graph = this.environment.moduleGraph
      const dir = deckDirOf(file)
      const main = dir && graph.getModulesByFile(normalizePath(resolveDeck(basename(dir)).main))
      if (main && main.size > 0 && !motion) {
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
  /**
   * デッキの動きの設定(motion.ts の mode)とは別のモードでビルドする。出力は dist/<名前>/<モード>/
   * (e2e テストと PDF の書き出しが、reveal の並び・PDF 用の表示を使うため)
   */
  mode?: ModeName
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
      // 原稿やデッキの部品がフォルダの深さに依存せず `@/figure/...` などで土台を import できるように
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: out ? { outDir: build.mode ? join(out.outDir, build.mode) : out.outDir, emptyOutDir: true } : undefined,
    // 開発サーバーが起動時に依存パッケージを束ねるための起点。index.html には入口の script が無い(デッキごとに
    // decksPlugin が入れる)ので明示する。無いと、デッキを開いてから依存を見つけて束ね直し、開いている全ページを読み直す
    optimizeDeps: { entries: ['src/**/*.tsx', '!src/**/*.test.tsx', 'decks/**/*.{ts,tsx,js,jsx}'] },
    plugins: [
      decksPlugin(out?.name, build?.mode),
      woff2OnlyFonts(),
      reloadOnDeckSources(),
      {
        enforce: 'pre',
        // ビルドでは原稿の警告も失敗扱い。文献ファイルは原稿の属するデッキのもの(decks/<名前>/references.bib)
        ...mdx(mdxOptions({ bibliography: bibliographyFor, strict: !!build && !build.allowWarnings, motion: motionFor })),
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
