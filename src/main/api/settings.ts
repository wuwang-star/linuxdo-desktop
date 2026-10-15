import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface TranslateConfig {
  baseUrl: string
  model: string
  hasKey: boolean
}

interface StoredConfig {
  baseUrl: string
  model: string
}

const cfgFile = (): string => join(app.getPath('userData'), 'translate-settings.json')
const keyFile = (): string => join(app.getPath('userData'), 'translate-key.enc')

let cache: StoredConfig | null = null
let apiKey: string | null = null

function loadOnce(): void {
  if (cache) return
  try {
    if (existsSync(cfgFile())) {
      const raw = JSON.parse(readFileSync(cfgFile(), 'utf8')) as StoredConfig
      cache = { baseUrl: raw.baseUrl ?? '', model: raw.model ?? '' }
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
  cache = { baseUrl: baseUrl.trim().replace(/\/+$/, ''), model: model.trim() }
  try {
    writeFileSync(cfgFile(), JSON.stringify(cache, null, 2), 'utf8')
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
