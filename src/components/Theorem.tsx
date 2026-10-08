import type { ReactNode } from 'react'
import { items } from 'virtual:refs'

/**
 * 定理環境。Theorem / Lemma / Proposition / Corollary / Definition は
 * 1 本の通し番号(数学書の慣習「定義 1, 定理 2, 補題 3 …」)。
 * 番号はビルド時にデッキ全体の出現順で決まる(vite/deck/plugin.ts の virtual:refs)ので、
 * \ref{…} で参照でき、スライドを並べ替えても追従する。
 *
 * 原稿では LaTeX 環境でも JSX でも書ける:
 *   \begin{theorem}[Jensen]\label{thm:j} … \end{theorem}
 *   <Theorem title="Jensen" id="thm:j"> … </Theorem>
 */
type EnvProps = {
  /** 括弧書きの名前(人名・通称など) */
  title?: ReactNode
  /** 見出し語の上書き(日本語にしたいときなど) */
  heading?: string
  /** \label と同じ参照用の key(JSX で書くとき) */
  id?: string
  /** 番号の検索キー。原稿の変換時に自動で付く */
  refId?: string
  children: ReactNode
}

function env(defaultHeading: string, variant: 'thm' | 'def') {
  return function Env({ title, heading = defaultHeading, refId, children }: EnvProps) {
    const n = refId ? items[refId] : undefined
    return (
      <div className={`thm thm-${variant}`}>
        <div className="thm-head">
          {heading} {n ?? '?'}
          {title && <> ({title})</>}
        </div>
        <div className="thm-body">{children}</div>
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
export function Proof({ heading = 'Proof', children }: { heading?: string; children: ReactNode }) {
  return (
    <div className="thm-proof">
      <span className="thm-head">{heading}.</span> {children}
      <span className="qed">∎</span>
    </div>
  )
}
