import { useEffect, useState, type RefObject } from 'react'

/**
 * 図が載っているスライドの今の段(Beamer と同じ 1 始まり。段階表示の無いスライドは 1)。
 * 段の数は原稿の overlay 指定(\pause・<2->・<Fragment> など)で決まり、図はそれを読んで状態を変える
 * (Spectacle の useSteps に当たる。原稿の書き方は変えない)。
 *
 *   const block = useRef<HTMLDivElement>(null)
 *   const step = useSlideStep(block)   // 2 段目から矢印を出す、など
 *
 * 今の段はどのモードもスライドの要素の data-step に書く(deck/mode.ts の markStep)。印刷用の表示や一覧など、
 * 段が決まらない所では最後の段(Infinity)のこともある。デッキの外(テストのサーバー側の描画など)では 1
 */
export function useSlideStep(ref: RefObject<Element | null>): number {
  const [step, setStep] = useState(1)
  useEffect(() => {
    const slide = ref.current?.closest('.slide')
    if (!slide) return
    const read = () => {
      const value = Number(slide.getAttribute('data-step') ?? 1)
      setStep(Number.isNaN(value) ? 1 : value)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(slide, { attributes: true, attributeFilter: ['data-step'] })
    return () => observer.disconnect()
  }, [ref])
  return step
}
