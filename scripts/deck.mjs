/**
 * デッキのコマンド。デッキの名前は引数で渡す(省略できるコマンドでは全デッキ)。
 *
 *   node scripts/deck.mjs list                              デッキの一覧
 *   node scripts/deck.mjs new <名前>                        デッキを作る(decks/<名前>/ に deck.mdx と style.css)
 *   node scripts/deck.mjs dev [--port <番号>]                開発サーバー(全デッキを /<名前>/ で配信)
 *   node scripts/deck.mjs build [名前...] [--single] [--allow-warnings] [--mode <モード>]
 *                                                           ビルド(dist/<名前>/。--single は 1 枚の index.html。
 *                                                           モードはデッキの動きの設定(motion.ts)のもの。--mode で別のモードにすると
 *                                                           dist/<名前>/<モード>/)
 *   node scripts/deck.mjs lint [名前...]                     単一 HTML をビルドして、はみ出しだけを検査する(原稿の位置を一覧。あれば失敗)
 *   node scripts/deck.mjs shots [名前...] [--handout]        単一 HTML を reveal モードでビルドして、各ページと一覧を screenshots/<名前>/ に撮る
 *   node scripts/deck.mjs pdf [名前...]                      単一 HTML を reveal モードでビルドして、pdf/<名前>.pdf と pdf/<名前>-handout.pdf を書き出す
 *                                                           (PDF 用の表示は reveal のもの。デッキのモードが別でも、PDF は reveal で組む)
 *
 * package.json の npm run dev / build / shots / pdf / new / decks はこれを呼ぶ(npm run build -- landau のように渡す)。
 * Vite のコマンドは任意の引数を設定に渡せないので、Vite を JS の API で呼び、デッキを vite.config.ts の deckConfig に
 * 引数として渡す(環境変数は使わない)。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { DECK_NAME, DECKS_DIR, RESERVED_NAMES, ROOT, listDecks, resolveDeck } from '../vite/decks.js'

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
    mode: { type: 'string' },
  },
})
const rel = (p) => relative(ROOT, p).split('\\').join('/')

/** 引数のデッキ(省略すると全デッキ)。無いデッキはここでエラーにする */
function decksFromArgs() {
  const list = names.length ? names : listDecks()
  if (list.length === 0) throw new Error('デッキがありません。npm run new -- <名前> で作ってください')
  return list.map(resolveDeck)
}

/**
 * 1 つのデッキをビルドする(Vite の設定ファイルは読まず、deckConfig の結果をそのまま渡す)。
 * mode を渡すと、デッキの動きの設定とは別のモードで dist/<名前>/<モード>/ に。ビルドした index.html の場所を返す
 */
async function buildDeck(deck, { single = false, allowWarnings = false, mode } = {}) {
  const [{ build }, { deckConfig }, { MODE_NAMES }] = await Promise.all([vite(), viteConfig(), import('../src/modes/names.ts')])
  if (mode !== undefined && !MODE_NAMES.includes(mode)) throw new Error(`モード「${mode}」はありません(${MODE_NAMES.join('・')})`)
  await build({ configFile: false, root: ROOT, logLevel: 'warn', ...deckConfig({ deck: deck.name, single, allowWarnings, mode }) })
  const outDir = mode ? join(deck.outDir, mode) : deck.outDir
  console.log(`${deck.name}: ${rel(outDir)}/ にビルドしました${mode ? `(${mode} モード)` : ''}`)
  return join(outDir, 'index.html')
}

const commands = {
  list() {
    for (const name of listDecks()) console.log(name)
  },

  new() {
    const [name] = names
    if (!name || !DECK_NAME.test(name)) throw new Error('npm run new -- <名前>(英小文字・数字・ハイフン)で指定してください')
    if (RESERVED_NAMES.includes(name)) {
      throw new Error(
        name === 'components'
          ? `decks/${name}/ はデッキで共有する部品の置き場所なので、デッキの名前には使えません`
          : `"${name}" はモードの名前なので、デッキの名前には使えません(/<デッキ>/<モード>/ と取り違える)`,
      )
    }
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
    for (const deck of decksFromArgs()) await buildDeck(deck, { single: !!flags.single, allowWarnings: !!flags['allow-warnings'], mode: flags.mode })
  },

  async shots() {
    for (const deck of decksFromArgs()) {
      const html = await buildDeck(deck, { single: true, mode: 'reveal' })
      const out = join(ROOT, 'screenshots', deck.name, flags.handout ? 'handout' : '')
      const { captureScreenshots } = await capture()
      const n = await captureScreenshots(html, out, { handout: !!flags.handout })
      console.log(`${deck.name}: ${n} ページと一覧(all.png)を ${rel(out)}/ に保存しました`)
    }
  },

  async lint() {
    // ビルドして、はみ出しだけを検査する(原稿を書きながら確かめる用。e2e テスト全体より速い)。あれば失敗で終わる
    let total = 0
    for (const deck of decksFromArgs()) {
      const html = await buildDeck(deck, { single: true, allowWarnings: true })
      const { checkOverflow } = await capture()
      const overflows = await checkOverflow(html)
      total += overflows.length
      if (overflows.length === 0) console.log(`${deck.name}: はみ出しはありません`)
      else console.log(`${deck.name}: はみ出し ${overflows.length} 件\n${overflows.map((o) => `  decks/${deck.name}/${o.file}:${o.line} ${o.message}`).join('\n')}`)
    }
    if (total > 0) process.exitCode = 1
  },

  async pdf() {
    for (const deck of decksFromArgs()) {
      const html = await buildDeck(deck, { single: true, mode: 'reveal' })
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
