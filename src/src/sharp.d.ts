// sharp 0.35 的 package.json `exports` 未声明 `types` 条件，
// 在 moduleResolution: bundler 下 TS 取不到其自带的 lib/index.d.ts（sharp 已知问题）。
// 这里补一条最小模块声明，仅覆盖本项目 lib/uploads.ts 实际用到的 API；
// 运行时仍是真实的 sharp，本文件只为让 tsc 通过。
declare module 'sharp' {
  export interface Metadata {
    format?: string
    hasAlpha?: boolean
    width?: number
    height?: number
  }
  export interface Stats {
    isOpaque: boolean
  }
  interface Sharp {
    metadata: () => Promise<Metadata>
    stats: () => Promise<Stats>
    png: (options?: Record<string, unknown>) => Sharp
    webp: (options?: Record<string, unknown>) => Sharp
    toBuffer: () => Promise<Buffer>
  }
  interface SharpConstructor {
    (input?: Buffer | Uint8Array, options?: Record<string, unknown>): Sharp
    (options: Record<string, unknown>): Sharp
  }
  const sharp: SharpConstructor
  export default sharp
}
