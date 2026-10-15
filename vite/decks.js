/**
 * デッキの一覧と場所。デッキは decks/<名前>/ の 1 フォルダで、中身は
 *   deck.mdx        原稿の主ファイル(必須。\input で取り込むファイルはこのフォルダからの相対パス)
 *   style.css       このデッキの見た目の特化(必須。プリセットの読み込み・トークンの上書き)
 *   references.bib  文献(\cite を使うときだけ)
 *   motion.ts       動きの設定(モード・スライドごとの遷移。無ければ reveal で既定の遷移。src/modes/motion.ts)
 * と、原稿が import する画像や部品(img/・components/)。
 * 画像や文献を持たない小さなデッキは、1 ファイル decks/<名前>.mdx でもよい(見た目は土台のまま、動きは reveal の既定、文献なし。
 * 見た目・動き・文献が要るようになったら、フォルダのデッキ decks/<名前>/deck.mdx に移す)。同じ名前で両方あればエラー。文書の部品(src/components)・土台の見た目(src/theme)・
 * 記法の処理(vite/)はすべてのデッキで共有する。decks/components/ はいくつかのデッキで共有する部品の置き場所なので、
 * デッキの名前には使えない(RESERVED_NAMES)。モードの名前(reveal など)も、URL とビルドのフォルダの /<デッキ>/<モード>/ と
 * 取り違えるので使えない。
 *
 * 開発サーバーは 1 つで全デッキを配信し(URL の /<名前>/ でデッキを選ぶ)、ビルドはデッキごとに行う
 * (scripts/deck.mjs がデッキの名前を引数で受け取り、vite.config.ts の deckConfig に渡す)。
 * vite.config.ts と Node のスクリプト(scripts/)の両方から使うので、型は JSDoc で付けた JS にする。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MODE_NAMES } from '../src/modes/names.ts'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DECKS_DIR = join(ROOT, 'decks')

/** デッキの名前に使える文字(フォルダ名・URL・出力先にそのまま使うため) */
export const DECK_NAME = /^[a-z0-9][a-z0-9-]*$/

/**
 * デッキの名前に使えない名前: decks/ の下の、デッキではないフォルダ(components)と、モードの名前
 * (開発サーバーの /<デッキ>/<モード>/ と、--mode でビルドした dist/<デッキ>/<モード>/ と取り違える。
 * ほかのデッキを埋め込む部品(decks/demonstration/components/LiveDeck)も、フォルダの名前でモードのフォルダかを見分ける)
 */
export const RESERVED_NAMES = ['components', ...MODE_NAMES]

/** デッキの名前の一覧(decks/ の下で deck.mdx を持つフォルダと、1 ファイルのデッキ <名前>.mdx。名前順) */
export function listDecks() {
  if (!existsSync(DECKS_DIR)) return []
  const entries = readdirSync(DECKS_DIR, { withFileTypes: true })
  const folders = entries.filter((d) => d.isDirectory() && existsSync(join(DECKS_DIR, d.name, 'deck.mdx'))).map((d) => d.name)
  const files = entries.filter((d) => d.isFile() && d.name.endsWith('.mdx')).map((d) => d.name.slice(0, -'.mdx'.length))
  return [...new Set([...folders, ...files])].sort()
}

/**
 * style・bibliography・motion は、1 ファイルのデッキでは undefined
 * @typedef {{ name: string; dir: string; main: string; style: string | undefined; bibliography: string | undefined; motion: string | undefined; outDir: string }} Deck
 */

/**
 * デッキの場所。無いデッキや名前の誤りはエラーにする(補って別のデッキを開かない)
 * @param {string} name
 * @returns {Deck}
 */
export function resolveDeck(name) {
  if (!DECK_NAME.test(name)) throw new Error(`デッキの名前 "${name}" は英小文字・数字・ハイフンだけで書いてください`)
  if (RESERVED_NAMES.includes(name)) throw new Error(`"${name}" はデッキの名前に使えません(使えない名前: ${RESERVED_NAMES.join(', ')})`)
  const dir = join(DECKS_DIR, name)
  const file = join(DECKS_DIR, `${name}.mdx`)
  const isFolder = existsSync(join(dir, 'deck.mdx'))
  if (isFolder && existsSync(file)) throw new Error(`デッキ "${name}" が 2 つあります(decks/${name}/deck.mdx と decks/${name}.mdx)。どちらかにしてください`)
  if (!isFolder && existsSync(file)) {
    // 1 ファイルのデッキ。取り込み(\input)と import は decks/ から数える
    return { name, dir: DECKS_DIR, main: file, style: undefined, bibliography: undefined, motion: undefined, outDir: join(ROOT, 'dist', name) }
  }
  if (!isFolder) {
    throw new Error(`デッキ "${name}" がありません(decks/${name}/deck.mdx か decks/${name}.mdx)。あるデッキ: ${listDecks().join(', ') || 'なし'}`)
  }
  if (!existsSync(join(dir, 'style.css'))) throw new Error(`decks/${name}/style.css がありません`)
  return {
    name,
    dir,
    main: join(dir, 'deck.mdx'),
    style: join(dir, 'style.css'),
    bibliography: bibliographyOf(dir),
    motion: motionOf(dir),
    outDir: join(ROOT, 'dist', name),
  }
}

/**
 * デッキのフォルダの文献ファイル。無ければ undefined(\cite を使うとエラーになる)
 * @param {string} dir
 */
function bibliographyOf(dir) {
  const bib = join(dir, 'references.bib')
  return existsSync(bib) ? bib : undefined
}

/**
 * デッキのフォルダの動きの設定。無ければ undefined(reveal で既定の遷移)
 * @param {string} dir
 */
function motionOf(dir) {
  const motion = join(dir, 'motion.ts')
  return existsSync(motion) ? motion : undefined
}

/**
 * 原稿のファイル(主ファイル)が属するデッキのフォルダ。decks/ の外なら undefined
 * (MDX の変換は主ファイルごとに行うので、変換中のファイルからデッキの文献を選ぶのに使う)
 * @param {string} file
 */
export function deckDirOf(file) {
  const rel = relative(DECKS_DIR, file)
  if (rel.startsWith('..') || rel === '') return undefined
  const dir = join(DECKS_DIR, rel.split(sep)[0])
  // 1 ファイルのデッキ(decks/<名前>.mdx)はフォルダを持たない(文献・動きの設定も無い)
  return existsSync(dir) && statSync(dir).isDirectory() ? dir : undefined
}

/**
 * 原稿のファイルが属するデッキの文献ファイル
 * @param {string} file
 */
export function bibliographyFor(file) {
  const dir = deckDirOf(file)
  return dir ? bibliographyOf(dir) : undefined
}

/**
 * デッキの題(原稿の最初の「# 題」の行。HTML の <title> に使う)。無ければデッキの名前
 * @param {Deck} deck
 */
export function deckTitle(deck) {
  const source = readFileSync(deck.main, 'utf8')
  const m = source.match(/^# +(.+?)\s*$/m)
  if (m) return m[1]
  // Beamer の \title{…}(\titlepage で表紙を組むデッキ)。\\ の改行は空白に
  const t = source.match(/^\\title(?:\[[^\]]*\])?\{(.*)\}\s*$/m)
  return t ? t[1].replace(/\s*\\\\\s*/g, ' ').trim() : deck.name
}

/**
 * 原稿のファイルが属するデッキの動きの設定
 * @param {string} file
 */
export function motionFor(file) {
  const dir = deckDirOf(file)
  return dir ? motionOf(dir) : undefined
}

/**
 * デッキの既定のモード(動きの設定 motion.ts の mode。無ければ reveal)。ビルドにはこのモードだけが入る。
 * Node が motion.ts の型の注釈を外して読む。開発中に書き換えても読み直すよう、更新時刻を URL に付ける
 * @param {Deck} deck
 * @returns {Promise<string>}
 */
export async function deckMode(deck) {
  if (!deck.motion) return 'reveal'
  const mod = await import(`${pathToFileURL(deck.motion).href}?v=${statSync(deck.motion).mtimeMs}`)
  return mod.default?.mode ?? 'reveal'
}
