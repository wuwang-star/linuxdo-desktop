// 生成占位应用图标 build/icon.png（512×512 RGBA）：圆角深底 + 白色「L」+ 橙色圆点。
// 纯 Node 标准库（zlib + 手写 CRC32），零依赖；正式图标定稿后可直接替换该 png。
// 用法：node build/gen-icon.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 512
const RADIUS = 112 // 圆角半径
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'icon.png')

// ---- PNG CRC32（手写，标准表算法） ----
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, crc])
}

// ---- 像素着色：返回 [r,g,b,a]，坐标为超采样后的实际像素坐标 ----
const BG = [79, 70, 229] // 靛蓝底
const FG = [255, 255, 255] // 白色 L
const DOT = [245, 158, 11] // 橙点
const L_VERTICAL = [168, 128, 252, 392] // x0,y0,x1,y1
const L_HORIZONTAL = [168, 308, 384, 392]
const DOT_C = [380, 140, 44] // cx,cy,r

function inRect(x, y, [x0, y0, x1, y1]) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1
}
function colorAt(x, y) {
  // 圆角矩形内测试：到四个圆角圆心的距离
  const dx = Math.max(RADIUS - x, x - (SIZE - 1 - RADIUS), 0)
  const dy = Math.max(RADIUS - y, y - (SIZE - 1 - RADIUS), 0)
  if (dx * dx + dy * dy > RADIUS * RADIUS) return [0, 0, 0, 0]
  if (inRect(x, y, L_VERTICAL) || inRect(x, y, L_HORIZONTAL)) return [...FG, 255]
  const ddx = x - DOT_C[0]
  const ddy = y - DOT_C[1]
  if (ddx * ddx + ddy * ddy <= DOT_C[2] * DOT_C[2]) return [...DOT, 255]
  return [...BG, 255]
}

// ---- 逐像素绘制（2×2 超采样做边缘抗锯齿；RGB 按透明度加权，避免透明黑边） ----
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
let p = 0
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0 // filter: None
  for (let x = 0; x < SIZE; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (const [sx, sy] of [
      [x + 0.25, y + 0.25],
      [x + 0.75, y + 0.25],
      [x + 0.25, y + 0.75],
      [x + 0.75, y + 0.75]
    ]) {
      const [cr, cg, cb, ca] = colorAt(sx, sy)
      r += cr * ca
      g += cg * ca
      b += cb * ca
      a += ca
    }
    if (a > 0) {
      r = Math.round(r / a)
      g = Math.round(g / a)
      b = Math.round(b / a)
    }
    raw[p++] = r
    raw[p++] = g
    raw[p++] = b
    raw[p++] = Math.round(a / 4)
  }
}

// ---- 组装 PNG：签名 + IHDR + IDAT + IEND ----
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type: RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, png)
console.log(`ICON_OK ${OUT} ${png.length} bytes`)
