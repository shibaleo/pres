/**
 * Beamer / LaTeX 風記法の micromark 構文拡張(remark-math や remark-directive と同じ仕組み)。
 *
 * MDX では `{…}` が JS 式、`<…` が JSX になるため、`\cite{key}` や `<2->` は
 * 構文解析の段階で先に認識しておく必要がある。ここでは「どこからどこまでがその記法か」
 * だけを決め、意味づけ(番号付け・変換)は transform.ts が構文木の上で行う。
 *
 * 構文:
 *   flow  `\begin{equation|align|gather|multline}` … `\end{…}`  → 別行立て数式(MathJax に渡す)
 *   flow  `\begin{name}<spec>[opt]\label{…}` / `\end{name}` / `\pause`(行単独)
 *   text  `\name<spec>[opt]{body}`(\cite \ref \eqref \label \only \uncover … 未知の命令もエラー報告のため拾う)
 *   text  `<2->` などの overlay 指定(箇条書きの先頭)
 */
import { asciiAlpha, markdownLineEnding, markdownSpace } from 'micromark-util-character'
import type { Code, Construct, Effects, Extension, State, TokenizeContext } from 'micromark-util-types'

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    latexMathEnv: 'latexMathEnv'
    latexMathEnvValue: 'latexMathEnvValue'
    latexLine: 'latexLine'
    latexCommand: 'latexCommand'
    latexOverlaySpec: 'latexOverlaySpec'
    latexOverlayLine: 'latexOverlayLine'
  }
}

/** 別行立て数式として MathJax に渡す環境 */
export const MATH_ENVS = ['equation', 'align', 'gather', 'multline', 'flalign', 'alignat']

const BACKSLASH = 92
const LBRACE = 123
const RBRACE = 125
const LBRACKET = 91
const RBRACKET = 93
const LT = 60
const GT = 62

/** 1 行(行末まで)を読み、文字列として判定してから ok / nok を決める flow 構文を作る */
function lineConstruct(name: 'latexLine', accept: (line: string) => boolean): Construct {
  return {
    name,
    concrete: true,
    tokenize(effects: Effects, ok: State, nok: State) {
      let line = ''
      return start
      function start(code: Code): State | undefined {
        if (code !== BACKSLASH) return nok(code)
        effects.enter(name)
        return inside(code)
      }
      function inside(code: Code): State | undefined {
        if (code === null || markdownLineEnding(code)) {
          if (!accept(line.trimEnd())) return nok(code)
          effects.exit(name)
          return ok(code)
        }
        line += String.fromCharCode(code)
        effects.consume(code)
        return inside
      }
    },
  }
}

const ENV_LINE_RE = /^\\begin\{([A-Za-z]+\*?)\}(?:<[^>]*>)?(?:\[[^\]]*\])?\s*(?:\\label\{[^}]*\})?$|^\\end\{([A-Za-z]+\*?)\}$|^\\pause$/
/** `\begin{theorem}[…]` / `\end{theorem}` / `\pause`(数式環境は別の構文が先に拾う) */
const latexLine = lineConstruct('latexLine', (line) => {
  const m = line.match(ENV_LINE_RE)
  if (!m) return false
  const env = (m[1] ?? m[2] ?? '').replace(/\*$/, '')
  return !MATH_ENVS.includes(env)
})

/**
 * 別行立て数式 `\begin{align}` … `\end{align}`。remark-math の数式ブロックと同じ作り
 * (行の継続は nonLazyContinuation で判定し、遅延継続行は含めない)。
 */
const latexMathEnv: Construct = {
  name: 'latexMathEnv',
  concrete: true,
  tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State) {
    const self = this
    let line = ''
    let env = ''
    return start

    function start(code: Code): State | undefined {
      if (code !== BACKSLASH) return nok(code)
      effects.enter('latexMathEnv')
      effects.enter('latexMathEnvValue')
      return firstLine(code)
    }
    function firstLine(code: Code): State | undefined {
      if (code === null || markdownLineEnding(code)) {
        const m = line.match(/^\\begin\{([A-Za-z]+)(\*?)\}/)
        if (!m || !MATH_ENVS.includes(m[1])) return nok(code)
        env = m[1] + m[2]
        effects.exit('latexMathEnvValue')
        // 同じ行で閉じている場合
        if (line.includes(`\\end{${env}}`)) return done(code)
        return lineEnd(code)
      }
      line += String.fromCharCode(code)
      effects.consume(code)
      return firstLine
    }
    function lineEnd(code: Code): State | undefined {
      // 閉じないまま終わった場合も 1 つの数式として返す(閉じ忘れは transform.ts が報告する)
      if (code === null) return done(code)
      return effects.attempt(nonLazyContinuation, contentStart, done)(code)
    }
    function contentStart(code: Code): State | undefined {
      line = ''
      if (code === null || markdownLineEnding(code)) return lineEnd(code)
      effects.enter('latexMathEnvValue')
      return content(code)
    }
    function content(code: Code): State | undefined {
      if (code === null || markdownLineEnding(code)) {
        effects.exit('latexMathEnvValue')
        if (line.includes(`\\end{${env}}`)) return done(code)
        return lineEnd(code)
      }
      line += String.fromCharCode(code)
      effects.consume(code)
      return content
    }
    function done(code: Code): State | undefined {
      effects.exit('latexMathEnv')
      return ok(code)
    }
    void self
  },
}

/** 次の行が遅延継続行(引用の > 抜けなど)でなければ ok。remark-math と同じ */
const nonLazyContinuation: Construct = {
  partial: true,
  tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State) {
    const self = this
    return start
    function start(code: Code): State | undefined {
      if (code === null) return nok(code)
      effects.enter('lineEnding')
      effects.consume(code)
      effects.exit('lineEnding')
      return lineStart
    }
    function lineStart(code: Code): State | undefined {
      return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
    }
  },
}

/**
 * 文中の命令 `\name<spec>[opt]{body}`。< > と [ ] と { } のどれかが続くときだけ命令と見なす
 * (`C:\Users` のような文字列は対象外)。body の中括弧は入れ子を数える。
 */
const latexCommand: Construct = {
  name: 'latexCommand',
  tokenize(effects: Effects, ok: State, nok: State) {
    let depth = 0
    let escaped = false
    return start

    function start(code: Code): State | undefined {
      if (code !== BACKSLASH) return nok(code)
      effects.enter('latexCommand')
      effects.consume(code)
      return nameStart
    }
    function nameStart(code: Code): State | undefined {
      if (!asciiAlpha(code)) return nok(code)
      effects.consume(code)
      return name
    }
    function name(code: Code): State | undefined {
      if (asciiAlpha(code)) {
        effects.consume(code)
        return name
      }
      if (code === LT) return spec(code)
      if (code === LBRACKET) return opt(code)
      if (code === LBRACE) return body(code)
      return nok(code)
    }
    function spec(code: Code): State | undefined {
      effects.consume(code) // <
      return specInside
    }
    function specInside(code: Code): State | undefined {
      if (code === GT) {
        effects.consume(code)
        return afterSpec
      }
      if (code === null || markdownLineEnding(code)) return nok(code)
      effects.consume(code)
      return specInside
    }
    function afterSpec(code: Code): State | undefined {
      if (code === LBRACKET) return opt(code)
      if (code === LBRACE) return body(code)
      return nok(code)
    }
    function opt(code: Code): State | undefined {
      effects.consume(code) // [
      return optInside
    }
    function optInside(code: Code): State | undefined {
      if (code === RBRACKET) {
        effects.consume(code)
        return afterOpt
      }
      if (code === null || markdownLineEnding(code)) return nok(code)
      effects.consume(code)
      return optInside
    }
    function afterOpt(code: Code): State | undefined {
      if (code === LBRACE) return body(code)
      return nok(code)
    }
    function body(code: Code): State | undefined {
      if (code === null) return nok(code)
      if (!escaped && code === LBRACE) depth++
      else if (!escaped && code === RBRACE) depth--
      escaped = !escaped && code === BACKSLASH
      effects.consume(code)
      if (depth === 0) {
        effects.exit('latexCommand')
        return ok
      }
      return body
    }
  },
}

/** 箇条書きの先頭の overlay 指定 `<2->` `<+->` など(後ろに空白が必要) */
const latexOverlaySpec: Construct = {
  name: 'latexOverlaySpec',
  tokenize(effects: Effects, ok: State, nok: State) {
    let size = 0
    return start
    function start(code: Code): State | undefined {
      if (code !== LT) return nok(code)
      effects.enter('latexOverlaySpec')
      effects.consume(code)
      return inside
    }
    function inside(code: Code): State | undefined {
      if (code !== null && ((code >= 48 && code <= 57) || code === 43 || code === 45)) {
        size++
        effects.consume(code)
        return inside
      }
      if (code === GT && size > 0) {
        effects.consume(code)
        return after
      }
      return nok(code)
    }
    function after(code: Code): State | undefined {
      if (!markdownSpace(code)) return nok(code)
      effects.exit('latexOverlaySpec')
      return ok(code)
    }
  },
}

/**
 * 行頭の overlay 指定 `<2-> 項目`(箇条書きの項目の 1 行目)。
 * MDX の JSX 構文は行頭の `<` を必ず JSX として読み、`<2` のような名前でない文字で
 * 構文エラーを出してしまうので、ブロックの段階で先に行全体を拾う(残りは transform.ts が解析する)。
 */
const latexOverlayLine: Construct = {
  name: 'latexOverlayLine',
  concrete: true,
  tokenize(effects: Effects, ok: State, nok: State) {
    let size = 0
    return start
    function start(code: Code): State | undefined {
      if (code !== LT) return nok(code)
      effects.enter('latexOverlayLine')
      effects.consume(code)
      return spec
    }
    function spec(code: Code): State | undefined {
      if (code !== null && ((code >= 48 && code <= 57) || code === 43 || code === 45)) {
        size++
        effects.consume(code)
        return spec
      }
      if (code === GT && size > 0) {
        effects.consume(code)
        return space
      }
      return nok(code)
    }
    function space(code: Code): State | undefined {
      if (!markdownSpace(code)) return nok(code)
      return rest(code)
    }
    function rest(code: Code): State | undefined {
      if (code === null || markdownLineEnding(code)) {
        effects.exit('latexOverlayLine')
        return ok(code)
      }
      effects.consume(code)
      return rest
    }
  },
}

/** MDX の JSX・式の構文より先に試すよう add: 'before' で登録する */
export function beamerSyntax(): Extension {
  return {
    flow: {
      [BACKSLASH]: [{ ...latexMathEnv, add: 'before' }, { ...latexLine, add: 'before' }],
      [LT]: { ...latexOverlayLine, add: 'before' },
    },
    text: {
      [BACKSLASH]: { ...latexCommand, add: 'before' },
      [LT]: { ...latexOverlaySpec, add: 'before' },
    },
  }
}
