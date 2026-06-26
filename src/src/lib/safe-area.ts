// 移动端安全区域（safe area）与主程序悬浮胶囊的共享状态。
//
// 布局让位（padding、max-height）走 CSS 变量 --safe-top/--safe-bottom/--capsule-reserve
// （见 styles.css，由 lib/dootask.ts 写入）。但 Radix 浮层的 collisionPadding 需要的是
// JS 数值（不能读 CSS 变量），所以这里再镜像一份像素值，供 Select/Popover 等下拉避让用。

export interface SafeInsets {
  top: number
  bottom: number
}

// 主程序胶囊位于右上角（top:10px + 状态栏高度），宽约 100px、高约 30px。
// 顶部预留 48px 足以让浮层底边落在胶囊之下。仅移动宿主生效。
export const CAPSULE_RESERVE = 48

let insets: SafeInsets = { top: 0, bottom: 0 }

export function setSafeInsets(next: SafeInsets) {
  insets = next
}

export function getSafeInsets(): SafeInsets {
  return insets
}

// 是否需要为胶囊预留顶部空间：只有真正存在顶部安全区（移动宿主）时才需要。
export function getCapsuleReserve(): number {
  return insets.top > 0 ? CAPSULE_RESERVE : 0
}

// Radix 浮层（Select/Popover）的默认碰撞内边距：让下拉不顶进刘海/胶囊、不压 Home 条。
// 左右留 8px 常规边距。
export function safeCollisionPadding() {
  return {
    top: insets.top + getCapsuleReserve(),
    bottom: insets.bottom,
    left: 8,
    right: 8,
  }
}
