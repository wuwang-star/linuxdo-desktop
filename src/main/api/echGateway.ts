/**
 * ECH 直连网关 sidecar 生命周期（10-19-ech-engine P2）。
 * 二进制：打包态 resources/ech-gateway.exe；dev 态仓库 ech-gateway/ech-gateway.exe
 * （scripts/build-ech-gateway.mjs 产出）。协议：stdout 首行 {"port":N}；
 * CA 目录（userData/ech-ca）与网关共享——网关生成 CA，本模块读 ca.pem 供证书校验。
 * 崩溃语义：进程退出即置空，下次 applyDohRuntime（重新保存/重启）重新拉起（P2 天花板，不做热重启）。
 */
import { app, session } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { X509Certificate } from 'node:crypto'

let proc: ChildProcess | null = null
let gwPort = 0
let starting: Promise<number> | null = null
let procExitHandlerInstalled = false

export function gatewayBinaryPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'ech-gateway.exe')
    : join(app.getAppPath(), 'ech-gateway', 'ech-gateway.exe')
}

export function gatewayAvailable(): boolean {
  return existsSync(gatewayBinaryPath())
}

/** CA 目录：网关生成/复用，Electron 读 ca.pem 做证书校验（同一份 CA 才能互信） */
export function caDir(): string {
  return join(app.getPath('userData'), 'ech-ca')
}

export function gatewayPort(): number {
  return gwPort
}

/** 拉起（幂等）：已运行/已在启动中直接复用；6s 超时判定失败 */
export async function ensureRunning(template: string): Promise<number> {
  if (proc && gwPort) return gwPort
  if (starting) return starting
  starting = doStart(template)
  try {
    return await starting
  } finally {
    starting = null
  }
}

function doStart(template: string): Promise<number> {
  const bin = gatewayBinaryPath()
  if (!existsSync(bin)) {
    return Promise.reject(new Error('ECH 网关二进制缺失（先执行 node scripts/build-ech-gateway.mjs）'))
  }
  const child = spawn(bin, ['--listen', '127.0.0.1:0', '--template', template, '--ca-dir', caDir()], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  proc = child
  if (!procExitHandlerInstalled) {
    procExitHandlerInstalled = true
    app.on('before-quit', () => stopGateway())
  }
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ECH 网关启动超时')), 6000)
    child.stdout!.on('data', (d: Buffer) => {
      const m = /\{"port":(\d+)\}/.exec(d.toString())
      if (m) {
        clearTimeout(timer)
        gwPort = Number(m[1])
        resolve(gwPort)
      }
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      proc = null
      gwPort = 0
      if (code) reject(new Error(`ECH 网关异常退出（code ${code}）`))
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      proc = null
      reject(e)
    })
  })
}

export function stopGateway(): void {
  if (proc) {
    proc.kill()
    proc = null
    gwPort = 0
  }
}

/**
 * 证书信任：仅当请求的既有校验失败且证书确由本地 CA 签发且主机名匹配时放行，
 * 其余一律拒绝——公共链证书走 Chromium 既有结果，不扩大信任面。
 * ca.pem 由网关首次启动生成后落盘，调用点保证已存在。
 */
export function installCertTrust(): void {
  const pemPath = join(caDir(), 'ca.pem')
  if (!existsSync(pemPath)) return
  const caCert = new X509Certificate(readFileSync(pemPath))
  session.defaultSession.setCertificateVerifyProc((req, cb) => {
    try {
      if (req.verificationResult === 'net::OK') {
        cb(0)
        return
      }
      const leaf = new X509Certificate(req.certificate.data)
      if (leaf.checkIssued(caCert) && leaf.verify(caCert.publicKey) && leaf.checkHost(req.hostname)) {
        cb(0)
        return
      }
      cb(-2)
    } catch {
      cb(-2)
    }
  })
}
