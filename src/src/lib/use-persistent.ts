import { useEffect, useState } from 'react'

/**
 * 像 useState，但把值持久化到 localStorage（按 key）。
 * SSR / 无 window 时回退到 initial，首帧不读存储，避免水合不一致。
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* 存储不可用时忽略 */
    }
  }, [key, state])

  return [state, setState]
}
