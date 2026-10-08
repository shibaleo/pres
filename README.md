# shibaleo/pres

reveal.js プレゼンテーション。**MDX + TSX** で執筆し、可視化はすべて React コンポーネント。
ビルドすると **単一 HTML ファイル**（CDN依存ゼロ・ダブルクリックで起動）になります。

> 旧版は AsciiDoc + Asciidoctor で書かれていました。可視化コードのグローバルスコープ問題を解消するため、
> コンポーネント指向の MDX/React スタックへ全面移行しました。旧構成は git 履歴に残っています。

## 方針

- **記法は確立した標準にあるものだけ**（LaTeX / Beamer、Markdown(CommonMark)・MDX、reveal.js の慣習）。
  Markdown はどの処理系にも共通する CommonMark に限り、GFM などの方言は使わない。表などは MDX（JSX）で書く。
  独自の記法は作らない（[CLAUDE.md](CLAUDE.md) の取り決め）。
- **処理は標準のライブラリと仕組みに任せる**。記法の追加は remark-math や remark-directive と同じ
  unified の標準の作り方（micromark の構文拡張 + 構文木の変換）で行い、数式の番号は MathJax、
  引用は rehype-citation、MDX のコンパイルは `@mdx-js/rollup` が担う。
- **不完全な原稿から成果物を作らない**。エラーは補わずに原稿の位置付きで報告する。
- **土台は用途に特化しない**。このリポジトリはテンプレートで、数学の資料にも業務マニュアルにも使える汎用の
  見た目と機能だけを持つ。用途への特化は各クローンの `src/custom.css`（とプリセット）で行う。

## 技術スタック

| 領域 | 採用 |
|---|---|
| 執筆 | MDX (`src/slides.mdx` と `\input` で取り込むファイル) + TSX |
| ビルド | Vite 6 + `@mdx-js/rollup` |
| スライド | reveal.js 5 (`@revealjs/react`) |
| 記法 | `vite/remark-beamer/`（LaTeX / Beamer 風記法の remark プラグイン） |
| 数式 | `remark-math` + `rehype-mathjax`（MathJax 3・SVG。式番号・`\label`・`\eqref` は AMS の規則） |
| 文献 | BibTeX (`src/references.bib`) + `rehype-citation`（CSL: NLM/Vancouver 角括弧版。公式リポジトリの `src/csl/nlm-citation-sequence-brackets.csl`） |
| その他 | Tailwind CSS v4 |
| 図 | D3 / JSXGraph を React コンポーネント化 |
| 配布 | `vite-plugin-singlefile` で単一 HTML 化、フォントは subset woff2 |

## 必要環境

- Node.js 18 以上（開発は v24 で確認）

## セットアップ / コマンド

```bash
npm install          # 依存インストール
npm run dev          # 開発サーバー(HMR)
npm run build        # 通常ビルド → dist/ (静的ファイル群、ホスティング向け)
npm run build:single # 単一ファイルビルド → dist/index.html 1枚に全インライン
npm run preview      # ビルド結果をプレビュー
npm run subset       # フォントを使用文字だけに再サブセット(下記)
npm run typecheck    # 型チェック(ブラウザ側 tsconfig.json + ビルド側 tsconfig.node.json)
npm run test         # 記法プラグインとビルド設定のテスト(Vitest)
npm run check        # typecheck + test + build:single。コミット前・CI で実行する
```

`build` / `build:single` は先頭で自動的に `subset` を実行します。

## ディレクトリ構成

```
src/
  slides.mdx           スライド原稿の主ファイル(--- で横、-- で縦に区切る)
  slides/              \input{…} で取り込む原稿(例: guide.mdx)
  references.bib       BibTeX 文献データ
  csl/                 引用スタイル(CSL。公式リポジトリのものをそのまま置く)
  App.tsx              デッキ本体(<Deck> に原稿と <Menu> を合成)
  main.tsx             エントリ。reveal/KaTeX/テーマCSS を読み込む
  theme/               見た目(テンプレート側)。詳しくは「見た目のカスタマイズ」
    index.css          入口(tokens → base → custom の順に読み込む)
    tokens.css         トークンの既定値(色・書体・文字の段階・間隔)
    base.css           汎用の規則(トークンから導いた値だけを使う)
    fonts.css          土台の書体(Noto Sans JP・等幅)
    presets/math.css   数学向けのプリセット(欧文と数字を Computer Modern に)
  custom.css           クローンごとの特化(テンプレートは中身を書かない)
  deck/
    mdx-components.tsx 原稿から import なしで使える部品の一覧
    slide-size.ts      スライドの論理サイズ(ウィンドウ全体を覆う。原稿が当てにできるのは最小 933×700)
    overflow.ts        開発時のはみ出し検出
    DevDiagnostics.tsx 開発時の原稿警告の一覧
  components/          可視化・UI コンポーネント
    BarChart / ConnectedScatterplot / Globe / FourPoints / LogSpiral
    Frame              色付きフレーム
    Theorem            定理・定義・証明(\begin{theorem} などの変換先)
    Overlay            Beamer の段階表示(\pause, <2-> …)の変換先
    Notes              スピーカーノート
    Menu               左下ハンバーガー → スライド一覧サイドバー
  data/ fonts/ img/    図表データ / subset 済み woff2 / 画像
vite/
  mdx-options.ts       MDX のコンパイル設定(remark / rehype プラグインの構成)
  remark-beamer/       LaTeX / Beamer 風記法の remark プラグイン
    syntax.ts          micromark の構文拡張(どこからどこまでが記法か)
    mdast.ts           構文木ノードへの変換
    transform.ts       意味づけ(スライド分割・環境・番号・参照・引用・段階表示)
    rehype-math-errors.ts  MathJax の数式エラーを原稿の位置で報告
fonts-src/             サブセット元のフルフォント(.ttf)。ビルド成果物には含めない
scripts/subset-fonts.mjs  フォントサブセット化スクリプト
```

## 執筆方法

記法は 3 層です。**本文は Markdown、構造と数学は LaTeX / Beamer、図や自由なレイアウトは MDX(JSX)**。
LaTeX / Beamer 風の記法はすべて JSX の部品に変換されるので、同じことを JSX でも書けます。

### スライドの区切り
原稿の主ファイルは `src/slides.mdx` です。分けたい部分は LaTeX と同じ `\input` で取り込みます（下記）。

```mdx
import Globe from '@/components/Globe'

## 1 枚目

---

## 2 枚目

--

## 2 枚目の下(縦スライド)
<Globe size={300} />
```

- `---`（行単独）で横のスライド、`--`（行単独）で縦のスライド（直前のスライドの下）に区切ります。
- 区切りの前後には空行を入れます（直前が文章だと Markdown の見出しと解釈されるため）。横線が要るときは `***`。
- 縦スライドの進め方は `App.tsx` の `navigationMode`（`'linear'` にすると ←→ だけで縦も順に進む）。
- 自分の部品や画像は原稿の先頭で `@/components/...`、`@/img/...` から import します。

### ファイルの取り込み（`\input` と import パッケージ）
LaTeX の `\input` と、標準の [import パッケージ](https://ctan.org/pkg/import) の `\import` / `\subimport` が使えます（行単独で書く）。

| 書き方 | パスの基準 | 取り込んだファイルの中での `\input` |
|---|---|---|
| `\input{file}` | 主ファイル（`src/slides.mdx`）のディレクトリ | 変わらない |
| `\import{path/}{file}` | 絶対パス、または主ファイルのディレクトリ | **`path/` を先に探し、無ければ主ファイルのディレクトリ** |
| `\subimport{path/}{file}` | **今いるファイルの基準ディレクトリ**からの相対（入れ子にできる） | 同上（基準が `…/path/` になる） |

`\inputfrom` / `\subinputfrom` は `\import` / `\subimport` の別名、`*` 付きも同じです。

```latex
% slides.mdx
\import{parts/}{a}          % parts/a.mdx

% parts/a.mdx の中
\input{b}                   % parts/b.mdx(自分の場所が先)
\input{common}              % parts に無ければ主ファイル側の common.mdx
\subimport{deep/}{c}        % parts/deep/c.mdx。その中の \input{d} は parts/deep/d.mdx
```

- 「ファイルからの相対」と「主ファイル（ルート）からの相対」を混ぜたいときは、`\import` / `\subimport` で取り込みます。
  `\input` で取り込んだファイルの中は、LaTeX と同じく主ファイル基準のままです。
- 探す順は LaTeX と同じで、まず `.mdx` を付けた名前、無ければ書いたままの名前（`chapter.v2` → `chapter.v2.mdx`、`notes.md` → `notes.md`）。
  `..`・`src` の外・空白・日本語・絶対パスも使えます。区切りは `/` で書きます（`\` は Windows でしか通じません）。`@/` などのエイリアスは使えません。
- 取り込んだ内容はその場に差し込まれ、**1 つの文書として扱われます**。定理・式・文献の番号、`\ref`、
  スライドの区切り（`---` / `--`）は、ファイルをまたいでも通しで働きます。入れ子の `\input` も可。
- 取り込んだファイルの `import` は主ファイルの `import` と同じ扱い（同じ文は 1 つにまとめる）。パスは `@/…` で書きます。
- エラー・警告は「取り込んだファイル:行」で報告します。無いファイル・循環した取り込みはエラー。
- 開発サーバーは取り込んだファイルの編集でもページを再読み込みします。
- MDX の `import Part from './part.mdx'`（部品として読み込む）方式は、ファイルごとに別々にコンパイルされて
  番号が通しにならないので、原稿の分割には使いません。

### 定理環境（LaTeX と同じ記法）
```latex
\begin{theorem}[Jensen $f$]\label{thm:jensen}
$f$ が凸なら …
\end{theorem}

\begin{proof}
…
\end{proof}
```

- 環境: `theorem` `lemma` `proposition` `corollary` `definition`（1 本の通し番号）、`proof`（番号なし・末尾に ∎）
- `[…]` は括弧書きの名前（数式も書ける。`proof` では見出し語の置き換え）。`\begin` / `\end` は行単独で書きます。
- JSX でも書けます: `<Theorem title="Jensen" id="thm:jensen">…</Theorem>`。見出し語を変えるときは `heading="定理"`。

### 数式と相互参照
| 書き方 | 意味 |
|---|---|
| `$…$` / `$$…$$` | インライン / 別行立て（番号なし） |
| `\begin{equation}…\end{equation}` | 番号付き（`$$` で囲まなくてよい） |
| `\begin{align}` / `\begin{gather}` | 行ごとに番号。`\nonumber` / `\notag` / `\tag{…}` の行は自動番号なし |
| `\begin{equation*}` / `\begin{align*}` … | 番号なし |
| 定理環境や式の中に `\label{key}` | 参照先として登録 |
| `\ref{key}` / `\eqref{key}` | 番号 / `(番号)` |

- 定理の番号はビルド時にデッキ全体の出現順で振ります。**式の番号と式の参照は MathJax**（AMS と同じ規則）が処理します。
- **後ろにある式への参照（前方参照）は表示できません**。rehype-mathjax が文書順に 1 式ずつ描くためで、警告になります。
- 可換図式は `\begin{CD}…\end{CD}`（`$$` の中）。

### 段階表示（Beamer の overlay → reveal の fragment）
| 書き方 | 意味 |
|---|---|
| `\pause`（行単独） | 以降を次のステップで表示。環境や `<Col>` などのブロックの中ではそのブロックの終わりまで |
| `\uncover<2->{…}` / `\visible` / `\onslide` | 指定ステップで表示。非表示の間も場所は残る。`- \uncover<+->{…}` で項目を 1 つずつ |
| `\only<2>{…}` | 指定ステップだけ表示。非表示の間は場所も消える |
| `\begin{theorem}<2->` | 環境ごと段階表示 |
| `<Fragment>…</Fragment>` | reveal の fragment をそのまま使う（Beamer 記法のステップの後に出る） |

指定は Beamer と同じく `<2->`、`<2>`、`<2-3>`、`<-3>`、`<+->`。ステップ数も Beamer と揃えています。
`\only` / `\uncover` が段落の中にあれば文中に、段落全体ならブロックとして表示します（LaTeX と同じく、空行の無い連続した行は 1 段落）。

### 文献の引用
`src/references.bib` にエントリを追加し、本文で LaTeX と同じく `\cite{key}`、`\cite{a,b}`、`\cite[p.~5]{key}` と書きます。
番号付け・整形・文献リストは rehype-citation（CSL）が行い、`<Bibliography />` の位置に文献リストが入ります。
本文の引用は `[1]` / `[1,2]` の形です（CSL: NLM/Vancouver 角括弧版）。このスタイルは頁指定（`[p.~5]`）を表示しません。
スタイルを替えるときは CSL の公式リポジトリ（citation-style-language/styles）のファイルを `src/csl/` に置いて
`vite/mdx-options.ts` で指定します。

### その他の部品（import なしで使える）
| 部品 | 用途 |
|---|---|
| `<Notes>` | スピーカーノート。`S` キーの発表者ビューにだけ出る |
| `<Frame color="blue" title="...">` | 色付きフレーム（gray / red / blue / gold / green / purple） |
| `<Cols>` `<Col>` `<Center>` `<Byline>` `<Note>` `<Code>` | レイアウト |

一覧は `src/deck/mdx-components.tsx`。個別の図（`Globe` など）は原稿の先頭で import します。
コード（`` `…` ``、コードブロック、テンプレート文字列）と数式の中の記法は変換されないので、記法の説明はそこに書けます。

### 記法エラーと警告
不完全な原稿から成果物は作りません。どれも **原稿（`slides.mdx`）の行番号** で報告します（unified の VFile メッセージ）。

| 種類 | 例 | `npm run dev` | `npm run build` |
|---|---|---|---|
| エラー | 環境の閉じ忘れ・`\end` の不一致、未対応の環境・命令、数式の誤り（MathJax）、不正な overlay 指定、環境の外の `\label`、MDX の構文エラー | エラー画面 | 失敗 |
| 警告 | 参照先の無い `\ref`、未登録の文献、`\label` の重複、式の前方参照 | 画面右上に一覧 | 失敗（`DECK_ALLOW_WARNINGS=1` で許可） |
| はみ出し | スライドの最小サイズ（933×700）超過 | 最小サイズの範囲の赤い破線枠とバッジ・コンソール | （対象外） |

### はみ出しの検出（開発時のみ）
`npm run dev` 中、スライドの最小サイズ（933×700）を縦か横に超えたスライドには、最小サイズの範囲に赤い破線の枠と
超過量のバッジが付き、コンソールに原稿の行と超過量が出ます。本番ビルドには含まれません。
スライドはウィンドウ全体を覆うので、いまの画面に収まって見えても、別の縦横比の画面では枠の外が切れます。
検査はウィンドウの大きさに依らず、スライドを最小の幅で組み直して測ります。

### 図（インタラクティブ可視化）
`src/components/` に React コンポーネントとして追加。D3 は「React が DOM を持ち D3 は計算」、
JSXGraph は `useEffect` 内で `initBoard` → クリーンアップで `freeBoard`、が基本形。

## 見た目のカスタマイズ

見た目は 3 層で、後のものが前のものを上書きします。

| 層 | ファイル | 持ち主 |
|---|---|---|
| トークン | `src/theme/tokens.css` | テンプレート |
| 汎用の規則 | `src/theme/base.css`（書体は `fonts.css`） | テンプレート |
| 特化 | `src/custom.css`（プリセットの読み込み・トークンの上書き・独自の規則） | 各クローン |

クローンで変えるのは `src/custom.css` だけにします。テンプレート側のファイルを書き換えないでおけば、
テンプレートの更新を取り込むときに衝突しません。

```css
/* src/custom.css */
@import './theme/presets/math.css';  /* 数学向け: 欧文と数字を Computer Modern に */

:root {
  --color-brand: #0a7d5a;            /* トークンの一覧と既定値は src/theme/tokens.css */
  --text-base: 26px;
}
```

用途に共通する改善はテンプレート（tokens / base）へ、特定の用途に寄った見た目はプリセット
（`src/theme/presets/`）へ入れます。

## フォントのサブセット

日本語フォントは元は約 28MB。実際に使う文字だけに絞ることで合計約 600KB(woff2) にしています。
`scripts/subset-fonts.mjs` が `src/**/*.{mdx,tsx,ts,bib}` を走査して使用文字を集め、
`fonts-src/*.ttf` → `src/fonts/*.woff2` を生成します。

**テキスト（特に日本語）を増やしたら `npm run subset` を実行**して `src/fonts/*.woff2` を更新・コミットしてください。
（`build` では自動実行されます）

## PDF 出力

URL に `?print-pdf` を付けて開き、ブラウザの印刷 → PDF に保存。
印刷設定は **余白=なし / 背景のグラフィック=ON** を推奨（フレームの色を出すため）。

## 既知の制約

- `@revealjs/react` は 0.x（pre-1.0）。API が変わる可能性あり。
- 式の前方参照は表示できない（上記）。
- 数式は MathJax の SVG を埋め込むため、別行立ての式 1 つあたり十数 KB 増える。
- JSXGraph のラベル（FourPoints）だけは KaTeX で描いている（JSXGraph が KaTeX を直接呼ぶため）。
- 見出しの番号は CSS カウンタで振るため、reveal の `viewDistance` を広げて全スライドを常に描画している。スライドが数百枚になると重くなる可能性がある。
