import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomInt } from 'node:crypto'

export interface TranslateConfig {
  baseUrl: string
  model: string
  hasKey: boolean
}

/** DoH 模式：secure=只用加密解析（失败即断）；auto=加密优先、失败回退系统 DNS */
export type DohMode = 'secure' | 'auto'

/** 上游代理模式（10-18 网络设置 FluxDO 化）：manual=显式配置最可靠；system=探测系统代理；off=仅 DoH 直连 */
export type ProxyMode = 'system' | 'manual' | 'off'

export interface NetworkConfig {
  proxyMode: ProxyMode
  proxyHost: string
  proxyPort: number
}

export interface DohConfig {
  enabled: boolean
  mode: DohMode
  template: string
}

export interface NotificationConfig {
  enabled: boolean
}

/** 伴生扩展桥接配置：开关 + 6 位数字配对码（弱凭据，仅防本机其他程序误撞，见 SPEC） */
export interface BridgeConfig {
  enabled: boolean
  pairCode: string
}

/**
 * 全局快捷键开关（注册/注销由 shortcuts.ts 负责）：
 * 呼出主窗默认开（PRD R1）；队列下一贴默认关——全局组合键易与系统/其他应用冲突（PRD R2）。
 */
export interface ShortcutsConfig {
  callWindow: boolean
  nextTopic: boolean
}

/**
 * DoH 默认值：关闭 + secure + 自建模板（用户指定自建端点 edge.1molchuan.top，2026-10-16）。
 * enabled 默认 false：真实现（本地 DoH 代理，dohProxy.ts）已落地，默认开启待真机验收后再放开。
 */
const DOH_DEFAULT: DohConfig = { enabled: false, mode: 'secure', template: 'https://edge.1molchuan.top/linuxdo' }

interface StoredConfig {
  baseUrl: string
  model: string
  dohEnabled: boolean
  dohMode: DohMode
  dohTemplate: string
  proxyMode: ProxyMode
  proxyHost: string
  proxyPort: number
  notificationEnabled: boolean
  bridgeEnabled: boolean
  bridgePairCode: string
  shortcutCallWindow: boolean
  shortcutNextTopic: boolean
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

const NETWORK_DEFAULT: NetworkConfig = { proxyMode: 'system', proxyHost: '127.0.0.1', proxyPort: 7890 }

/** 上游代理三字段提取（归一：mode 白名单/host 非空/port 1-65535，脏数据回默认） */
function networkFieldsOf(raw: Partial<StoredConfig> | null): NetworkConfig {
  const port = Number(raw?.proxyPort)
  return {
    proxyMode: raw?.proxyMode === 'manual' || raw?.proxyMode === 'off' ? raw.proxyMode : 'system',
    proxyHost: typeof raw?.proxyHost === 'string' && raw.proxyHost.trim() ? raw.proxyHost.trim() : NETWORK_DEFAULT.proxyHost,
    proxyPort: Number.isInteger(port) && port > 0 && port < 65536 ? port : NETWORK_DEFAULT.proxyPort
  }
}

/** 桥接两字段提取（旧配置文件无字段时取默认值：关闭 + 空码） */
function bridgeFieldsOf(c: StoredConfig | null): { bridgeEnabled: boolean; bridgePairCode: string } {
  return {
    bridgeEnabled: c?.bridgeEnabled ?? false,
    bridgePairCode: typeof c?.bridgePairCode === 'string' ? c.bridgePairCode : ''
  }
}

/** 快捷键两字段提取（旧配置文件无字段时取默认值：呼出开 / 下一贴关；Boolean 归一防脏数据） */
function shortcutFieldsOf(c: Partial<StoredConfig> | null): { shortcutCallWindow: boolean; shortcutNextTopic: boolean } {
  return {
    shortcutCallWindow: c?.shortcutCallWindow === undefined ? true : Boolean(c.shortcutCallWindow),
    shortcutNextTopic: c?.shortcutNextTopic === undefined ? false : Boolean(c.shortcutNextTopic)
  }
}

/** 6 位数字配对码（密码学随机，前导零保留） */
function genPairCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
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
      cache = {
        baseUrl: raw.baseUrl ?? '',
        model: raw.model ?? '',
        ...dohFieldsOf(raw),
        ...networkFieldsOf(raw),
        // 旧配置文件无此字段（p2a 之前）→ 默认开启；其余值 Boolean 强转防脏数据
        notificationEnabled: raw.notificationEnabled === undefined ? true : Boolean(raw.notificationEnabled),
        bridgeEnabled: raw.bridgeEnabled === undefined ? false : Boolean(raw.bridgeEnabled),
        bridgePairCode: typeof raw.bridgePairCode === 'string' ? raw.bridgePairCode : '',
        ...shortcutFieldsOf(raw)
      }
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
    dohTemplate: cache?.dohTemplate ?? DOH_DEFAULT.template,
    ...networkFieldsOf(cache),
    notificationEnabled: cache?.notificationEnabled ?? true,
    ...bridgeFieldsOf(cache),
    ...shortcutFieldsOf(cache)
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

export function getNetworkConfig(): NetworkConfig {
  loadOnce()
  return networkFieldsOf(cache)
}

/** 保存上游代理配置（manual 的 host:port 归一）。代理启停由 ipc 层保存后即时应用（applyDohRuntime）。 */
export function setNetworkConfig(mode: ProxyMode, host: string, port: number): NetworkConfig {
  loadOnce()
  cache = {
    baseUrl: cache?.baseUrl ?? '',
    model: cache?.model ?? '',
    dohEnabled: cache?.dohEnabled ?? DOH_DEFAULT.enabled,
    dohMode: cache?.dohMode ?? DOH_DEFAULT.mode,
    dohTemplate: cache?.dohTemplate ?? DOH_DEFAULT.template,
    proxyMode: mode === 'manual' || mode === 'off' ? mode : 'system',
    proxyHost: host.trim() || NETWORK_DEFAULT.proxyHost,
    proxyPort: Number.isInteger(port) && port > 0 && port < 65536 ? port : NETWORK_DEFAULT.proxyPort,
    notificationEnabled: cache?.notificationEnabled ?? true,
    ...bridgeFieldsOf(cache),
    ...shortcutFieldsOf(cache)
  }
  try {
    writeConfigFile(cache)
  } catch {
    /* 配置写失败不阻塞，内存态仍生效 */
  }
  return networkFieldsOf(cache)
}

/**
 * 保存 DoH 配置（明文 JSON，与 translate 配置同文件、无敏感数据）。
 * mode 只认 secure/auto；模板非法静默回退默认。代理启停由 ipc 层保存后即时应用（applyDohRuntime）。
 */
export function setDohConfig(enabled: boolean, mode: DohMode, template: string): DohConfig {
  loadOnce()
  cache = {
    baseUrl: cache?.baseUrl ?? '',
    model: cache?.model ?? '',
    dohEnabled: Boolean(enabled),
    dohMode: mode === 'auto' ? 'auto' : 'secure',
    dohTemplate: validDohTemplate(template.trim()) ?? DOH_DEFAULT.template,
    ...networkFieldsOf(cache),
    notificationEnabled: cache?.notificationEnabled ?? true,
    ...bridgeFieldsOf(cache),
    ...shortcutFieldsOf(cache)
  }
  try {
    writeConfigFile(cache)
  } catch {
    /* 配置写失败不阻塞，内存态仍生效 */
  }
  return getDohConfig()
}

export function getNotificationConfig(): NotificationConfig {
  loadOnce()
  return { enabled: cache?.notificationEnabled ?? true }
}

/**
 * 保存原生通知开关（明文 JSON，与 translate/DoH 同文件）。
 * 内存 cache 即时生效——notify.ts 每次发送前读取，无需重启。
 */
export function setNotificationConfig(enabled: boolean): NotificationConfig {
  loadOnce()
  cache = {
    baseUrl: cache?.baseUrl ?? '',
    model: cache?.model ?? '',
    dohEnabled: cache?.dohEnabled ?? DOH_DEFAULT.enabled,
    dohMode: cache?.dohMode ?? DOH_DEFAULT.mode,
    dohTemplate: cache?.dohTemplate ?? DOH_DEFAULT.template,
    ...networkFieldsOf(cache),
    notificationEnabled: Boolean(enabled),
    ...bridgeFieldsOf(cache),
    ...shortcutFieldsOf(cache)
  }
  try {
    writeConfigFile(cache)
  } catch {
    /* 配置写失败不阻塞，内存态仍生效 */
  }
  return getNotificationConfig()
}

// ---------- 伴生扩展桥接（Edge 自动同步 _t，bridge.ts 消费） ----------

/**
 * 读取桥接配置。配对码为空且开关已开时现场生成并持久化（首次启用即出码）。
 * 注意：生成的码不落 safeStorage——弱凭据仅防本机其他程序误撞，回环绑定已限攻击面。
 */
export function getBridgeConfig(): BridgeConfig {
  loadOnce()
  let code = bridgeFieldsOf(cache).bridgePairCode
  if (!code && cache?.bridgeEnabled) {
    code = genPairCode()
    cache = { ...cache, bridgePairCode: code }
    try {
      writeConfigFile(cache)
    } catch {
      /* 写失败不阻塞，内存态生效 */
    }
  }
  return { enabled: cache?.bridgeEnabled ?? false, pairCode: code }
}

/** 开关桥接（持久化）。开启时若无码则生成；监听器的启停由 bridge.ts 负责 */
export function setBridgeEnabled(enabled: boolean): BridgeConfig {
  loadOnce()
  const base = cache ?? {
    baseUrl: '',
    model: '',
    dohEnabled: DOH_DEFAULT.enabled,
    dohMode: DOH_DEFAULT.mode,
    dohTemplate: DOH_DEFAULT.template,
    ...networkFieldsOf(null),
    notificationEnabled: true,
    bridgeEnabled: false,
    bridgePairCode: '',
    ...shortcutFieldsOf(null)
  }
  const next = Boolean(enabled)
  let code = bridgeFieldsOf(cache).bridgePairCode
  if (next && !code) code = genPairCode()
  cache = { ...base, bridgeEnabled: next, bridgePairCode: code }
  try {
    writeConfigFile(cache)
  } catch {
    /* 写失败不阻塞，内存态仍生效 */
  }
  return { enabled: next, pairCode: code }
}

/** 重新生成配对码（旧码立即失效），无论开关状态均可调用 */
export function regenBridgePair(): BridgeConfig {
  loadOnce()
  const base = cache ?? {
    baseUrl: '',
    model: '',
    dohEnabled: DOH_DEFAULT.enabled,
    dohMode: DOH_DEFAULT.mode,
    dohTemplate: DOH_DEFAULT.template,
    ...networkFieldsOf(null),
    notificationEnabled: true,
    bridgeEnabled: false,
    bridgePairCode: '',
    ...shortcutFieldsOf(null)
  }
  const code = genPairCode()
  cache = { ...base, bridgePairCode: code }
  try {
    writeConfigFile(cache)
  } catch {
    /* 写失败不阻塞，内存态仍生效 */
  }
  return { enabled: cache.bridgeEnabled, pairCode: code }
}

// ---------- 全局快捷键（呼出主窗 / 队列下一贴，shortcuts.ts 消费） ----------

/** 读取快捷键开关（注册/注销由 shortcuts.ts 负责） */
export function getShortcutsConfig(): ShortcutsConfig {
  loadOnce()
  const f = shortcutFieldsOf(cache)
  return { callWindow: f.shortcutCallWindow, nextTopic: f.shortcutNextTopic }
}

/** 切换单个快捷键开关（持久化）。两项互不影响；即时注册/注销由 shortcuts.ts 负责 */
export function setShortcutEnabled(kind: 'callWindow' | 'nextTopic', enabled: boolean): ShortcutsConfig {
  loadOnce()
  const base = cache ?? {
    baseUrl: '',
    model: '',
    dohEnabled: DOH_DEFAULT.enabled,
    dohMode: DOH_DEFAULT.mode,
    dohTemplate: DOH_DEFAULT.template,
    ...networkFieldsOf(null),
    notificationEnabled: true,
    bridgeEnabled: false,
    bridgePairCode: '',
    ...shortcutFieldsOf(null)
  }
  const next = Boolean(enabled)
  cache = kind === 'callWindow' ? { ...base, shortcutCallWindow: next } : { ...base, shortcutNextTopic: next }
  try {
    writeConfigFile(cache)
  } catch {
    /* 写失败不阻塞，内存态仍生效 */
  }
  return getShortcutsConfig()
}
