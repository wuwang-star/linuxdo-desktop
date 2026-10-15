import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface TranslateConfig {
  baseUrl: string
  model: string
  hasKey: boolean
}

/** DoH 模式：secure=只用加密解析（失败即断）；auto=加密优先、失败回退系统 DNS */
export type DohMode = 'secure' | 'auto'

export interface DohConfig {
  enabled: boolean
  mode: DohMode
  template: string
}

/**
 * DoH 默认值：关闭 + secure + Cloudflare 模板。
 * enabled 默认 false：Electron 44 网络服务不消费 DoH 命令行开关（源码核实，见 SPEC），
 * 默认开启只是「假装生效」；待真实现（本地 DoH 代理等）落地后再放开。
 */
const DOH_DEFAULT: DohConfig = { enabled: false, mode: 'secure', template: 'https://1.1.1.1/dns-query' }

interface StoredConfig {
  baseUrl: string
  model: string
  dohEnabled: boolean
  dohMode: DohMode
  dohTemplate: string
}

const cfgFile = (): string => join(app.getPath('userData'), 'translate-settings.json')
const keyFile = (): string => join(app.getPath('userData'), 'translate-key.enc')

let cache: StoredConfig | null = null
let apiKey: string | null = null

/**
 * 模板校验：必须 https:// 开头的合法 URL 且不含空白字符，非法返回 null（由调用方静默回退默认）。
 * 返回规范化后的 href（new URL 归一大小写/路径），保证落盘值形态统一。
 */
function validDohTemplate(t: unknown): string | null {
  if (typeof t !== 'string' || !t || /\s/.test(t)) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

/** DoH 三字段提取（旧配置文件无字段时取默认值，向后兼容） */
function dohFieldsOf(raw: Partial<StoredConfig>): {
  dohEnabled: boolean
  dohMode: DohMode
  dohTemplate: string
} {
  return {
    // 布尔归一：undefined（旧文件无字段）→ 默认 false；其余值经 Boolean 强转，防脏数据进开关逻辑
    dohEnabled: raw.dohEnabled === undefined ? DOH_DEFAULT.enabled : Boolean(raw.dohEnabled),
    dohMode: raw.dohMode === 'auto' ? 'auto' : 'secure',
    dohTemplate: validDohTemplate(raw.dohTemplate) ?? DOH_DEFAULT.template
  }
}

/** 原子写盘：临时文件 + rename（同目录保证同卷），防半截 JSON 连带毁掉同文件的 translate 配置 */
function writeConfigFile(data: StoredConfig): void {
  const target = cfgFile()
  const tmp = `${target}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, target)
}

function loadOnce(): void {
  if (cache) return
  try {
    if (existsSync(cfgFile())) {
      const raw = JSON.parse(readFileSync(cfgFile(), 'utf8')) as StoredConfig
      cache = { baseUrl: raw.baseUrl ?? '', model: raw.model ?? '', ...dohFieldsOf(raw) }
    }
  } catch {
    cache = null
  }
  try {
    if (existsSync(keyFile()) && safeStorage.isEncryptionAvailable()) {
      apiKey = safeStorage.decryptString(readFileSync(keyFile())) || null
    }
  } catch {
    apiKey = null
  }
}

export function getTranslateConfig(): TranslateConfig {
  loadOnce()
  return { baseUrl: cache?.baseUrl ?? '', model: cache?.model ?? '', hasKey: apiKey !== null && apiKey !== '' }
}

/**
 * 保存翻译服务配置。key 传 undefined 表示保持现状（不改密钥），
 * 传空串表示清除。密钥经 safeStorage 加密落盘，绝不进同步/导出。
 */
export function setTranslateConfig(baseUrl: string, model: string, key?: string): TranslateConfig {
  loadOnce()
  cache = {
    baseUrl: baseUrl.trim().replace(/\/+$/, ''),
    model: model.trim(),
    dohEnabled: cache?.dohEnabled ?? DOH_DEFAULT.enabled,
    dohMode: cache?.dohMode ?? DOH_DEFAULT.mode,
    dohTemplate: cache?.dohTemplate ?? DOH_DEFAULT.template
  }
  try {
    writeConfigFile(cache)
  } catch {
    /* 配置写失败不阻塞，内存态仍生效 */
  }
  if (key !== undefined) {
    try {
      if (!key) {
        apiKey = null
        if (existsSync(keyFile())) rmSync(keyFile())
      } else if (safeStorage.isEncryptionAvailable()) {
        apiKey = key
        writeFileSync(keyFile(), safeStorage.encryptString(key))
      } else {
        // 加密不可用：仅保存在内存（进程退出即失效）
        apiKey = key
      }
    } catch {
      /* 密钥写失败不阻塞 */
    }
  }
  return getTranslateConfig()
}

export function translateApiKey(): string | null {
  loadOnce()
  return apiKey
}

/**
 * 启动早期读取 DoH 配置（app.whenReady 之前可安全调用）。
 * 只读 JSON 文本部分，绝不触碰 safeStorage——其行为在 ready 前不保证。
 */
export function loadDohEarly(): DohConfig {
  let raw: Partial<StoredConfig> = {}
  try {
    if (existsSync(cfgFile())) {
      raw = JSON.parse(readFileSync(cfgFile(), 'utf8')) as Partial<StoredConfig>
    }
  } catch {
    raw = {} // 文件损坏用默认值
  }
  const d = dohFieldsOf(raw)
  return { enabled: d.dohEnabled, mode: d.dohMode, template: d.dohTemplate }
}

export function getDohConfig(): DohConfig {
  loadOnce()
  return {
    enabled: cache?.dohEnabled ?? DOH_DEFAULT.enabled,
    mode: cache?.dohMode ?? DOH_DEFAULT.mode,
    template: cache?.dohTemplate ?? DOH_DEFAULT.template
  }
}

/**
 * 保存 DoH 配置（明文 JSON，与 translate 配置同文件、无敏感数据）。
 * mode 只认 secure/auto；模板非法静默回退默认。改动重启生效（Chromium 开关限制）。
 */
export function setDohConfig(enabled: boolean, mode: DohMode, template: string): DohConfig {
  loadOnce()
  cache = {
    baseUrl: cache?.baseUrl ?? '',
    model: cache?.model ?? '',
    dohEnabled: Boolean(enabled),
    dohMode: mode === 'auto' ? 'auto' : 'secure',
    dohTemplate: validDohTemplate(template.trim()) ?? DOH_DEFAULT.template
  }
  try {
    writeConfigFile(cache)
  } catch {
    /* 配置写失败不阻塞，内存态仍生效 */
  }
  return getDohConfig()
}
