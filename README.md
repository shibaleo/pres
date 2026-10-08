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
| 文献 | BibTeX (`src/references.bib`) + `rehype-citation`（CSL: Vancouver） |
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
  components/          可視化・UI コンポーネント
    BarChart / ConnectedScatterplot / Globe / FourPoints / LogSpiral
    Frame              色付きフレーム(旧 .frame-* の代替)
    Menu               左下ハンバーガー → スライド一覧サイドバー
  slides/              各スライド(MDX)。App.tsx の SLIDES 配列が並び順
  data/                バンドルした図表データ(旧 CDN fetch の置換)
  fonts/               subset 済み woff2(scripts/subset-fonts.mjs が生成)
  img/                 アイコン画像
fonts-src/             サブセット元のフルフォント(.ttf)。ビルド成果物には含めない
scripts/subset-fonts.mjs  フォントサブセット化スクリプト
```

## 執筆方法

### スライドを追加する
1. `src/slides/Foo.mdx` を作成（Markdown 本文に JSX コンポーネントを直接書ける）
2. `src/App.tsx` の `SLIDES` 配列に import して追加（配列順 = スライド順）

### 数式
インライン `$...$`、ディスプレイ `$$...$$`（KaTeX）。可換図式は `\begin{CD}...\end{CD}`。
※ KaTeX は `\style` の任意 CSS 変形（斜め矢印の回転など）には非対応。

### 文献の引用
`src/references.bib` にエントリを追加し、本文で `[@key]` と書くと番号 `[1]` になり、
`[^ref]` を置いた箇所に文献リストが生成されます（相互リンク付き）。

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
- 文献番号は MDX ファイル単位で採番されるため、別スライドの引用は独立採番になる。
- スライド内に収まらない量を書くと reveal は溢れを切る（1スライドの容量に上限あり。分割で対応）。
