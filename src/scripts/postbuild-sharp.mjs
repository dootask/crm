// 构建后置步骤：把 sharp 的 libvips 共享库补进 .output。
//
// 背景：Nitro 的依赖追踪能把 @img/sharp-<平台>/lib/*.node 复制进
// .output/server/node_modules/@img/，但该 .node 在运行时用 dlopen 加载的
// libvips 共享库（@img/sharp-libvips-<平台>/lib/*.so）是 node-file-trace 静态
// 分析不到的，于是缺失，导致运行时 ERR_DLOPEN_FAILED: libvips-cpp.so...。
//
// sharp 0.33+ 的布局约定：sharp-<平台>/lib/*.node 按相对路径
// ../../sharp-libvips-<平台>/lib 找 .so，故只要把对应 libvips 包整包复制到
// .output/server/node_modules/@img/ 下即可。对 .output 里出现的每个 sharp-<平台>
// 都补齐其 libvips 包。幂等、找不到则跳过（非镜像/无 sharp 的构建不受影响）。

import { cpSync, existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outImg = resolve(root, '.output/server/node_modules/@img')

if (!existsSync(outImg)) {
  console.log('[postbuild-sharp] 未发现 .output 下的 @img，跳过')
  process.exit(0)
}

/** 在 node_modules 里定位 @img/<name>（兼容 pnpm 的 .pnpm 布局）。 */
function findPkg(name) {
  const direct = resolve(root, 'node_modules/@img', name)
  if (existsSync(direct)) return direct
  const pnpmDir = resolve(root, 'node_modules/.pnpm')
  if (existsSync(pnpmDir)) {
    const hit = readdirSync(pnpmDir).find((d) => d.startsWith(`@img+${name}@`))
    if (hit) {
      const p = resolve(pnpmDir, hit, 'node_modules/@img', name)
      if (existsSync(p)) return p
    }
  }
  return null
}

const platforms = readdirSync(outImg).filter(
  (d) =>
    d.startsWith('sharp-') &&
    !d.startsWith('sharp-libvips') &&
    !d.startsWith('sharp-wasm'),
)

for (const sp of platforms) {
  const libvips = `sharp-libvips-${sp.replace(/^sharp-/, '')}`
  const dest = resolve(outImg, libvips)
  if (existsSync(dest)) continue
  const src = findPkg(libvips)
  if (src) {
    cpSync(src, dest, { recursive: true })
    console.log(`[postbuild-sharp] 已补入 ${libvips}`)
  } else {
    console.log(`[postbuild-sharp] 未找到 ${libvips}（${sp} 缺少对应 libvips 包）`)
  }
}
