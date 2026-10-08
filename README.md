# shibaleo/pres

reveal.js プレゼンテーション。**MDX + TSX** で執筆し、可視化はすべて React コンポーネント。
ビルドすると **単一 HTML ファイル**（CDN依存ゼロ・ダブルクリックで起動）になります。

> 旧版は AsciiDoc + Asciidoctor で書かれていました。可視化コードのグローバルスコープ問題を解消するため、
> コンポーネント指向の MDX/React スタックへ全面移行しました。旧構成は git 履歴に残っています。

## 技術スタック

| 領域 | 採用 |
|---|---|
| 執筆 | MDX (`.mdx`) + TSX |
| ビルド | Vite 6 + `@mdx-js/rollup` |
| スライド | reveal.js 5 (`@revealjs/react`) |
| スタイル | Tailwind CSS v4 |
| 数式 | KaTeX (`remark-math` + `rehype-katex`) |
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
```

`build` / `build:single` は先頭で自動的に `subset` を実行します。

## ディレクトリ構成

```
src/
  App.tsx              デッキ本体(<Deck> にスライドと <Menu> を合成)
  main.tsx             エントリ。reveal/KaTeX/テーマCSS を読み込む
  theme.css            Tailwind v4 エントリ + デザイントークン + @font-face + reveal 上書き
  references.bib       BibTeX 文献データ
  slides/              各スライド(MDX)。パスの自然順がそのまま表示順
    10-abstract/  20-body/  30-conclusion/
  deck/                デッキの仕組み
    slides.ts          slides/**/*.mdx の自動登録・縦スライドのまとめ
    order.ts           並び順の定義(表示と文献番号で共有)
    mdx-components.tsx import なしで使える部品の一覧
    overflow.ts        開発時のはみ出し検出
  components/          可視化・UI コンポーネント
    BarChart / ConnectedScatterplot / Globe / FourPoints / LogSpiral
    Frame              色付きフレーム(旧 .frame-* の代替)
    Theorem            定理・定義・証明(通し番号)
    Cite               文献引用と文献リスト
    Notes              スピーカーノート
    Menu               左下ハンバーガー → スライド一覧サイドバー
  data/                バンドルした図表データ(旧 CDN fetch の置換)
  fonts/               subset 済み woff2(scripts/subset-fonts.mjs が生成)
  img/                 アイコン画像
fonts-src/             サブセット元のフルフォント(.ttf)。ビルド成果物には含めない
scripts/subset-fonts.mjs  フォントサブセット化スクリプト
vite/citations.ts      文献の通し番号付け(remark プラグイン + 仮想モジュール)
```

## 執筆方法

### スライドを追加する
`src/slides/` 以下に `.mdx` を置くだけで自動登録されます。並び順はパスの自然順なので、
`20-body/15-new.mdx` のように番号で位置を決めます（`App.tsx` の編集は不要）。

スライドごとの設定は MDX 内で export します（省略可）。`stack` 以外は reveal の `<Slide>` にそのまま渡ります。

```mdx
export const slide = { stack: 'jsxgraph', backgroundColor: '#fafafa' }
```

- **縦スライド**: 連続するファイルに同じ `stack` を書くと、縦方向にまとまります（↓キーで移動）。
- 自分の部品や画像は `@/components/...`、`@/img/...` で import できます（フォルダの深さに依存しない）。

### import なしで使える部品
`src/deck/mdx-components.tsx` に登録した部品は、どのスライドでも import せずに書けます。

| 部品 | 用途 |
|---|---|
| `<Fragment>` | 段階表示（次へ進むと現れる）。既定はブロック要素で、文中では `as="span"` |
| `<Notes>` | スピーカーノート。`S` キーの発表者ビューにだけ出る |
| `<Theorem>` `<Lemma>` `<Proposition>` `<Corollary>` `<Definition>` | 定理環境。1 本の通し番号。`title="..."` で名前、`label="定理"` で見出し語を変更 |
| `<Proof>` | 証明（番号なし、末尾に ∎） |
| `<Frame color="blue" title="...">` | 色付きフレーム |
| `<Cols>` `<Col>` `<Center>` `<Byline>` `<Note>` `<Code>` | レイアウト |
| `<Bibliography />` | 文献リスト |

個別の図（`Globe` など）は使うスライドで明示的に import します。

### 数式
インライン `$...$`、ディスプレイ `$$...$$`（KaTeX）。可換図式は `\begin{CD}...\end{CD}`。
※ KaTeX は `\style` の任意 CSS 変形（斜め矢印の回転など）には非対応。

### 文献の引用
`src/references.bib` にエントリを追加し、本文で LaTeX と同じく `\cite{key}` と書くと番号になります。

| 書き方 | 表示 |
|---|---|
| `\cite{arnold2012}` | `[1]` |
| `\cite{arnold2012,nakajima2020}` | `[1, 2]` |
| `\cite[p.~5]{arnold2012}` | `[1, p. 5]`（`~` は改行しない空白） |

番号は**デッキ全体での初出順**で、`<Bibliography />` を置いた箇所に引用された文献だけが番号順に並びます。
番号にマウスを乗せると文献が表示されます。未登録の key はビルド時に警告し、本文では `[?]` になります（番号は消費しない）。

MDX では `{…}` が JS 式になるため、`\cite` は MDX が解釈する前にソース上で `<Cite>` へ置き換えています。
コードブロック・インラインコード・テンプレート文字列（`` `…` ``）の中は置き換えないので、記法の説明はそこに書けます。

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
- 見出し・定理の番号は CSS カウンタで振るため、reveal の `viewDistance` を広げて全スライドを常に描画している。スライドが数百枚になると重くなる可能性がある。
