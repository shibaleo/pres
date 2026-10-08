/**
 * syntax.ts が切り出したトークンを mdast ノードにする(mdast-util-from-markdown の拡張)。
 *  - latexMathEnv → remark-math と同じ `math` ノード(MathJax がそのまま描く)
 *  - それ以外 → 生の文字列を持つ独自ノード。意味づけは transform.ts が行う
 */
import type { Extension, CompileContext, Token } from 'mdast-util-from-markdown'
import type { Literal } from 'mdast'
import type { Math } from 'mdast-util-math'

export interface LatexLine extends Literal {
  type: 'latexLine'
}
export interface LatexCommand extends Literal {
  type: 'latexCommand'
}

declare module 'mdast' {
  interface RootContentMap {
    latexLine: LatexLine
    latexCommand: LatexCommand
  }
  interface BlockContentMap {
    latexLine: LatexLine
  }
  interface PhrasingContentMap {
    latexCommand: LatexCommand
  }
}

function literal(type: 'latexLine' | 'latexCommand') {
  return function (this: CompileContext, token: Token) {
    this.enter({ type, value: this.sliceSerialize(token) } as LatexLine, token)
  }
}
function close(this: CompileContext, token: Token) {
  this.exit(token)
}

export function beamerFromMarkdown(): Extension {
  return {
    enter: {
      latexMathEnv(this: CompileContext, token: Token) {
        // remark-math の数式ブロックと同じ形(<pre><code class="language-math math-display">)
        const node: Math = {
          type: 'math',
          meta: null,
          value: '',
          data: {
            hName: 'pre',
            hChildren: [
              { type: 'element', tagName: 'code', properties: { className: ['language-math', 'math-display'] }, children: [] },
            ],
          },
        }
        this.enter(node, token)
      },
      latexLine: literal('latexLine'),
      latexCommand: literal('latexCommand'),
    },
    exit: {
      latexMathEnv(this: CompileContext, token: Token) {
        const node = this.stack[this.stack.length - 1] as Math
        const value = this.sliceSerialize(token)
        node.value = value
        const code = node.data!.hChildren![0]
        if (code.type === 'element') code.children.push({ type: 'text', value })
        this.exit(token)
      },
      latexLine: close,
      latexCommand: close,
    },
  }
}
