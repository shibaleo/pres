import { fadeTransition, slideTransition, type SlideTransition } from 'spectacle'
import type { TransitionName } from '../names'

/**
 * 遷移の名前(modes/names.ts の TRANSITIONS)を Spectacle の遷移にする。Spectacle は、後ろのスライドを from、
 * 今のスライドを enter、前のスライドを leave の形にして、その間を動かす(戻るときは向きが逆になる)。
 * 形は同じ並びの transform の関数で書く(数だけが変わるようにすると、間が補われる)。
 * 不透明度は 3 つの形のすべてに書く(Spectacle は見えていないスライドを不透明度 0 で置いておくことがあり、
 * 書かないと 0 のまま戻らない)。影は付けない
 */
const PERSPECTIVE = 'perspective(2000px)'

export const SPECTACLE_TRANSITIONS: Record<TransitionName, SlideTransition> = {
  // 動かさずに切り替える
  none: { from: { transform: 'none', opacity: 1 }, enter: { transform: 'none', opacity: 1 }, leave: { transform: 'none', opacity: 1 } },
  slide: slideTransition,
  fade: fadeTransition,
  // 奥から近づいて現れ、手前に抜けて消える
  zoom: {
    from: { transform: 'scale(0.5)', opacity: 0 },
    enter: { transform: 'scale(1)', opacity: 1 },
    leave: { transform: 'scale(1.5)', opacity: 0 },
  },
  // 立方体の隣の面へ回る(右の面が正面に来る)
  cube: {
    from: { transform: `${PERSPECTIVE} translateX(50%) rotateY(90deg) translateX(50%)`, opacity: 1 },
    enter: { transform: `${PERSPECTIVE} translateX(0%) rotateY(0deg) translateX(0%)`, opacity: 1 },
    leave: { transform: `${PERSPECTIVE} translateX(-50%) rotateY(-90deg) translateX(-50%)`, opacity: 1 },
  },
  // 下からカードが重なってきて、前のカードは奥に下がって消える
  cards: {
    from: { transform: 'translateY(110%) scale(1) rotate(4deg)', opacity: 1 },
    enter: { transform: 'translateY(0%) scale(1) rotate(0deg)', opacity: 1 },
    leave: { transform: 'translateY(0%) scale(0.85) rotate(0deg)', opacity: 0 },
  },
  // 裏返る(裏面は見せない)
  flip: {
    from: { transform: `${PERSPECTIVE} rotateY(180deg)`, opacity: 1, backfaceVisibility: 'hidden' },
    enter: { transform: `${PERSPECTIVE} rotateY(0deg)`, opacity: 1, backfaceVisibility: 'hidden' },
    leave: { transform: `${PERSPECTIVE} rotateY(-180deg)`, opacity: 1, backfaceVisibility: 'hidden' },
  },
}

/**
 * slide を、文書の構造に合わせた向きにしたもの(reveal と同じ見え方): 新しい節へは右から、節の中の続き(--)へは下から入る。
 * Spectacle は出ていくスライドを、出ていく側の遷移(leave)で動かすので、出ていく向きは次のスライドに合わせる
 * (次が続きなら上へ、次が新しい節なら左へ)。向きが変わっても間が補われるよう、形はどれも translate(横, 縦) で書く
 */
export function structuralSlide(continuation: boolean, nextIsContinuation: boolean): SlideTransition {
  return {
    from: { transform: continuation ? 'translate(0%, 100%)' : 'translate(100%, 0%)', opacity: 1 },
    enter: { transform: 'translate(0%, 0%)', opacity: 1 },
    leave: { transform: nextIsContinuation ? 'translate(0%, -100%)' : 'translate(-100%, 0%)', opacity: 1 },
  }
}
