import { Children, isValidElement, type ReactNode } from 'react'

/**
 * 定理環境。Theorem / Lemma / Proposition / Corollary / Definition は
 * 1 本の通し番号(数学書の慣習「定義 1, 定理 2, 補題 3 …」)。
 * 番号は原稿の変換時にデッキ全体の出現順で振られて n に入る(vite/remark-beamer/transform.ts)。
 *
 * 原稿では LaTeX 環境でも JSX でも書ける:
 *   \begin{theorem}[Jensen]\label{thm:j} … \end{theorem}
 *   <Theorem title="Jensen" id="thm:j"> … </Theorem>
 */

/** \begin{theorem}[名前] の名前(数式などを含められる)。Theorem が見出しに取り込む */
export function ThmTitle({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

type EnvProps = {
  /** 括弧書きの名前(JSX で書くとき。LaTeX 環境の [名前] は <ThmTitle> として渡る) */
  title?: ReactNode
  /** 見出し語の上書き(日本語にしたいときなど) */
  heading?: string
  /** 通し番号(変換時に付く) */
  n?: string
  /** \label と同じ参照用の key(JSX で書くとき) */
  id?: string
  children?: ReactNode
}

function env(defaultHeading: string, variant: 'thm' | 'def') {
  return function Env({ title, heading = defaultHeading, n, children }: EnvProps) {
    const items = Children.toArray(children)
    const titleEl = items.find((c) => isValidElement(c) && c.type === ThmTitle)
    const body = items.filter((c) => c !== titleEl)
    const name = titleEl ?? title
    return (
      <div className={`thm thm-${variant}`}>
        <div className="thm-head">
          {heading} {n ?? '?'}
          {name && <> ({name})</>}
        </div>
        <div className="thm-body">{body}</div>
      </div>
    )
  }
}

export const Theorem = env('Theorem', 'thm')
export const Lemma = env('Lemma', 'thm')
export const Proposition = env('Proposition', 'thm')
export const Corollary = env('Corollary', 'thm')
export const Definition = env('Definition', 'def')

/** 証明。番号なし、末尾に ∎ */
export function Proof({ heading = 'Proof', children }: { heading?: string; children?: ReactNode }) {
  return (
    <div className="thm-proof">
      <span className="thm-head">{heading}.</span> {children}
      <span className="qed">∎</span>
    </div>
  )
}
