# shibaleo/pres

reveal.js プレゼンテーション。**MDX + TSX** で執筆し、可視化はすべて React コンポーネント。
ビルドすると **単一 HTML ファイル**（CDN依存ゼロ・ダブルクリックで起動）になります。
1 つのリポジトリに**複数のデッキ**（`decks/<名前>/`）を置き、部品・見た目の土台・記法の処理を共有します。

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
- **土台は用途に特化しない**。部品（`src/components`）・見た目の土台（`src/theme`）・記法の処理（`vite/`）は
  数学の資料にも業務マニュアルにも使える汎用のものだけを持ち、すべてのデッキで共有する。
  用途への特化は各デッキの `decks/<名前>/style.css`（とプリセット）で行う。

## 技術スタック

| 領域 | 採用 |
|---|---|
| 執筆 | MDX (`decks/<名前>/deck.mdx` と `\input` で取り込むファイル) + TSX |
| ビルド | Vite 8 + `@mdx-js/rollup`（React 19・TypeScript 7・Vitest 5） |
| スライド | reveal.js 6 (`@revealjs/react`) |
| 記法 | `vite/remark-beamer/`（LaTeX / Beamer 風記法の remark プラグイン） |
| 数式 | `remark-math` + MathJax 3（SVG。式番号・`\label`・`\eqref` は AMS の規則。後ろにある式への参照も解決する。字形は文書全体で 1 回だけ持ち、各数式には画面に見えない MathML（assistive MathML）を添える） |
| 文献 | BibTeX (`decks/<名前>/references.bib`) + `rehype-citation`（CSL: NLM/Vancouver 角括弧版。公式リポジトリの `vite/csl/nlm-citation-sequence-brackets.csl`） |
| その他 | Tailwind CSS v4 |
| 図 | visx（React + D3 の SVG の部品）で React コンポーネント化。点や線のドラッグ・スライダーで操作できる |
| 配布 | `vite-plugin-singlefile` で単一 HTML 化、フォントは subset woff2 |

## 必要環境

- Node.js 18 以上（開発は v24 で確認）

## セットアップ / コマンド

```bash
npm install                    # 依存インストール
npm run decks                  # デッキの一覧
npm run new -- <名前>          # デッキを作る(decks/<名前>/ に deck.mdx と style.css。名前は英小文字・数字・ハイフン)
npm run dev                    # 開発サーバー(HMR)。全デッキを 1 つのサーバーで配信し、/<名前>/ がそのデッキ、/ が一覧(デッキ × モードの表)
npm run build [-- <名前>...]   # ビルド → dist/<名前>/(静的ファイル群、ホスティング向け)。名前を省くと全デッキ
                               # --mode <モード> で motion.ts とは別のモードでビルド(dist/<名前>/<モード>/)
npm run build:single [-- <名前>...]  # 単一ファイルビルド → dist/<名前>/index.html 1 枚に全インライン
npm run lint [-- <名前>...]    # 単一ファイルをビルドし、はみ出しだけを検査して原稿の位置を一覧にする(あれば失敗)
npm run shots [-- <名前>...]   # 単一ファイルを reveal モードでビルドし、PDF 用の表示の全ページを screenshots/<名前>/NN.png に、一覧を all.png に撮る
                               # (見た目の確認用。git には入れない。--handout で配布用の表示を screenshots/<名前>/handout/ に)
npm run pdf [-- <名前>...]     # 単一ファイルを reveal モードでビルドし、pdf/<名前>.pdf(段階表示はステップごと)と pdf/<名前>-handout.pdf(配布用)を書き出す
npm run preview                # ビルド結果をプレビュー(/<名前>/ でデッキ)
npm run subset                 # フォントを全デッキで使う文字だけに再サブセット(下記)
npm run typecheck              # 型チェック(ブラウザ側 tsconfig.json + ビルド側 tsconfig.node.json + e2e)
npm run test                   # テスト(Vitest)。transform: 記法の変換とビルド設定 / render: 全デッキを実際に描いて番号・参照・構造を確かめる
npm run test:e2e               # e2e テスト(Playwright)。ビルドしたデッキを Chrome で開き、全デッキのはみ出し(本番のビルド)と書体、legendre の図の操作、landau の PDF 用の表示を確かめる
npm run check                  # typecheck + test + build:single(全デッキ) + build:single -- --mode reveal(全デッキ) + test:e2e。コミット前に実行する
```

- デッキの名前はコマンドの引数で渡します（`npm run build -- landau`）。環境変数は使いません。
  中身は `scripts/deck.mjs` で、Vite を JS の API で呼び、`vite.config.ts` の `deckConfig` にデッキの名前を引数として渡します
  （Vite のコマンドは任意の引数を設定に渡せないので、`vite build` を直接は使いません）。
- `build` / `build:single` / `shots` / `pdf` は先頭で自動的に `subset` を実行します。
- ビルドでは原稿の警告も失敗扱いです。警告があってもビルドするときは `npm run build -- <名前> --allow-warnings`。

## ディレクトリ構成

```
decks/                 デッキ(1 フォルダ = 1 デッキ。vite/decks.js)。どれも具体的な資料で、それぞれ別の見本を兼ねる
  <名前>/
    deck.mdx           原稿の主ファイル(--- で横、-- で縦に区切る。必須)
    style.css          このデッキの見た目の特化(プリセットの読み込み・トークンの上書き・このデッキの図の規則。必須)
    references.bib     BibTeX 文献データ(\cite を使うデッキだけ)
    motion.ts          動きの設定(モード・スライドごとの遷移。無ければ reveal。「動きの設定」)
    slides/ img/       \input{…} で取り込む原稿 / このデッキの画像(原稿から ./img/… で import する)
    components/        このデッキだけの部品(図など。原稿から ./components/… で import する)
  components/          (必要になったら)いくつかのデッキで共有するが、土台にするほど汎用ではない部品。デッキの名前には使えない
  demonstration/       モードの見本。モードを 1 つずつ説明し、そのモードのデッキをスライドの中に本物のまま埋め込む
                       (components/LiveDeck。iframe で ../<デッキ>/index.html。埋め込むデッキもビルドし、dist を丸ごと配る)。reveal モード
  landau/              複雑な数式の見本。Landau 減衰の線形計算(C. Villani『Birth of a Theorem』第 4 章の草稿の導出)と、
                       付録「この資料の書き方」(slides/guide.mdx: 記法の一覧・定理環境・align・段階表示・可換図式)。reveal モード
  legendre/            画像と SVG の見本。ルジャンドル部分多様体の母関数(卒業研究の発表を組み直したもの)。
                       元の資料の画像(img/)と操作できる SVG の図(components/)、付録に図の部品(4 点・対数螺旋・地球儀・d3)。Spectacle モード
  manifold/            impress の zoom(Prezi 風)の見本。多様体の基礎(位相多様体・アトラス・可微分構造・接空間)。
                       節の最初のスライドを題と一言にして、節の中の続きがその下半分に小さく並ぶ。impress モード
  trial-balance/       表組の見本。試算表の作成(右揃えの金額・合計の行・表の題)。Swiper モード(cards の演出)
  manual/              形式的な文書の見本。記帳業務の手順書(目的・手順・注意・用語・枠の使い分け)。Shower モード(一覧から入る)
index.html             全デッキで共通の器(題と入口のスクリプトは vite.config.ts がデッキごとに入れる)
src/                   全デッキ・全モードで共有する土台(用途に特化しない)
  main.tsx             起動(土台の CSS を読み、デッキの入口から原稿とモードを受け取って描く。モードは入口が motion.ts から決める)
  deck/                モードに依らない仕組み
    source.ts          原稿のコンパイル結果の型(DeckSource。どのモードも受け取る)
    mode.ts            モードとまわり(図・開発時の道具・テスト)との約束(今のスライドの知らせ・移り方・準備完了の印)
    slide-metrics.ts   スライドの最小サイズ 933×700(原稿が当てにしてよい大きさ。ビルド側も読む)
    view-size.ts       スライドの表示の大きさ(窓と同じ縦横比に広げて窓全体を覆う。どのモードも同じ)
  components/          文書の部品(どのモードでも同じ)
    index.ts           原稿から import なしで使える部品の一覧
    Frame / Theorem / layout / Notes  色付きの枠 / 定理・定義・証明 / 段組み・中央寄せ・署名・注・コード / スピーカーノート
  figure/              図を作る道具(ドラッグ・リセットと再生のボタン・表示中のスライドだけで動かす・数式用イタリックのラベル)
  modes/               モード(スライドを動かすライブラリごとの作り。docs/motion.md)
    names.ts           モードの名前と開き方の変わり種(開発サーバーの一覧ページと共有)
    structure.tsx      構造の部品(Slide・Stack・Overlay)の共通の約束と、段の表示の判定
    marker-steps.tsx   段の印(impress・Shower。Swiper も表示の判定に使う)
    page-number.tsx    ページ番号「i/全体」(reveal 以外。reveal は reveal のもの)
    reveal/            既定のモード: RevealApp・構造の部品・Overlay(fragment)・Menu(スライド一覧)・
                       slide-size(窓と紙の大きさ)・slide-title・reveal.css(ページ番号・矢印・印刷用の表示など)
    impress/ shower/ spectacle/ swiper/  試作のモード
  devtools/            開発時の道具(原稿の警告とはみ出しの一覧・はみ出しの検査。どのモードでも同じ)
  theme/               見た目の土台。詳しくは「見た目のカスタマイズ」
    index.css          入口(tokens → base の順に読み込む。この後にモードの CSS、デッキの style.css が入る)
    tokens.css         トークンの既定値(色・書体・文字の段階・間隔)
    base.css           汎用の規則(トークンから導いた値だけを使う)
    fonts.css          土台の書体(本文の明朝 Noto Serif JP・見出しと強調のゴシック Noto Sans JP・等幅・図のラベルの数式用 New Computer Modern Math)
    presets/math.css   数学向けのプリセット(欧文と数字を New Computer Modern に)
    presets/manual.css 業務マニュアル向けのプリセット(本文もゴシック・太さで強調・等幅数字・手順の番号を太く)
  fonts/               subset 済み woff2(全デッキの文字の和)
  render.test.tsx      全デッキを実際に描いて確かめるテスト(節番号・メニュー・参照・数式・文献・構造)
vite.config.ts         Vite の設定(deckConfig: デッキの名前を受け取ってビルドの設定にする。引数なしは全デッキの開発サーバー)
vite/                  記法の処理(ビルド時)
  decks.js             デッキの一覧と場所(vite.config.ts と scripts/ が共有)
  mdx-options.ts       MDX のコンパイル設定(remark / rehype プラグインの構成。文献は原稿の属するデッキのもの)
  rehype-mathjax-document.ts  数式を 1 つの MathJax 文書として描く(後ろにある式への参照も解決)
  csl/                 引用スタイル(CSL。公式リポジトリのものをそのまま置く)
  remark-beamer/       LaTeX / Beamer 風記法の remark プラグイン
    syntax.ts          micromark の構文拡張(どこからどこまでが記法か)
    mdast.ts           構文木ノードへの変換
    transform.ts       意味づけ(スライド分割・環境・節番号と定理番号・参照・引用・段階表示)
    rehype-math-errors.ts  MathJax の数式エラーを原稿の位置で報告
docs/                  設計の方向と調査(motion.md: 動きのライブラリごとのモード)
e2e/                   e2e テスト(Playwright。入っている Chrome を使う)
fonts-src/             サブセット元のフルフォント(.ttf / .otf)とライセンス。ビルド成果物には含めない
scripts/
  deck.mjs             デッキのコマンド(list / new / dev / build / shots / pdf。npm run の各コマンドが呼ぶ)
  capture.mjs          撮影と PDF の書き出し(ビルドした単一 HTML を Chrome で開く)
  subset-fonts.mjs     フォントサブセット化スクリプト
```

## 執筆方法

記法は 3 層です。**本文は Markdown、構造と数学は LaTeX / Beamer、図や自由なレイアウトは MDX(JSX)**。
LaTeX / Beamer 風の記法はすべて JSX の部品に変換されるので、同じことを JSX でも書けます。

### デッキ
1 つのデッキは `decks/<名前>/` の 1 フォルダです。`npm run new -- <名前>` で、原稿の主ファイル `deck.mdx` と
見た目の特化 `style.css` の雛形を作ります。`npm run dev` を起動しておけば、`http://localhost:5173/<名前>/` で開けます
（一覧は `/`）。開発サーバーは 1 つで全デッキを配信しますが、変換するのは開いたデッキの原稿だけです。

- 定理・式・節の番号と文献リストは、デッキごとに 1 から振られます。
- 文献を使うデッキは、フォルダに `references.bib` を置きます。無いデッキで `\cite` を書くとエラーになります。
- 文書の部品（定理・枠・段組みなど。import なしで使える）と見た目の土台はすべてのデッキで共有します。
  デッキだけで使う画像や部品（図など）は、デッキのフォルダ（`img/`・`components/`）に置いて相対パスで import します
  （`import d3js from './img/d3js.png'`、`import Globe from './components/Globe'`）。いくつかのデッキで共有するが
  土台にするほど汎用ではない部品は、`decks/components/` に置きます（そのため `components` という名前のデッキは作れません）。

### スライドの区切り
原稿の主ファイルは `decks/<名前>/deck.mdx` です。分けたい部分は LaTeX と同じ `\input` で取り込みます（下記）。

```mdx
import Globe from './components/Globe'

## 1 枚目

---

## 2 枚目

--

## 2 枚目の下(縦スライド)
<Globe size={300} />
```

- `---`（行単独）で横のスライド、`--`（行単独）で縦のスライド（直前のスライドの下）に区切ります。
- 区切りの前後には空行を入れます（直前が文章だと Markdown の見出しと解釈されるため）。横線が要るときは `***`。
- 縦スライドの進め方は reveal モードの `src/modes/reveal/RevealApp.tsx` の `navigationMode`（`'linear'` にすると ←→ だけで縦も順に進む）。
- デッキの部品は原稿の先頭で `./components/...` から、デッキの画像は `./img/...` から import します。

### ファイルの取り込み（`\input` と import パッケージ）
LaTeX の `\input` と、標準の [import パッケージ](https://ctan.org/pkg/import) の `\import` / `\subimport` が使えます（行単独で書く）。

| 書き方 | パスの基準 | 取り込んだファイルの中での `\input` |
|---|---|---|
| `\input{file}` | 主ファイル（`decks/<名前>/deck.mdx`）のディレクトリ | 変わらない |
| `\import{path/}{file}` | 絶対パス、または主ファイルのディレクトリ | **`path/` を先に探し、無ければ主ファイルのディレクトリ** |
| `\subimport{path/}{file}` | **今いるファイルの基準ディレクトリ**からの相対（入れ子にできる） | 同上（基準が `…/path/` になる） |

`\inputfrom` / `\subinputfrom` は `\import` / `\subimport` の別名、`*` 付きも同じです。

```latex
% deck.mdx
\import{parts/}{a}          % parts/a.mdx

% parts/a.mdx の中
\input{b}                   % parts/b.mdx(自分の場所が先)
\input{common}              % parts に無ければ主ファイル側の common.mdx
\subimport{deep/}{c}        % parts/deep/c.mdx。その中の \input{d} は parts/deep/d.mdx
```

- 「ファイルからの相対」と「主ファイル（ルート）からの相対」を混ぜたいときは、`\import` / `\subimport` で取り込みます。
  `\input` で取り込んだファイルの中は、LaTeX と同じく主ファイル基準のままです。
- 探す順は LaTeX と同じで、まず `.mdx` を付けた名前、無ければ書いたままの名前（`chapter.v2` → `chapter.v2.mdx`、`notes.md` → `notes.md`）。
  `..`・デッキのフォルダの外・空白・日本語・絶対パスも使えます。区切りは `/` で書きます（`\` は Windows でしか通じません）。`@/` などのエイリアスは使えません。
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

- 環境: `theorem` `lemma` `proposition` `corollary` `definition`（既定では 1 本の通し番号・見出しは英語）、`proof`（番号なし・末尾に ∎）
- `[…]` は括弧書きの名前（数式も書ける。`proof` では見出し語の置き換え）。`\begin` / `\end` は行単独で書きます。
- JSX でも書けます: `<Theorem heading="定理" title="Jensen" id="thm:jensen">…</Theorem>`（`heading` は見出しの語、`title` は括弧書きの名前）。

見出しの語と番号の付け方は、amsthm と同じ `\newtheorem` で決めます（原稿の先頭など、その環境を使う前に行単独で書く）。

```latex
\newtheorem{theorem}{定理}[section]      % 節ごとの番号(定理 2.1)。subsection なら 2.1.1
\newtheorem{definition}[theorem]{定義}   % theorem と番号を共有する
\newtheorem{example}{例}                 % 新しい環境(その環境だけの通し番号)
\newtheorem*{remark}{注意}               % 番号なし
```

- 節はスライドの題の番号（横のスライドが節、縦のスライドの 2 枚目以降が小節）。
- 宣言しない環境は既定のまま（`\newtheorem{theorem}{Theorem}`、`\newtheorem{lemma}[theorem]{Lemma}` …… と宣言したのと同じ）。
  既定の環境は宣言し直せます。JSX で書いた `<Theorem>` などにも宣言の見出しと番号が付きます（`heading` を書けばそちら）。
- 二重の宣言、使った後の宣言、無い共有先、使えない区切り（section / subsection 以外）はエラー。
- 見本: `decks/legendre/`（節ごと。元の資料と同じ「定義 2.1」）、`decks/landau/`（通し番号。日本語の見出し）。

### 数式と相互参照
| 書き方 | 意味 |
|---|---|
| `$…$` / `$$…$$` | インライン / 別行立て（番号なし） |
| `\begin{equation}…\end{equation}` | 番号付き（`$$` で囲まなくてよい） |
| `\begin{align}` / `\begin{gather}` | 行ごとに番号。`\nonumber` / `\notag` / `\tag{…}` の行は自動番号なし |
| `\begin{equation*}` / `\begin{align*}` … | 番号なし |
| 定理環境や式の中に `\label{key}` | 参照先として登録 |
| スライドの題に `\label{key}`（`## 主定理の紹介 \label{sec:main}`） | そのスライド（節）を参照先として登録（LaTeX の `\section{…}\label{…}` と同じ） |
| `\ref{key}` / `\eqref{key}` | 番号 / `(番号)`。参照先へのリンクになる（LaTeX の hyperref と同じ） |
| `[文字](#key)`（CommonMark）・`<a href="#key">`（JSX） | 参照先へのリンク（文字は自分で書く） |

- 定理の番号はビルド時にデッキ全体の出現順で振ります。**式の番号と式の参照は MathJax**（AMS と同じ規則）が処理します。
- `\label` は HTML の `id` になります（スライドの題なら `<section id="…">`、定理なら定理の要素）。リンクを押すと、
  どのモードでもその飛び先を含むスライドへ移ります（`src/deck/links.ts`）。ラベルの名前は LaTeX の慣習どおり
  `sec:`・`thm:`・`eq:` などの接頭辞で分けると、ほかの id と衝突しません。重複は警告です。
- スライドへのリンクに、ライブラリの形の hash（reveal の `#/4` など）は書きません（スライドを足し引きするとずれ、ほかのモードでは移れない）。
- 可換図式は `\begin{CD}…\end{CD}`（`$$` の中）。

### 段階表示（Beamer の overlay → reveal の fragment）
| 書き方 | 意味 |
|---|---|
| `\pause`（行単独） | 以降を次のステップで表示。環境や `<Col>` などのブロックの中ではそのブロックの終わりまで |
| `\uncover<2->{…}` / `\visible` / `\onslide` | 指定ステップで表示。非表示の間も場所は残る。`- \uncover<+->{…}` で項目を 1 つずつ |
| `\only<2>{…}` | 指定ステップだけ表示。非表示の間は場所も消える |
| `\begin{theorem}<2->` | 環境ごと段階表示 |
| `<Fragment>…</Fragment>` | `\pause` と同じく次のステップで表示。`\pause` と違い、後ろの本文は隠さない（どのモードでも同じ） |

指定は Beamer と同じく `<2->`、`<2>`、`<2-3>`、`<-3>`、`<+->`。ステップ数も Beamer と揃えています。
`\only` / `\uncover` が段落の中にあれば文中に、段落全体ならブロックとして表示します（LaTeX と同じく、空行の無い連続した行は 1 段落）。

### 文献の引用
デッキのフォルダの `references.bib`（`decks/<名前>/references.bib`）にエントリを追加し、本文で LaTeX と同じく `\cite{key}`、`\cite{a,b}`、`\cite[p.~5]{key}` と書きます。
番号付け・整形・文献リストは rehype-citation（CSL）が行い、`<Bibliography />` の位置に文献リストが入ります。
本文の引用は `[1]` / `[1,2]` の形です（CSL: NLM/Vancouver 角括弧版）。このスタイルは頁指定（`[p.~5]`）を表示しません。
スタイルを替えるときは CSL の公式リポジトリ（citation-style-language/styles）のファイルを `vite/csl/` に置いて
`vite/mdx-options.ts` で指定します。

### その他の部品（import なしで使える）
| 部品 | 用途 |
|---|---|
| `<Notes>` | スピーカーノート。発表者ビューにだけ出る（開き方は「動きの設定」のキーの表） |
| `<Frame color="blue" title="...">` | 色付きフレーム（gray / red / blue / gold / green / purple） |
| `<Cols>` `<Col>` `<Center>` `<Byline>` `<Note>` `<Code>` | レイアウト |

一覧は `src/components/index.ts`。個別の図（`Globe` など）はデッキの `components/` に置き、原稿の先頭で import します。
コード（`` `…` ``、コードブロック、テンプレート文字列）と数式の中の記法は変換されないので、記法の説明はそこに書けます。

### 強調・用語・脚注などの書き方（標準の記法の範囲）
見本は `decks/legendre/deck.mdx`（色と強調・出典・用語・脚注を、資料の中で使っている）。どれも変換処理に手を加えず、CommonMark・JSX・LaTeX（MathJax）の標準の書き方で書けます。

| したいこと | 書き方 |
|---|---|
| 新しく定めた用語・行頭のラベル（「疑問：」「答え：」） | `**用語**` |
| 文の一部に色 | `<span style={{ color: 'var(--color-frame-red)' }}>任意の</span>` |
| 数式の一部に色 | `\textcolor{red}{S}`。色は名前（`red` など）か `\definecolor{名前}{RGB}{235,235,235}`（`gray` 形式も可。一度定義すれば後の数式で使える） |
| 大事な式を囲む | `$\colorbox{lightgray}{\(K = \ker\xi\)}$`（中の式は `\(…\)` で書く。`$…$` は外側と衝突する） |
| ブロックの見出しに出典 | `\begin{theorem}[ダルブーの定理 \cite{key}]` |
| 用語と説明（description 環境） | `<dl>` `<dt>用語</dt>` `<dd>説明</dd>` `</dl>` |
| 脚注 | 本文に `<sup>*1)</sup>`、下に `***`（区切り線）と `<small>*1) …</small>` |
| 再掲・補足 | `<small>（再掲）…</small>` |
| 要点を中央に | `<Center>` |
| 別のスライドへのリンク | 題に `\label{sec:env}` を付けたスライドへ `[定理環境のスライド](#sec:env)`（どのモードでも移る。上の「数式と相互参照」） |
| 節番号 | 自動。横のスライドが `4.`、その下の縦のスライドが `4.1.` |

次のものは今の構成では書けません。

| したいこと | 理由 |
|---|---|
| `\footnote` | LaTeX の命令として未対応（エラーになる）。上の手書きの脚注で代える |
| `\begin{description}` / `\begin{itemize}` / `\emph` / `\textbf` | 未対応（エラーになる）。CommonMark と JSX（`<dl>`・リスト・`**`）で書く |
| スライドごとの文献リスト（使った文献だけ） | `<Bibliography />` はどこに置いても全文献を出す（rehype-citation の動き） |
| `\definecolor{…}{HTML}{EBEBEB}` | MathJax が HTML 形式に未対応。`RGB` か `gray` 形式で書く |

### 記法エラーと警告
不完全な原稿から成果物は作りません。どれも **原稿（`deck.mdx` と取り込んだファイル）の行番号** で報告します（unified の VFile メッセージ）。

| 種類 | 例 | `npm run dev` | `npm run build` |
|---|---|---|---|
| エラー | 環境の閉じ忘れ・`\end` の不一致、未対応の環境・命令、数式の誤り（MathJax）、不正な overlay 指定、環境の外の `\label`、文献ファイルの無いデッキでの `\cite`、MDX の構文エラー | エラー画面 | 失敗 |
| 警告 | 参照先の無い `\ref`、未登録の文献、`\label` の重複 | 画面右上に一覧 | 失敗（`--allow-warnings` で許可） |
| はみ出し | スライドの最小サイズ（933×700）超過、コードの枠からはみ出す行 | 最小サイズの範囲の赤い破線枠とバッジ・コンソール | `npm run check` の e2e テストが失敗 |

### はみ出しの検出
`npm run dev` 中、スライドの最小サイズ（933×700）を縦か横に超えたスライドと、コードの行が枠からはみ出す
スライド（枠の中ではスクロールになり、発表では行の続きが見えない）は、書きながら次の 3 か所で分かります。

- そのスライド: 最小サイズの範囲に赤い破線の枠と、超過量のバッジ
- 画面右上の一覧: デッキの全スライドのはみ出しが、原稿の行と超過量で並ぶ。押すとそのスライドへ移る
- 開発サーバーの端末: はみ出しが出た・変わった・消えたときに、`decks/<名前>/deck.mdx:行` の形で出る
  （エディタで原稿を書いていて、ブラウザを見ていなくても気づける）

ブラウザを開かずに確かめるときは `npm run lint -- <名前>`（ビルドして、はみ出しだけを検査して一覧にする。あれば失敗で終わる）。
はみ出しを自動で縮めて収めることはしません（誤りは補わずに報告する。文字の大きさがスライドごとにばらつかないように）。
スライドはウィンドウ全体を覆うので、いまの画面に収まって見えても、別の縦横比の画面では枠の外が切れます。
検査はウィンドウの大きさに依らず、スライドを最小の幅で組み直して測ります。
同じ検査を、ビルドしたデッキを `?check-overflow` で開いて行う e2e テスト（`e2e/overflow.spec.ts`）が全デッキで走るので、
`npm run check` を通せば、はみ出したスライドが原稿の位置付きで報告されます。

数式はビルド時に MathJax が組むので、MathJax は画面の幅を知りません。幅に依る組み方（`multline` の行の寄せなど）は、
最小サイズのスライドの本文の幅で組みます（`vite/mdx-options.ts` の `CONTAINER_WIDTH_EX`）。

### 図（インタラクティブ可視化）
デッキの `components/`（いくつかのデッキで共有するなら `decks/components/`）に React コンポーネントとして追加。visx の部品（縮尺 `@visx/scale`、座標軸 `@visx/axis`、
格子 `@visx/grid`、図形 `@visx/shape`、地図 `@visx/geo`）で SVG を組み、状態は React の state で持つ。
図を作る道具は `src/figure/`（`@/figure/…` で import）。ドラッグは `useSvgDrag.ts`（モードの拡大縮小があっても図の座標で受け取れる）。
SVG なので拡大しても鮮明で、印刷・PDF にもそのまま残る。色は `theme/base.css` の `.figure-*`（点・取っ手・ラベル・軸・系列など、図に共通の語彙）でトークンから決め、1 つの図に固有の色はデッキの `style.css` に書く。

## 動きの設定（モードと遷移）

原稿（本文）には動きの指定を書きません。原稿は内容の意味だけを書き、スライドをどう動かすか（モード・遷移）は
デッキのフォルダの `motion.ts` に置きます（無ければ reveal で、遷移も reveal の既定のまま）。

```ts
// decks/<名前>/motion.ts
import type { MotionConfig } from '@/modes/motion'

export default {
  mode: 'spectacle', // このデッキの既定のモード(reveal・impress・shower・spectacle・swiper。docs/motion.md)
  transition: 'slide', // 既定の遷移
  section: 'cube', // 新しい節(---)へ入るとき
  continuation: 'cards', // 節の中の続き(--)へ入るとき
  transitions: {
    // 個別のスライドへ入るとき。スライドは題に書いた \label の名前で指す(## 主定理の紹介 \label{sec:main})
    'sec:main': 'zoom',
  },
  impress: {
    // impress モードでの置き方。layout は grid(横の並びを右へ・縦の続きを下へ。既定)、spiral(文書の順に螺旋に沿って)、
    // zoom(Prezi 風。節の最初のスライドを大きな枠にし、節の中の続きをその下半分に小さく置く。全体を見渡すところから始まる)
    layout: 'spiral',
    // 個別のスライドの置き場所(ラベルで指す)。書いた項目だけが layout の値を置き換える
    // (x・y・z は中心の座標(px。スライドは 933×700)、rotate・rotateX・rotateY は回転(度)、scale は倍率)
    positions: { 'sec:main': { z: -1500, scale: 2 } },
  },
  reveal: {
    // reveal モードでの表示。scroll はスクロールビュー(スライドを縦に並べた 1 ページにし、スクロールで進む。Web で読ませる資料に)
    view: 'scroll',
  },
} satisfies MotionConfig
```

- 遷移の名前は none・slide・fade・zoom・cube・cards・flip。モードごとに使えるものが違います
  （Spectacle はすべて、reveal は none・slide・fade・zoom、Swiper はデッキの既定だけ。`src/modes/names.ts` の `MODE_TRANSITIONS`）。
- 優先は ラベル → 構造の規則（`section`・`continuation`）→ 既定（`transition`）。ほとんどのデッキは構造の規則だけで足ります。
  本文の文字（題）では指しません（題は内容の都合で直すので）。`\label` は動きの命令ではなく、そのスライドの名前（`\ref` やリンクにも使う）です。
- 無いラベル・スライドの題のものではないラベル・そのモードで使えない遷移・無い並べ方は、原稿の警告と同じく `motion.ts` の行付きで報告されます
  （開発時は画面右上の一覧、本番のビルドは失敗）。名前の書き間違いは型検査でも分かります。
- ビルドしたデッキには `mode` のモードだけが入ります（モードを切り替える仕組みは持たない）。
  開発サーバーでは `/<デッキ>/<モード>/`（例: `/legendre/impress/`）でほかのモードでも開けます（一覧ページの表から選べる）。
  `motion.ts` を直すと、開発サーバーはページを読み直します。
- 発表者ビューと一覧は、各ライブラリのキーで開きます（単一 HTML をダブルクリックで開いた `file://` でも動く）。

  | モード | 発表者ビュー | 一覧 |
  |---|---|---|
  | reveal | `S`（別窓） | `Esc`・`O` |
  | Spectacle | `Ctrl+Shift+P`（Mac は `⌘+Shift+P`）。聴衆用のデッキは別のタブで開く | `Ctrl+Shift+O` |
  | impress | なし | `O`（全体を見渡す） |
  | Shower | なし | `Esc`（一覧と全画面を行き来する） |
  | Swiper | なし | `Esc`・`O` |
- `motion.ts` は Node がそのまま読むので（型の注釈を外して読む）、import は型だけ（`import type`）にします。

## 見た目のカスタマイズ

見た目は 3 層で、後のものが前のものを上書きします。

| 層 | ファイル | 範囲 |
|---|---|---|
| トークン | `src/theme/tokens.css` | 全デッキで共有 |
| 汎用の規則 | `src/theme/base.css`（書体は `fonts.css`） | 全デッキで共有 |
| 特化 | `decks/<名前>/style.css`（プリセットの読み込み・トークンの上書き・独自の規則） | そのデッキだけ |

デッキだけの見た目は、そのデッキの `style.css` に書きます。土台（tokens / base）を書き換えると、全デッキに効きます。

```css
/* decks/<名前>/style.css */
@import '@/theme/presets/math.css';    /* 数学向け: 欧文と数字を New Computer Modern に */
@import '@/theme/presets/manual.css';  /* 業務マニュアル向け: 本文もゴシック、強調は太さで */

:root {
  --deck-preset: math;                 /* デッキ全体にかけるプリセット(空白区切りで複数可) */
  --color-brand: #0a7d5a;              /* トークンの一覧と既定値は src/theme/tokens.css */
  --text-base: 26px;
}
```

プリセットは `[data-preset~="名前"]` の範囲にかかります。デッキ全体には `--deck-preset` で
（起動時に `<html data-preset>` へ移します）、一部のスライドだけには原稿で囲んでかけます。

```mdx
## データ入力

<div data-preset="manual">

（このスライドの中身だけ業務マニュアル向けの見た目になる）

</div>
```

見本は `decks/manual/` と `decks/trial-balance/`（業務マニュアル向けのプリセットをデッキ全体にかけている）。

用途に共通する改善はテンプレート（tokens / base）へ、特定の用途に寄った見た目はプリセット
（`src/theme/presets/`）へ入れます。

## フォントのサブセット

日本語フォントは元は約 28MB。実際に使う文字だけに絞ることで合計約 600KB(woff2) にしています。
`scripts/subset-fonts.mjs` が `src/` と全デッキ（`decks/`）の `*.{mdx,tsx,ts,bib}` と、原稿が `\input` で取り込むファイルを
走査して使用文字を集め（書体は全デッキで共有するので、全デッキの文字の和）、
`fonts-src/*.{ttf,otf}` → `src/fonts/*.woff2` を生成します。

**テキスト（特に日本語）を増やしたら `npm run subset` を実行**して `src/fonts/*.woff2` を更新・コミットしてください。
（`build` では自動実行されます）

## PDF 出力

`npm run pdf -- <名前>` で、ビルドから PDF まで書き出します（`pdf/<名前>.pdf` と、配布用の `pdf/<名前>-handout.pdf`。
名前を省くと全デッキ。git には入れない）。

PDF 用の表示は reveal モードのものなので、`npm run pdf` と `npm run shots` はデッキを reveal モードでビルドします（`dist/<名前>/reveal/`。
デッキのモードが別でも、PDF は reveal で組む）。手で書き出すときは、reveal モードのデッキを URL に `?print-pdf` を付けて開き、
ブラウザの印刷 → PDF に保存（デッキのモードが reveal でなければ `npm run build:single -- <名前> --mode reveal` でビルドしたもの、
開発サーバーなら `/<名前>/reveal/?print-pdf`）。
印刷設定は **余白=なし / 背景のグラフィック=ON** を推奨（フレームの色を出すため）。

ページの大きさは紙の大きさで、既定は **A4 横**。`src/modes/reveal/slide-size.ts` の `PRINT_PAPER`（mm）で変えられます
（例: B5 横なら `{ width: 257, height: 182 }`）。スライドはその大きさで組み直されるので、
画面の最小サイズ（933×700）より広い A4 横では、余白に少しゆとりが出ます。

段階表示（`\pause`・`<2->` など）は、Beamer の既定と同じくステップごとに 1 ページになります。
配布用には `?print-pdf&handout` で開くと、Beamer の handout モードと同じく、各スライドを最後の状態の 1 ページだけにします
（reveal の `pdfSeparateFragments: false`）。

## 既知の制約

- `@revealjs/react` は 0.x（pre-1.0）。API が変わる可能性あり。
- 数式は MathJax の SVG と、画面に見えない MathML を埋め込む（字形の輪郭は文書全体で 1 回だけ持つ）。

## 次にやること

- 表紙の双対のグラフ（3D の曲面）を visx の図にする。描く関数（$f = \tfrac12 x^2 + \tfrac13 y^3$ とその双対か）の確認待ち。
- 今は書けない LaTeX の標準の記法: `\footnote`、`description` 環境、スライドごとの文献リスト、
  証明の見出しの語（`\renewcommand{\proofname}{証明}`。今は「Proof.」のまま）。
- 開発用の依存の脆弱性警告（`braces`、`vite-plugin-singlefile` 経由）。修正版が出たら更新する。

### Spectacle / MDX Deck との比較から（方向は決定。着手の時期は未定）

[Spectacle](https://github.com/FormidableLabs/spectacle)（React の部品でスライドを組む。開発が続いている）と
[MDX Deck](https://github.com/jxnblk/mdx-deck)（MDX を `---` で区切る。2020 年で止まっている）を調べた結果。
スライドを動かす部分は重なるが reveal.js に任せていて、このリポジトリの中身の大半（LaTeX / Beamer の記法、
番号・参照・文献のビルド時の解決、はみ出しの検査、警告で止まるビルド、単一 HTML、handout、和文の組版）は両方に無い。

取り込むもの（効果の大きい順）:

1. **段階表示に図の部品が加わる仕組み**（Spectacle の `useSteps` に当たる）。図の部品が段階表示の 1 段として並び、
   今の段を受け取れるようにする（段階表示と図の状態の連動）。原稿の書き方（overlay 指定）は変えず、部品の側だけで足す。
   各モードの `Overlay` の実体（reveal は fragment、impress は substep）の上に、モードごとに載せる。
2. **Beamer の題目の情報**（`\title` / `\author` / `\date` と `\maketitle`、footline）。表紙を `<Byline>` で手書きする代わりに、
   Beamer の標準の書き方で表紙と各ページの下端の題目・著者を作る。原稿の書き方に関わるので、設計を提案して承認を得てから。
3. **コードの行の強調を段階にする**（Spectacle の `CodePane` の `highlightRanges`）。LaTeX に標準の書き方が無いので、記法ではなく部品で。
4. **1 ファイルのデッキ**（MDX Deck の Gatsby テーマの `decks/*.mdx`）。画像や文献を持たない小さなデッキ向け。
   今の「1 フォルダ = 1 デッキ」と 2 通りになるので、優先は低い。

取り込まないもの: Spectacle の `FitText`（文字を自動で縮めて枠に収める。はみ出しを補うことになり、文字の大きさもスライドごとにばらつく）。
発表者モードと一覧モードは reveal.js にある。

見直すアーキテクチャ:

- **動きのライブラリごとのモード**（詳しくは [docs/motion.md](docs/motion.md)）。reveal.js・impress.js などを完成品のまま使い、
  原稿の変換が出す中立の部品（`Slide`・`Overlay` など）を、ライブラリごとの実体に対応させる。見た目は土台（`.deck`）が持ち、
  どのモードでも同じ。impress・Shower・Spectacle・Swiper の各モードは試作中（デッキの `motion.ts` の `mode` で選ぶ。開発サーバーでは `/<デッキ>/<モード>/`）。共通の書き方は、モードを増やしながら固める。
  ほかのライブラリ（Shower・Swiper・Zumly ほか）の調査も docs/motion.md に。
- **土台の配り方**。デッキを別のリポジトリで持ちたくなったら、土台（部品・見た目・記法の処理・コマンド）を npm のパッケージにして配る
  （Spectacle・MDX Deck と同じ形）。同じリポジトリに `decks/` を置く今の形で困らないうちは、このまま。

変えないもの: 番号・参照のビルド時の解決、原稿の位置付きで止める厳しいビルド、CSS のトークン（どちらのライブラリにも無い強み）。
