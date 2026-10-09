import { useEffect, useState, type RefObject } from 'react'
import { useReveal } from '@revealjs/react'

/** OS で動きを控える設定(prefers-reduced-motion)になっているか。動く図はこのとき一時停止の状態で始める */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 図が、いま表示しているスライドの中にあるか。動く図は、表示中のスライドのときだけ動きの処理を回す
 * (reveal は隠したスライドも DOM に残すので、そのままだと見えない図を毎フレーム描き直してしまう)。
 * デッキの外(テストのサーバー側の描画など)では false。
 */
export function useOnPresentSlide(ref: RefObject<Element | null>): boolean {
  const deck = useReveal()
  const [present, setPresent] = useState(false)
  useEffect(() => {
    if (!deck) return
    const update = () => {
      const slide = deck.getCurrentSlide() as Element | undefined
      setPresent(!!(slide && ref.current && slide.contains(ref.current)))
    }
    update()
    deck.on('ready', update)
    deck.on('slidechanged', update)
    return () => {
      deck.off('ready', update)
      deck.off('slidechanged', update)
    }
  }, [deck, ref])
  return present
}
