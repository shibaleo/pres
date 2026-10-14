# モード: スライドを動かすライブラリごとの作り（方向・試作・調査）

このリポジトリに reveal.js から期待しているのは、画面遷移の美しさ（動き）だけである。
内容の組版（MDX + LaTeX の記法）と見た目（CSS）はほぼできているので、**動きのライブラリを選べる**ようにしたい。
reveal.js のほかに impress.js のようなズーム型、Sozi 風の見せ方も選べるとなおよい。

## 構成: ライブラリごとのモード

ライブラリは完成品として**そのまま**使い、ライブラリごとに「モード」を作る。

- **内容の層は中立に保つ**。原稿の変換（vite/remark-beamer）が出すのは部品の名前だけ:
  `Slide`（並び `h`・`v` と段の数 `steps`、原稿の位置 `data-slide-*` を持つ）・`Stack`（縦の続き）・`Overlay`（`from`・`to`・`only`・`as`）。
  型と「段 k で見せるか」の判定は `src/modes/structure.tsx`。文書の部品（定理・枠・段組み・`Notes`）は `src/components/` で全モード共通
- **モード = その部品の、ライブラリ向けの実体 + 外枠**。段階表示・キー操作・発表者ビュー・PDF は、
  ライブラリが持っていればそれを使う。足りないものはそのモードの中だけで補い、モードをまたぐ共通の層は作らない
- **見た目は土台（theme/）が持ち、どのモードでも同じ**。本文の範囲は `.deck`（各モードが本文を包む要素に付ける）、
  スライド 1 枚は `.slide`。要素の既定の見た目（見出しの大きさ・余白など）も土台に持つ（以前は reveal の white テーマに頼っていた）
- 共通の書き方（モードが受け取るもの）は、モードを増やしながら固める

見送った案: 段階表示・キー操作・URL・PDF・発表者ビューを自前の「進行の層」に移し、ライブラリには
「スライドへ移ること」だけを頼む作り。reveal が持っている完成品の機能（fragment・発表者ビュー・一覧モード・
PDF・操作ボタン・タッチ操作）を作り直すことになり、壊れやすいので採らなかった。

### 今のモード

reveal 以外は試作。デッキのモードは動きの設定（`motion.ts` の `mode`）で決め、ビルドにはそのモードだけが入る（デッキの入口 `vite.config.ts` がそのモードの部品だけを読み込む）。開発サーバーでは `/<デッキ>/<モード>/` でほかのモードでも開ける（開発時だけ）。テストと PDF は reveal の作りを使うので、`--mode reveal` でビルドしたもの（`dist/<デッキ>/reveal/`）を開く。
URL の検索の部分で受けるのは、ライブラリ自身の約束（reveal の `?print-pdf`、Shower の `?full`、Spectacle の `?presenterMode` など）とテスト用の `?check-overflow` だけ（以前の仮の `?mode=`・`&effect=`・`?presenter` はやめた）。

| モード | 場所 | 状態 |
|---|---|---|
| reveal（既定） | `src/modes/reveal/` | 完成。一覧・ページ番号・はみ出しの検査・PDF・発表者ビュー（reveal のノートのプラグイン。S キー） |
| impress | `src/modes/impress/` | 平面に並べてカメラが移る。下の「impress モード」 |
| Shower | `src/modes/shower/` | 一覧と全画面を行き来する。下の「Shower モード」 |
| Spectacle | `src/modes/spectacle/` | React の部品のデッキ。下の「Spectacle モード」 |
| Swiper | `src/modes/swiper/` | カルーセルの部品で送る（演出は motion.ts の既定の遷移）。下の「Swiper モード」 |

モードとまわりの約束（`src/deck/mode.ts`）: モードに頼むのは、今のスライドの知らせ（`announcePresent`。動く図が受ける）、
「このスライドへ移る」の登録（`registerGoTo`。開発時の警告の一覧と、原稿の中のリンク `#名前` から移る。`src/deck/links.ts`）、準備完了の印（`markReady`。`<html data-deck-ready>`）、
スライドの要素に `.slide` と原稿の位置を付けて `.deck` の中に文書の順で置くこと、の 4 つだけ。これで原稿の警告とはみ出しの検査
（`src/devtools/`）は全モードで同じに働く。スライドの大きさは窓と同じ縦横比（`src/deck/view-size.ts`。CSS では `watchViewSize` の `--deck-view-width` / `--deck-view-height`、
窓に合わせる倍率は `--deck-scale`）。最小サイズは `--deck-slide-width` / `--deck-slide-height`（はみ出しの枠）。共通の部品は段の印（`src/modes/marker-steps.tsx`。impress と Shower）と、ページ番号（`src/modes/page-number.tsx`。reveal 以外）。
ページ番号は reveal の `c/t` と同じく文書の順のスライドで数え、スライドの中の右上（題の帯の上）に置く。impress・Shower・Swiper には
ページ番号が無く、Spectacle の template は今のスライドの番号を全スライドに配る作りで、一覧と PDF 用の表示ではどのスライドも同じ番号になるので使わない。
段階表示の見た目（`.overlay-hidden`）は theme/base.css。

### 段の印（impress・Shower）

impress の substep と Shower の `.next` は、要素を文書順に 1 つずつ現すだけで、段の番号の指定も「消える」も無い。
そこで各モードの `Slide` が、段の数 - 1 個の空の要素（印）をスライドの末尾に置き、ライブラリには印だけを進めさせる。今の段 = 進んだ印の数 + 1 とし、
各 `Overlay` の表示をそこから決める。`\only`・`<2-3>` も Beamer どおりに出る。

### impress モード（試作）

- スライドは impress の step。大きさは窓と同じ縦横比（置き方の間隔もその大きさから決め、窓の大きさが変わったら置き直して作り直す）。置き方は motion.ts の `impress`（`src/modes/impress/layout.ts`）:
  `layout` が `grid`（既定。横の並び（h）は右へ、縦の続き（v）は下へ）か `spiral`（文書の順に、外へ広がる螺旋に沿って。
  スライドは螺旋の進む向きに傾け、隣とも隣の周とも対角線より離す）、`positions` でラベルのスライドだけ置き直す（書いた項目だけ）。
  最後に全体を見渡す step（`#overview`）を、全スライドが収まる所に足す
- 段階表示は段の印（substep）
- 作り直し: impress は初期化のときの置き場所と step しか知らないので、窓の大きさが変わったときと原稿を直したとき（HMR）は、
  置き直して作り直し、同じ番目の step に戻る。impress の `tear` は全体の中身を innerHTML で書き直す（React の要素が別物になり、図が動かなくなる）ので、
  React の要素を先に外へ出して空の step だけで tear し、元の要素を戻して impress の付けた class と style を外す
- 一覧: O キーで全体を見渡す step と、その前のスライドを行き来する。見渡しでスライドを押すとそのスライドへ移る（impress の動き）。
  Esc は impress が全画面の解除に使っているので使わない
- まだ無いもの: PDF 出力（reveal モードで作る）、発表者ビュー（impress の impressConsole は CSS を URL で読むので単一 HTML では使えない）

### Shower モード（試作）

- `@shower/core` 3.6.0 の本体（`lib/shower.js`）を直に読む（入口の `lib/index.js` は `document.currentScript` を読んで自動で始めるので、
  まとめて読み込むと壊れる）。容器は body（Shower はキー操作を容器で受ける）
- 一覧（縮小したスライドを並べる）と全画面。Shower の作りのまま一覧で始まり（URL に `full` があれば全画面から）、一覧でスライドを押すと全画面、Esc で一覧に戻る。Enter・Space・矢印は次へ。
  全画面に入るキーは Shift+F5（Mac は Cmd+Enter）。見た目のテーマ（ribbon など）は使わず、配置だけを `shower.css` で決める
- 段階表示は段の印（`.next`）。一覧ではどのスライドも最後の段の状態
- 読み上げ用の領域（Shower が置く `section.region`。今のスライドの複製）は、見た目だけ隠す
- まだ無いもの: PDF 出力、発表者ビュー

### Spectacle モード（試作）

- `spectacle` 10.2.3。React 19 の下で動く（依存の styled-components 5・`react-is@18` も問題なかった）。スライドの大きさは
  `theme.size` で窓と同じ縦横比の大きさ（窓の大きさが変わると渡し直す）
- 段階表示は Spectacle の仕組みそのもの: 段のあるスライドが `useSteps(段の数 - 1)` で段を登録し、返る step（-1〜）+ 2 を
  今の段として部品に配る。段の印は要らない
- Spectacle の機能がそのまま使える: 一覧（`?overviewMode=true`。Ctrl+Shift+O）、発表者ビュー（`?presenterMode=true`。Ctrl+Shift+P。時計と今・次のスライド。
  聴衆用のデッキは別のタブで開き、`BroadcastChannel` でつながる。単一 HTML を `file://` で開いても動く）、
  PDF 用の表示（`?exportMode=true`）。キーは矢印（Space は使わない）
- 注意: テーマの `backdropStyle` は Spectacle の既定（ウィンドウいっぱいに固定）を丸ごと置き換えるので、既定の値も書く
  （無いと拡大と中央寄せが効かない）。Slide の `padding` はテーマの間隔の段階の番号として読まれるので、値（`"0px"`）で渡す
- 縦の続き（`--`）: Spectacle のスライドは一列なので一列に並べ、既定の遷移（slide、または指定なし）では reveal と同じく、続きへは下から、
  新しい節へは右から入る（`structuralSlide`）。出ていくスライドは次のスライドに合わせて上か左へ出る（続きの束 `Stack` が「次は続きか」を配る）

### Swiper モード（試作）

- `swiper` 14.3.0 の本体を、React が描いた DOM（`.swiper > .swiper-wrapper > .swiper-slide`）に後からかける。
  React の部品（`swiper/react`）は直下の子の型でスライドを見分けるので、MDX の部品の中のスライドを見分けられず使えない。
  Swiper はループを使わなければスライドの DOM を動かさない
- 切り替えの演出は motion.ts の既定の遷移（`transition`）で選ぶ: slide（既定）・fade・cube・flip・cards（Swiper の演出のうち、共通の遷移の語彙にあるもの）。
  影（slideShadows・cube の shadow）は硬い見た目の方針に合わないので、どの演出でも切る
- Swiper には段階表示もプレゼン向けのキー操作も無いので、どちらもこのモードが持つ。キー（→ ↓ Space PageDown で次、← ↑ PageUp で前、
  Home / End）は、段が残っていれば段を進め、無ければスライドを移る。前のスライドへ戻ると最後の段、先へ進むと 1 段目から。
  段の数は `Slide` が要素に付ける `data-steps` から読み、表示は段の印のモードと同じ `applyStep`
- スワイプ・ドラッグはスライドを移る（段は飛ばす）。図（`.figure`）・入力・ボタン・リンクの上ではスワイプにしない
- 全体は窓と同じ縦横比の大きさの容器を、窓に合わせる倍率で中央に置く（Swiper は倍率をかける前の大きさで組む）
- 原稿を直したとき（HMR）は、React が描き直したスライドで Swiper を作り直し、同じ番目のスライドから始める
- 一覧: Esc・O で切り替える（Swiper に無いので、このモードが持つ）。Shower の一覧と同じく縮小したスライドを並べ、どのスライドも最後の段の状態で見せる。
  押したスライドへ 1 段目から移る。一覧の間は、Swiper の付けた配置（束のずらし・演出の transform と不透明度）を CSS で打ち消し、スワイプを止める
- まだ無いもの: PDF 出力、発表者ビュー

### デッキの動きの設定（motion.ts）

動きの指定は本文に書かない（本文は意味だけ。命令で動きを書かない）。デッキのフォルダの `motion.ts` に、既定のモード・既定の遷移・
スライドごとの遷移を書く（型は `src/modes/motion.ts`。書き方は README の「動きの設定」）。

- スライドの指し方は CSS と同じ考え方: 本文の文字ではなく、本文が自分の意味のために持っている印で指す。
  - 構造の規則（`section`: 新しい節 `---` へ入るとき、`continuation`: 節の中の続き `--` へ入るとき）。本文に何も足さない
  - スライドの題の `\label`（`## 主定理の紹介 \label{sec:main}`）。動きの命令ではなく、そのスライドの名前で、`\ref`・`#名前` のリンクにも使う
  - 題の文字で指す案は採らなかった（題は内容の都合で直すので、直すたびに設定もずれる。同じ題のスライドを区別できない）。
    題から作る slug も、元が題なので同じ
- 優先は ラベル → 構造の規則 → 既定。照合はビルドのときに原稿の変換（vite/remark-beamer）が行い、各スライドに `<Slide transition>` を付ける。
  モードはその名前を自分の演出に対応させるだけ。無いラベル・スライドのものではないラベル・そのモードで使えない遷移は原稿の警告と同じ扱い
  （本番のビルドは失敗）
- 遷移の語彙は `src/modes/names.ts` の `TRANSITIONS`（none・slide・fade・zoom・cube・cards・flip）、モードごとに使えるものは
  `MODE_TRANSITIONS`。Spectacle はすべて（`src/modes/spectacle/transitions.ts`。from・enter・leave の 3 つの形を transform で書く）、
  reveal は reveal の名前と同じもの（data-transition）、Swiper はデッキの既定だけ（演出を作るときに 1 つだけ決める作り）
- Spectacle では、そのスライドの遷移で入り、出るときもそのスライドの遷移で出る（前のスライドの leave と、次のスライドの from・enter が同時に動く）。
  slide だけは向きを文書の構造に合わせる（上の「Spectacle モード」）
- 見本: `decks/legendre/motion.ts`（Spectacle。新しい節は cube、節の中の続きは cards、主定理 `sec:main` は zoom。impress では螺旋）

### 次にやること

1. 各モードの足りないもの（上）を埋める

### 決めたこと

- 発表者ビューは各ライブラリのものを使う（reveal はノートのプラグイン、impress は impressConsole）
- どのモードも、スライドを窓と同じ縦横比に広げ、窓全体を覆う（`src/deck/view-size.ts`。最小サイズ 933×700 が収まる倍率で縮小し、
  余る分だけ横か縦に広げる）。固定の縦横比だと窓との差が余白になり、題の帯が窓の端に届かないため。原稿が当てにしてよいのは最小サイズだけで、
  はみ出しの検査も最小サイズで測る
- 縦のスライド（`--`）は内容の層では「節の中の続き」。表し方はモードが決める（reveal は縦、impress は下に置く）
- 段階表示は `\pause` などの Beamer の書き方でも `<Fragment>` でも書ける。`<Fragment>` は変換が `\pause` と同じく段を 1 つ進める `Overlay` にする（後ろの本文は隠さない）ので、どのモードでも同じに出る

## モードの候補の実現可能性（2026 年 10 月）

モードが受け取るもの（変換の出力）: `Slide`（並び `h`・`v`）、`Stack`（縦の続き）、`Overlay`（`from`・`to`・`only`。Beamer の段の番号）、
`OverlaySteps`（段の数）、`Notes`、本文の範囲 `.deck` とスライド 1 枚 `.slide`。
「段の印」は impress モードと同じ手: ライブラリの段（文書順に 1 つずつ現れるもの）を段の数だけ空で置き、今の段 = 進んだ印の数 + 1 として
`Overlay` の表示を決める。これでライブラリに番号の指定や「消える」が無くても Beamer どおりに出る。

版と日付は npm の最終公開と GitHub の最終更新（2026-10-14 に確認）。ソースはパッケージを取ってきて読んだ。

| モード | 最新・更新 | 段階表示の対応 | DOM の扱い | 持っているもの | 見込み |
|---|---|---|---|---|---|
| **Spectacle** | 10.2.3（npm 2025-10）。GitHub は 2026-10 も更新。MIT | ◎ ネイティブ。`SlideContext` が今の段（`activeStepIndex`）を配り、`useSteps(n)` で段の数を登録する。`Overlay` はこれを読むだけ、`OverlaySteps` は `useSteps` を呼ぶだけで済む | React の部品そのもの（`<Deck>`・`<Slide>`）。原稿の部品をそのまま中に置ける | 発表者ビュー（別窓を `broadcast-channel` で同期）、一覧、PDF 用の表示（`?exportMode=true`）、遷移（react-spring） | **高い**。ただし依存が styled-components 5・react-spring 9・`react-is@18` で、React 19 の下で動くかを最初に試す必要がある。縦のスライドは無いので `Stack` は平らにする。スライドの大きさは `theme.size` |
| **Shower** | `@shower/core` 3.6.0（npm 2026-07）。開発中。MIT | ○ `.next` が文書順に 1 つずつ（`active`・`visited` の class）。段の印で対応 | 書いてある DOM をそのまま使い、動かさない（React と相性がよい）。`.shower` の中の `.slide` | 一覧モード（`list`。全スライドを格子に並べる）と全画面モード、キー・タッチ・hash（`#1`）、タイマー | **高い**。注意: パッケージの入口 `lib/index.js` は `document.currentScript` を読むので、まとめて読み込むと壊れる。`lib/shower.js` を直に読み、自分で `start()` する。遷移の演出はほぼ無い（一覧 ⇄ 全画面の切り替えが持ち味）。PDF は CSS で 1 枚 1 ページにする |
| **Bespoke** | `bespoke` 1.1.0（npm 2015-09）。GitHub 2020-09 が最後。MIT | ○ `bespoke-bullets`（2014）の `[data-bespoke-bullet]` が文書順。段の印で対応 | 親の要素の子をスライドとして使い、動かさない | 本体は最小（プラグインで足す。キー・タッチ・hash・拡大縮小・遷移のテーマは別パッケージで、どれも 2014〜2016 年で止まっている） | 中。作れるが、遷移もテーマ頼みで、得られるものが少ない。CommonJS |
| **deck.js** | npm に無い。GitHub 2019-01 が最後。MIT | ○ スライドの中の入れ子の `.slide` が段。段の印で対応 | `.deck-container` の中の `.slide` をそのまま使う | 拡張（一覧・目次・hash・ページ番号） | 低い。jQuery と Modernizr が要り、npm に無いので取り込み方から作る |
| **remark**（gnab/remark） | `remark-slide` 0.14.0（npm 2017-06）。GitHub 2024-06。MIT | △ `--` で「前のスライドに足した複製」を作る形 | Markdown の文字列を自分の解析器（marked 0.3.1）で読み、DOM を自分で作る | 発表者ビュー、複製の窓 | 低い。入力が Markdown の文字列なので、ビルドした HTML を流し込むことになり、React の図（ドラッグ・アニメーション）が動かない。`--` の意味も原稿と衝突する |
| **GitPitch** | サービスは 2021-03-01 に終了。npm に無い | — | — | GitPitch 4.0 はデスクトップのアプリ（ライブラリではない） | ×。部品として組み込めるものが無い |

勧める順（モード）: 1. **Spectacle**（React 19 で動くかの試作から。React に深く入った構成にいちばん近い）、2. **Shower**（一覧モードという
違う見せ方を持ち、開発が続いている）、3. Bespoke・deck.js（作れるが得るものが少ない）。remark と GitPitch は見送る。

## 動きの素材を持つライブラリ（2026 年 10 月）

スライドの切り替えの演出や、要素・図の動きを部品や素材として持つもの。版と日付は npm の最終公開（2026-10-14 に確認）。

### スライドの切り替えの演出（モードの候補）

| 候補 | 版・更新 | 持っている動き | 相性 |
|---|---|---|---|
| Swiper | 14.3.0（2026-09）MIT | fade・cube・coverflow・flip・cards、前後のスライドの移動・回転・拡大を数値で決める creative | ○ 演出の種類がいちばん多い。本来はカルーセルなので、段階表示とキー操作はモードの側で作る |
| Slidev | 53.0.0（2026-09）MIT | スライドの切り替え、`v-motion`（要素の動き。`@vueuse/motion`）、Magic Move（コードの変形） | × Vue と Markdown の製品。部品として借りるなら shiki-magic-move だけ |
| reveal.js-appearance | 1.4.4（2026-10）MIT | PowerPoint のように要素が順に現れる演出（Animate.css を使う） | ○ reveal モードにそのまま足せる |

### 要素や図を動かす部品（どのモードでも使える）

| 候補 | 版・更新 | 中身 | 相性 |
|---|---|---|---|
| Motion（旧 Framer Motion） | 14.2.0（2026-10）MIT | React の要素の登場・退場、配置が変わるときに滑らかに移る動き（layout） | ◎ React 19 の部品にそのまま使える。段階表示に合わせた登場の演出に |
| GSAP | 3.15.0（2026-04）独自の無料ライセンス | タイムライン、図形の変形（MorphSVG）、文字を分けて動かす（SplitText）ほか | ○ 3.13 から全プラグインが無料（商用も可）。MIT ではない |
| anime.js | 4.5.0（2026-08）MIT | タイムライン、SVG の線を描く動き、図形の変形 | ○ 軽い |
| AutoAnimate（`@formkit/auto-animate`） | 0.10.0（2026-07）MIT | 要素の追加・削除・並べ替えを自動で滑らかにする | ○ 箇条書きが段で増えるところに |
| shiki-magic-move | 1.4.0（2026-06）MIT | コードの変更を滑らかに変形して見せる（Keynote の Magic Move） | ○ README の「コードの行の強調を段階にする」と組める |

### 数学の図のアニメーション

| 候補 | 版・更新 | 中身 | 相性 |
|---|---|---|---|
| Manim-Web（`manim-web`） | 0.37.0（2026-10）MIT | 3Blue1Brown の Manim の TypeScript への移植。ブラウザだけで動き、数式は MathJax か KaTeX | ◎ 数学のデッキの図に。作者 1 人の新しい移植 |
| Motion Canvas（`@motion-canvas/core`） | 3.17.2（2025-02）MIT | TypeScript で書くアニメーション。それ自体に発表モードがある | △ 自前のエディタで作る仕組みで、スライドの一部に組み込むものではない |

### デザイナーが作った動きの素材を再生するもの

| 候補 | 版・更新 | 中身 | 相性 |
|---|---|---|---|
| dotLottie（`@lottiefiles/dotlottie-web`） | 0.81.0（2026-10）MIT | Lottie 形式の素材（アイコン・イラストの動き）を再生する。素材は LottieFiles で多く公開されている | ○ 素材を単一 HTML に埋め込める |
| Rive（`@rive-app/canvas`） | 2.44.2（2026-10）MIT | 操作に反応する動き（状態の切り替え）を持つ素材を再生する | ○ 素材は Rive の専用エディタで作る |

見送るもの: Remotion（動画を書き出す道具。独自のライセンス）、Theatre.js（2024 年で止まっている）、
Animate.css（2020）・mo.js（2023）・Vivus（2021）（止まっている。Animate.css の演出は reveal.js-appearance の中で使える）。

勧めるもの: Swiper（モード）、Motion（図や要素の動き。React に深く入れる方向にいちばん合う）、Manim-Web（数学の図）。
cube・flip のような派手な演出は硬い見た目の方針と合わないかもしれないので、採るならデッキごとに選べる形にする。

## 調査（2026 年 10 月）

版と日付は npm のレジストリ（`npm view <パッケージ> time`）で確かめた。「開発中」は 2025 年以降に新しい版が出ているもの。

### スライド全体を動かすもの（移動・配置・遷移）

| ライブラリ | 最新（npm） | 状況 | 合うか |
|---|---|---|---|
| reveal.js | 6.0.2（2026-09） | 開発中 | ◎ 今の基準。遷移が美しく、発表者ビュー・一覧モードもある |
| Shower（`@shower/core`） | 3.6.0（2026-07） | 開発中 | ○ 「エンジンとテーマを分ける」作りで考え方が近い。PDF に印刷できる。遷移の演出はほとんど無い |
| Flowtime.js | 2.0.0（2025-02） | 更新は少ない | △ 格子状の移動と遷移。作者は 1 人 |
| impress.js | 1.1.0（2020-04。GitHub には 2.0 の表記） | 更新は少ない | ○ HTML のスライドを 3D の空間に置き、カメラが移る。座標の指定が要る |
| WebSlides（2019）・big（2019）・Bespoke（2015）・jmpress（2014）・inspire.js（2015）・remark（2017）・deck.js（jQuery） | — | 止まっている | × |
| Marpit | 3.2.3（2026-09） | 開発中 | × Markdown から HTML を作る道具（内容と見た目の層に当たる。このリポジトリでは自前で持っている） |

### ズームで移る見せ方（Prezi・Sozi 風）

| ライブラリ | 最新 | 合うか |
|---|---|---|
| impress.js | 上のとおり | ○ この型でいちばん実績がある |
| Zumly | 0.97.0（2026-09） | △ 新しく開発中だが 1.0 前。スライドよりアプリの画面の移動を狙った作り |
| Sozi | npm に無い | × SVG の絵の上に視点を置く専用のエディタ（Inkscape の拡張から始まった）。HTML のスライドを動かす部品ではない |
| dizzy.js | npm に無い | × 止まっている |
| `@panzoom/panzoom`（4.6.2、2026-04）・d3-zoom（3.0.0、2021-06） | — | ○ ズームと移動の部品。Sozi 風の動きを自前で作るときに使える |

### 切り替えの演出だけを担うもの（自前の進行の層と組み合わせる）

| 候補 | 状況 | 合うか |
|---|---|---|
| **View Transitions API**（ブラウザの標準） | 同じページの中の切り替えは Chrome 111 以降・Safari 18・Firefox 144 以降（Chrome の 2025 年の記事による） | ◎ 依存が無く、遷移の演出を CSS で書ける（見た目と動きを分ける考えにいちばん素直に合う） |
| Swiper | 14.3.0（2026-09）、開発中 | ○ cube・coverflow・flip・cards などの演出。本来はカルーセル（スワイプで送る）の部品 |
| Motion（14.2.0、2026-10）・anime.js（4.5.0、2026-06） | 開発中、MIT | ○ 自前で遷移を作るときのアニメーションの部品 |
| GSAP | 3.15.0、開発中 | △ 無料だが MIT ではない独自のライセンス |
| fullPage.js | 4.0.41 | × GPL-3.0（商用には別のライセンスが要る） |
| Swup・Barba | 開発中 / 2024 | × 複数ページのサイトの画面遷移向け |

### 勧める組み合わせ

方針: **動きは基本的に借り物（出来上がったライブラリ）を使う**。自前で持つのは、どのライブラリでも要る進行の層と出力の層だけにする。

1. **reveal.js**: 1 つ目のアダプター。今の動きをそのまま再現する
2. **impress.js**: ズームの型を試すとき（更新は少ないが実績がある）。座標の決め方（格子・螺旋・手で指定）を動きの設定のファイルに持つ
3. **Shower**: 考え方は近いが遷移の演出が少ないので、優先は低い
4. 自前の動き（View Transitions API。CSS で書けない動きには Motion）は、借り物で足りない見せ方が出てきたときの選択肢として残す。
   遷移の演出をデッキの CSS に置ける・依存が無いという利点はあるが、動きの層を自前で持つことになる。
   Sozi 風に面の上を移る動きも、impress.js で足りなければ `@panzoom/panzoom` で同じく自前で

除外: 止まっているもの、ライセンスに注意が要るもの（fullPage.js の GPL、GSAP）、性格の違うもの
（Sozi はエディタ、Marpit は内容の層、Swup・Barba は複数ページのサイト向け）。

### 出典

- [reveal.js Alternatives（AlternativeTo）](https://www.alternativeto.net/software/reveal-js/)
- [Shower（GitHub）](https://github.com/shower/shower)
- [impress.js（GitHub）](https://github.com/impress/impress.js)
- [Sozi（GitHub）](https://github.com/sozi-projects/Sozi)・[An overview of Sozi（FOSDEM 2014）](https://archive.fosdem.org/2014/schedule/event/sozi/)
- [Zooming UIs in 2026: Prezi, impress.js, and why I built something different](https://clone2-hacker-news-nuxt.nuxt.dev/item/47665194)
- [dizzy.js（Open Hub）](https://openhub.net/p/dizzyjs)
- [What's new in view transitions (2025 update)（Chrome for Developers）](https://developer.chrome.com/blog/view-transitions-in-2025)
- [CSS View Transitions: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/css-view-transitions-complete-guide)
- モードの候補: [GitPitch の README（2021-03-01 のサービス終了）](https://cdn.jsdelivr.net/gh/gitpitch/gitpitch@master/README.md)・
  [Spectacle の API Reference](https://commerce.nearform.com/open-source/spectacle/docs/api-reference)・
  [deck.js（GitHub）](https://github.com/imakewebthings/deck.js)・[Shower（GitHub）](https://github.com/shower/shower)・
  [Bespoke（GitHub）](https://github.com/bespokejs/bespoke)・[remark（GitHub）](https://github.com/gnab/remark)
- 動きの素材: [10 Best HTML Presentation Frameworks In JavaScript (2026 Update)](https://www.jqueryscript.net/blog/best-html-presentation-framework.html)・
  [reveal.js-appearance](https://github.com/Martinomagnifico/reveal.js-appearance)・[Slidev Animations](https://sli.dev/guide/animations)・
  [Slidev: Shiki Magic Move](https://sli.dev/features/shiki-magic-move)・[GSAP 3.13（全プラグインの無料化）](https://gsap.com/blog/3-13/)・
  [Swiper の効果の一覧（llms.txt）](https://swiperjs.com/llms.txt)・[Swiper Creative Effect](https://studio.swiperjs.com/templates/creative-effect)・
  [Motion Canvas: Presentation](https://motioncanvas.io/docs/presentation)・
  [Manim-Web（SitePoint）](https://www.sitepoint.com/manim-web-3blue1brown-mathematical-animations-react/)・
  [Show HN: Manim を TypeScript に移植](https://hn.svelte.dev/item/47155375)・
  [LottieFiles: How the web player works](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/core-concepts)・
  [Lottie vs Rive vs CSS animations (2026)](https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026)・
  [Animate.css Alternatives](https://www.alternativeto.net/software/animate-css/)
