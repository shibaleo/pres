# shibaleo/pres

reveal.js プレゼンテーション。**MDX + TSX** で執筆し、可視化はすべて React コンポーネント。
ビルドすると **単一 HTML ファイル**（CDN依存ゼロ・ダブルクリックで起動）になります。

> 旧版は AsciiDoc + Asciidoctor で書かれていました。可視化コードのグローバルスコープ問題を解消するため、
> コンポーネント指向の MDX/React スタックへ全面移行しました。旧構成は git 履歴に残っています。

## 技術スタック

| 領域 | 採用 |
|---|---|
| 執筆 | MDX (`.mdx`) + TSX |
| ビルド | Vite 6 + `@mdx-js/mdx`（原稿の変換・コンパイルは `vite/deck/` の自作プラグイン） |
| スライド | reveal.js 5 (`@revealjs/react`) |
| スタイル | Tailwind CSS v4 |
| 数式 | KaTeX (`remark-math` + `rehype-katex`)、LaTeX 風の定理環境・相互参照 |
| 文献 | BibTeX (`src/references.bib`) + citation-js（CSL: Vancouver、デッキ全体で通し番号） |
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
npm run check        # 型チェック + テスト + 単一ファイルビルド(下記)
```

`build` / `build:single` は先頭で自動的に `subset` を実行します。

## ディレクトリ構成

```
src/
  App.tsx              デッキ本体(<Deck> にスライドと <Menu> を合成)
  main.tsx             エントリ。reveal/KaTeX/テーマCSS を読み込む
  theme.css            Tailwind v4 エントリ + デザイントークン + @font-face + reveal 上書き
  references.bib       BibTeX 文献データ
  slides/              スライド原稿(MDX)。パスの自然順がそのまま表示順
    10-abstract/  20-body/  30-conclusion/
  deck/                デッキの仕組み(ブラウザ側)
    slides.ts          スライド一覧の受け取り・縦スライドのまとめ
    order.ts           並び順の定義(表示と番号付けで共有)
    mdx-components.tsx import なしで使える部品の一覧
    overflow.ts        開発時のはみ出し検出
    DevDiagnostics.tsx 開発時の原稿警告の一覧
  components/          可視化・UI コンポーネント
    BarChart / ConnectedScatterplot / Globe / FourPoints / LogSpiral
    Frame              色付きフレーム(旧 .frame-* の代替)
    Theorem            定理・定義・証明
    Ref                \ref / \eqref と番号付きの式
    Overlay            Beamer の段階表示(\pause, <2-> …)の変換先
    Cite               文献引用と文献リスト
    Notes              スピーカーノート
    Menu               左下ハンバーガー → スライド一覧サイドバー
  data/                バンドルした図表データ(旧 CDN fetch の置換)
  fonts/               subset 済み woff2(scripts/subset-fonts.mjs が生成)
  img/                 アイコン画像
fonts-src/             サブセット元のフルフォント(.ttf)。ビルド成果物には含めない
scripts/subset-fonts.mjs  フォントサブセット化スクリプト
vite/deck/             原稿の読み込み(ビルド側)
  scan.ts              `---` での分割と、Beamer 風記法 → MDX の変換・記法エラーの検出(純粋関数)
  scan.test.ts         scan.ts の単体テスト(Vitest)
  plugin.ts            Vite プラグイン。デッキ全体の通し番号(定理・式・文献)
  bibliography.ts      BibTeX を CSL(Vancouver)で整形
tsconfig.node.json     ビルド側(vite/, 設定ファイル)の型チェック設定
```

## 執筆方法

記法は 3 層です。**本文は Markdown、構造と数学は Beamer / LaTeX、図や自由なレイアウトは MDX(JSX)**。
Beamer 風の記法はすべて JSX の部品に変換されるので、同じことを JSX でも書けます。

### スライドを追加する
`src/slides/` 以下に `.mdx` を置くだけで自動登録されます。並び順はパスの自然順なので、
`20-body/15-new.mdx` のように番号で位置を決めます（`App.tsx` の編集は不要）。

**1 ファイルに複数枚**書くときは `---` だけの行で区切ります（区切りが無ければ 1 枚）。
`import` はファイル内の全スライドで共有されます。

```mdx
import Globe from '@/components/Globe'

## 1 枚目
…
---
## 2 枚目
<Globe size={300} />
```

- Markdown の区切り線 `---` は使えなくなるので、横線が要るときは `***` を使います。
- 見出しは `#` / `##` で書きます（`タイトル` の次行に `---` を書く setext 見出しは区切りと解釈されます）。

スライドごとの設定は MDX 内で export します（省略可）。複数枚のファイルでは、書いた区画のスライドだけに効きます。
`stack` 以外は reveal の `<Slide>` にそのまま渡ります。

```mdx
export const slide = { stack: 'jsxgraph', backgroundColor: '#fafafa' }
```

- **縦スライド**: 連続するスライドに同じ `stack` を書くと、縦方向にまとまります（↓キーで移動）。
- 自分の部品や画像は `@/components/...`、`@/img/...` で import できます（フォルダの深さに依存しない）。

### 定理環境（LaTeX と同じ記法）
```latex
\begin{theorem}[Jensen]\label{thm:jensen}
$f$ が凸なら $f(\mathbb{E}X) \le \mathbb{E}f(X)$
\end{theorem}

\begin{proof}
…
\end{proof}
```

- 環境: `theorem` `lemma` `proposition` `corollary` `definition`（1 本の通し番号）、`proof`（番号なし・末尾に ∎）
- `[…]` は括弧書きの名前（`proof` では見出し語の置き換え）。名前の中に数式は書けません。
- `\begin` / `\end` は行単独で書きます。
- JSX でも書けます: `<Theorem title="Jensen" id="thm:jensen">…</Theorem>`。見出し語を変えるときは `heading="定理"`。

### 相互参照と番号付きの式
| 書き方 | 表示 |
|---|---|
| 環境や式の中に `\label{key}` | （参照先として登録） |
| `\ref{key}` | `2`（定理の番号） |
| `\eqref{key}` | `(1)`（式の番号） |
| `\begin{equation}…\end{equation}` | 番号付きの別行立て数式 |
| `\begin{align}` / `\begin{gather}` | 行ごとに番号。`\nonumber` / `\notag` / `\tag{…}` の行は自動番号なし |
| `$$…\label{key}$$` | `\label` があれば番号付き |
| `\begin{equation*}` / `\begin{align*}` / `\begin{gather*}` | 番号なし |

番号は**ビルド時にデッキ全体の出現順**で振るので、スライドを並べ替えても参照が追従します（定理と式は別の通し番号）。
KaTeX の自動番号は使わず、行ごとに `\tag{n}` を差し込んでいます（`\ref` で参照できるようにするため）。
align の行は、いちばん外側の `\\` だけで区切ります（`cases` や `\substack` の中の `\\` は区切りと見なさない）。
参照先が無い `\ref` は LaTeX と同じく `??` になり、警告になります（下記）。

### 段階表示（Beamer の overlay → reveal の fragment）
| 書き方 | 意味 |
|---|---|
| `\pause`（行単独） | 以降を次のステップで表示。環境や `<Col>` などのブロックの中ではそのブロックの終わりまで |
| `- <2-> 項目` | 箇条書きの項目に overlay を指定（行頭記号も一緒に隠れる） |
| `- <+-> 項目` | 次のステップから（項目を 1 つずつ出す） |
| `\uncover<2->{…}` / `\visible` / `\onslide` | 指定ステップで表示。非表示の間も場所は残る |
| `\only<2>{…}` | 指定ステップだけ表示。非表示の間は場所も消える |
| `\begin{theorem}<2->` | 環境ごと段階表示 |
| `<Fragment>…</Fragment>` | reveal の fragment をそのまま使う（Beamer 記法のステップの後に出る） |

指定は Beamer と同じく `<2->`（2 枚目から）、`<2>`（2 枚目だけ）、`<2-3>`（範囲）、`<-3>`（3 枚目まで）、`<+->`。
ステップ数も Beamer と揃えています（何も出ないステップが間にあってもそのまま 1 ステップになる）。

### 文献の引用
`src/references.bib` にエントリを追加し、本文で LaTeX と同じく `\cite{key}` と書くと番号になります。

| 書き方 | 表示 |
|---|---|
| `\cite{arnold2012}` | `[1]` |
| `\cite{arnold2012,nakajima2020}` | `[1, 2]` |
| `\cite[p.~5]{arnold2012}` | `[1, p. 5]`（`~` は改行しない空白） |

番号は**デッキ全体での初出順**で、`<Bibliography />` を置いた箇所に引用された文献だけが番号順に並びます。
番号にマウスを乗せると文献が表示されます。未登録の key はビルド時に警告し、本文では `[?]` になります（番号は消費しない）。

### その他の部品（import なしで使える）
| 部品 | 用途 |
|---|---|
| `<Notes>` | スピーカーノート。`S` キーの発表者ビューにだけ出る |
| `<Frame color="blue" title="...">` | 色付きフレーム（gray / red / blue / gold / green / purple） |
| `<Cols>` `<Col>` `<Center>` `<Byline>` `<Note>` `<Code>` | レイアウト |

一覧は `src/deck/mdx-components.tsx`。個別の図（`Globe` など）は使うスライドで明示的に import します。

### 記法が置き換えられない場所
MDX では `{…}` が JS 式、`<…` が JSX になるため、Beamer 風の記法は MDX が解釈する前にソース上で置き換えています。
**コードブロック・インラインコード・テンプレート文字列（`` `…` ``）・数式の中は置き換えない**ので、
記法そのものを説明したいときはコードの中に書けます。

### 数式
インライン `$...$`、ディスプレイ `$$...$$`（KaTeX）。可換図式は `\begin{CD}...\end{CD}`。
※ KaTeX は `\style` の任意 CSS 変形（斜め矢印の回転など）には非対応。

### 記法エラーと警告
不完全な原稿から成果物は作りません（補って動かすことはしない）。すべて**元の原稿のファイル名・行番号**で報告します。

| 種類 | 例 | `npm run dev` | `npm run build` |
|---|---|---|---|
| エラー | 環境の閉じ忘れ・`\end` の不一致、数式の誤り（KaTeX で検査）、不正な overlay 指定、環境の外の `\label`、MDX の構文エラー | エラー画面（該当行の抜粋付き） | 失敗 |
| 警告 | 参照先の無い `\ref`、未登録の文献、`\label` の重複 | 画面右上に一覧 | 失敗（`DECK_ALLOW_WARNINGS=1` で許可） |
| はみ出し | スライドの高さ（700px）超過 | 赤い破線枠とバッジ・コンソール | （対象外） |

スライド原稿を編集すると、番号をデッキ全体で振り直すためページ全体を再読み込みします（表示中のスライド位置は保持）。

### 確認用コマンド
```bash
npm run typecheck   # 型チェック(ブラウザ側 tsconfig.json + ビルド側 tsconfig.node.json)
npm run test        # 原稿変換(vite/deck/scan.ts)の単体テスト(Vitest)
npm run check       # 上の 2 つ + 単一ファイルビルド。コミット前・CI で実行する
```

### はみ出しの検出（開発時のみ）
`npm run dev` 中、スライドの高さ（700px）を超えたスライドには赤い破線枠と「はみ出し」バッジが付き、
コンソールにファイルパスと超過量が出ます。本番ビルドには含まれません。

### 図（インタラクティブ可視化）
`src/components/` に React コンポーネントとして追加。D3 は「React が DOM を持ち D3 は計算」、
JSXGraph は `useEffect` 内で `initBoard` → クリーンアップで `freeBoard`、が基本形。

## フォントのサブセット

日本語フォントは元は約 28MB。実際に使う文字だけに絞ることで合計約 430KB(woff2) にしています。
`scripts/subset-fonts.mjs` が `src/**/*.{mdx,tsx,ts,bib}` を走査して使用文字を集め、
`fonts-src/*.ttf` → `src/fonts/*.woff2` を生成します。

**テキスト（特に日本語）を増やしたら `npm run subset` を実行**して `src/fonts/*.woff2` を更新・コミットしてください。
（`build` では自動実行されます）

## PDF 出力

URL に `?print-pdf` を付けて開き、ブラウザの印刷 → PDF に保存。
印刷設定は **余白=なし / 背景のグラフィック=ON** を推奨（フレームの色を出すため）。

## 既知の制約

- `@revealjs/react` は 0.x（pre-1.0）。API が変わる可能性あり。
- スライド内に収まらない量を書くと reveal は溢れを切る（開発時は上記の警告で気づける。分割で対応）。
- 見出しの番号は CSS カウンタで振るため、reveal の `viewDistance` を広げて全スライドを常に描画している。スライドが数百枚になると重くなる可能性がある（定理・式・文献の番号はビルド時に振るので影響しない）。
