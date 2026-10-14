/**
 * デッキのコマンド。デッキの名前は引数で渡す(省略できるコマンドでは全デッキ)。
 *
 *   node scripts/deck.mjs list                              デッキの一覧
 *   node scripts/deck.mjs new <名前>                        デッキを作る(decks/<名前>/ に deck.mdx と style.css)
 *   node scripts/deck.mjs dev [--port <番号>]                開発サーバー(全デッキを /<名前>/ で配信)
 *   node scripts/deck.mjs build [名前...] [--single] [--allow-warnings]
 *                                                           ビルド(dist/<名前>/。--single は 1 枚の index.html)
 *   node scripts/deck.mjs shots [名前...] [--handout]        単一 HTML をビルドして、各ページと一覧を screenshots/<名前>/ に撮る
 *   node scripts/deck.mjs pdf [名前...]                      単一 HTML をビルドして、pdf/<名前>.pdf と pdf/<名前>-handout.pdf を書き出す
 *
 * package.json の npm run dev / build / shots / pdf / new / decks はこれを呼ぶ(npm run build -- landau のように渡す)。
 * Vite のコマンドは任意の引数を設定に渡せないので、Vite を JS の API で呼び、デッキを vite.config.ts の deckConfig に
 * 引数として渡す(環境変数は使わない)。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { DECK_NAME, DECKS_DIR, ROOT, listDecks, resolveDeck } from '../vite/decks.js'

// Vite と設定(vite.config.ts)、ブラウザ(Playwright)は使うコマンドの中で読み込む(list / new を軽くするため)
const vite = () => import('vite')
const viteConfig = () => import('../vite.config.ts')
const capture = () => import('./capture.mjs')

const [command, ...rest] = process.argv.slice(2)
const { values: flags, positionals: names } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    single: { type: 'boolean' },
    'allow-warnings': { type: 'boolean' },
    handout: { type: 'boolean' },
    port: { type: 'string' },
  },
})
const rel = (p) => relative(ROOT, p).split('\\').join('/')

/** 引数のデッキ(省略すると全デッキ)。無いデッキはここでエラーにする */
function decksFromArgs() {
  const list = names.length ? names : listDecks()
  if (list.length === 0) throw new Error('デッキがありません。npm run new -- <名前> で作ってください')
  return list.map(resolveDeck)
}

/** 1 つのデッキをビルドする(Vite の設定ファイルは読まず、deckConfig の結果をそのまま渡す) */
async function buildDeck(deck, { single = false, allowWarnings = false } = {}) {
  const [{ build }, { deckConfig }] = await Promise.all([vite(), viteConfig()])
  await build({ configFile: false, root: ROOT, logLevel: 'warn', ...deckConfig({ deck: deck.name, single, allowWarnings }) })
  console.log(`${deck.name}: ${rel(deck.outDir)}/ にビルドしました`)
}

const commands = {
  list() {
    for (const name of listDecks()) console.log(name)
  },

  new() {
    const [name] = names
    if (!name || !DECK_NAME.test(name)) throw new Error('npm run new -- <名前>(英小文字・数字・ハイフン)で指定してください')
    const dir = join(DECKS_DIR, name)
    if (existsSync(dir)) throw new Error(`decks/${name}/ はもうあります`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'deck.mdx'),
      `{/*
  ${name} の原稿の主ファイル。--- で横のスライド、-- で縦のスライド(上の続き)に区切る。
  書き方は README.md の「執筆方法」と、ほかのデッキ(decks/)を参照。
*/}

# 題

<Byline lines={['氏名', '日付']} />

---

## 最初のスライド

本文
`,
    )
    writeFileSync(
      join(dir, 'style.css'),
      `/* このデッキの見た目の特化(src/theme/ の土台の後に読み込まれる)。書き方は src/theme/tokens.css と presets/ を参照。
   例: @import '@/theme/presets/math.css';  と  :root { --deck-preset: math; } */
`,
    )
    console.log(`decks/${name}/ を作りました。npm run dev で開き、/${name}/ を表示してください`)
  },

  async dev() {
    const [{ createServer }, { deckConfig }] = await Promise.all([vite(), viteConfig()])
    const server = await createServer({ configFile: false, root: ROOT, ...deckConfig(), server: { port: flags.port ? Number(flags.port) : undefined } })
    await server.listen()
    const base = server.resolvedUrls?.local[0] ?? 'http://localhost:5173/'
    console.log(`\n  デッキの一覧: ${base}`)
    for (const name of listDecks()) console.log(`  ${name}: ${base}${name}/`)
    console.log('')
  },

  async build() {
    for (const deck of decksFromArgs()) await buildDeck(deck, { single: !!flags.single, allowWarnings: !!flags['allow-warnings'] })
  },

  async shots() {
    for (const deck of decksFromArgs()) {
      await buildDeck(deck, { single: true })
      const out = join(ROOT, 'screenshots', deck.name, flags.handout ? 'handout' : '')
      const { captureScreenshots } = await capture()
      const n = await captureScreenshots(join(deck.outDir, 'index.html'), out, { handout: !!flags.handout })
      console.log(`${deck.name}: ${n} ページと一覧(all.png)を ${rel(out)}/ に保存しました`)
    }
  },

  async pdf() {
    for (const deck of decksFromArgs()) {
      await buildDeck(deck, { single: true })
      const html = join(deck.outDir, 'index.html')
      const { exportPdf } = await capture()
      for (const [file, handout] of [[`${deck.name}.pdf`, false], [`${deck.name}-handout.pdf`, true]]) {
        const n = await exportPdf(html, join(ROOT, 'pdf', file), { handout })
        console.log(`${deck.name}: pdf/${file}(${n} ページ)を書き出しました`)
      }
    }
  },
}

if (!(command in commands)) {
  console.error(`使い方: node scripts/deck.mjs <${Object.keys(commands).join(' | ')}> [デッキ名...]`)
  process.exit(1)
}
try {
  await commands[command]()
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
