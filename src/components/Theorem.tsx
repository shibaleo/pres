import type { ReactNode } from 'react'

/**
 * 定理環境。Theorem / Lemma / Proposition / Corollary / Definition は
 * 1 本のカウンタで通し番号(数学書の慣習「定義 1, 定理 2, 補題 3 …」)。
 * 番号は CSS カウンタ(theme.css の .thm-num)が付けるので、スライドを並べ替えても追従する。
 *
 *   <Theorem title="Whitney">本文</Theorem>  →  見出し「Theorem 1 (Whitney)」+ 本文
 *   <Theorem label="定理">…</Theorem>         →  見出し「定理 1」+ 本文
 */
type EnvProps = {
  /** 括弧書きの名前(人名・通称など) */
  title?: ReactNode
  /** 見出し語の上書き(日本語にしたいときなど) */
  label?: string
  children: ReactNode
}

function env(defaultLabel: string, variant: 'thm' | 'def') {
  return function Env({ title, label = defaultLabel, children }: EnvProps) {
    return (
      <div className={`thm thm-${variant}`}>
        <div className="thm-head">
          {label} <span className="thm-num" />
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
export function Proof({ label = 'Proof', children }: { label?: string; children: ReactNode }) {
  return (
    <div className="thm-proof">
      <span className="thm-head">{label}.</span> {children}
      <span className="qed">∎</span>
    </div>
  )
}
