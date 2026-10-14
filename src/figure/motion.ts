import { useEffect, useState, type RefObject } from 'react'
import { PRESENT_EVENT, presentSlide } from '../deck/mode'

/** OS で動きを控える設定(prefers-reduced-motion)になっているか。動く図はこのとき一時停止の状態で始める */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 図が、いま表示しているスライドの中にあるか。動く図は、表示中のスライドのときだけ動きの処理を回す
 * (ライブラリは隠したスライドも DOM に残すので、そのままだと見えない図を毎フレーム描き直してしまう)。
 * 今のスライドは、どのモードも deck/mode.ts の announcePresent で知らせる。
 * デッキの外(テストのサーバー側の描画など)では false。
 */
export function useOnPresentSlide(ref: RefObject<Element | null>): boolean {
  const [present, setPresent] = useState(false)
  useEffect(() => {
    const update = (slide: Element | null) => setPresent(!!slide && !!ref.current && slide.contains(ref.current))
    // 後から描かれた図(開発時の描き直しなど)は、最後に知らされたスライドから始める
    update(presentSlide())
    const onPresent = (e: Event) => update((e as CustomEvent<Element>).detail)
    document.addEventListener(PRESENT_EVENT, onPresent)
    return () => document.removeEventListener(PRESENT_EVENT, onPresent)
  }, [ref])
  return present
}
