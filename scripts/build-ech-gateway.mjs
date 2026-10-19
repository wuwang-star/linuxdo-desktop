// 构建 ECH 直连网关（Go sidecar）→ ech-gateway/ech-gateway.exe
// 无 Go 环境时跳过并警告（此时 ECH 直连档不可用，其余档位不受影响）。
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

try {
  execSync('go version', { stdio: 'ignore' })
} catch {
  console.warn('[ech-gateway] 未检测到 Go 工具链，跳过网关构建（ECH 直连档将不可用）')
  process.exit(0)
}
execSync('go build -trimpath -ldflags "-s -w" -o ech-gateway.exe .', {
  stdio: 'inherit',
  cwd: 'ech-gateway'
})
if (!existsSync('ech-gateway/ech-gateway.exe')) {
  console.error('[ech-gateway] 构建产物缺失')
  process.exit(1)
}
console.log('[ech-gateway] 构建完成 ech-gateway/ech-gateway.exe')
