import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 主题工坊（userData/themes/<id>.json）。
 * 格式 v1：一份 css 文本自足——token 覆盖写在 :root{}、亮暗差异写 :root[data-theme='dark']{}，
 * 不另设 tokens 字段（单一注入路径，样式表加载序在应用样式之后即可覆盖）。
 * 安全边界：主题只允许声明式 CSS，绝不执行 JS；导入/导出全部过 validate，非法整包拒绝。
 */

export interface ThemePackage {
  format: 1
  id: string
  name: string
  author?: string
  version: string
  css: string
}

export interface ThemeMeta {
  id: string
  name: string
  author?: string
  version: string
}

export interface ImportResult {
  ok: boolean
  canceled?: boolean
  theme?: ThemeMeta
  error?: string
}

export interface ExportResult {
  ok: boolean
  canceled?: boolean
  path?: string
  error?: string
}

const MAX_CSS_BYTES = 256 * 1024
const MAX_NAME = 80

const dir = (): string => join(app.getPath('userData'), 'themes')
const fileOf = (id: string): string => join(dir(), `${id}.json`)
/** id 即文件名，必须钉死字符集防路径穿越 */
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

function ensureDir(): void {
  mkdirSync(dir(), { recursive: true })
}

/** 原子写：临时文件 + rename（同目录同卷），防半截 JSON（同 offline.ts） */
function writeAtomic(target: string, data: string): void {
  const tmp = `${target}.${process.pid}.tmp`
  writeFileSync(tmp, data, 'utf8')
  renameSync(tmp, target)
}

type ValidateResult = { ok: true; theme: ThemePackage } | { ok: false; error: string }

/** 导入/导出共用的整包校验（trust boundary）：非法返回原因，不静默修补 */
export function validateTheme(raw: unknown): ValidateResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: '不是有效的主题文件' }
  const r = raw as Record<string, unknown>
  if (r.format !== 1) return { ok: false, error: `不支持的格式版本：${String(r.format)}（当前仅 format 1）` }
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) {
    return { ok: false, error: 'id 非法（需小写字母/数字/连字符，≤64 字符）' }
  }
  if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > MAX_NAME) {
    return { ok: false, error: `name 非法（1–${MAX_NAME} 字符）` }
  }
  if (r.author !== undefined && (typeof r.author !== 'string' || r.author.length > MAX_NAME)) {
    return { ok: false, error: 'author 非法' }
  }
  if (typeof r.css !== 'string') return { ok: false, error: 'css 字段缺失或非字符串' }
  if (Buffer.byteLength(r.css, 'utf8') > MAX_CSS_BYTES) {
    return { ok: false, error: `css 超过 ${MAX_CSS_BYTES / 1024}KB 上限` }
  }
  return {
    ok: true,
    theme: {
      format: 1,
      id: r.id,
      name: r.name.trim(),
      author: typeof r.author === 'string' ? r.author : undefined,
      version: typeof r.version === 'string' ? r.version.slice(0, 32) : '0.0.0',
      css: r.css
    }
  }
}

function readPackage(id: string): ThemePackage | null {
  try {
    if (!ID_RE.test(id) || !existsSync(fileOf(id))) return null
    const v = validateTheme(JSON.parse(readFileSync(fileOf(id), 'utf8')))
    return v.ok ? v.theme : null
  } catch {
    return null
  }
}

export function listThemes(): ThemeMeta[] {
  try {
    ensureDir()
    return readdirSync(dir())
      .filter((f) => f.endsWith('.json'))
      .map((f): ThemeMeta | null => {
        try {
          const v = validateTheme(JSON.parse(readFileSync(join(dir(), f), 'utf8')))
          return v.ok ? { id: v.theme.id, name: v.theme.name, author: v.theme.author, version: v.theme.version } : null
        } catch {
          return null
        }
      })
      .filter((m): m is ThemeMeta => m !== null)
  } catch {
    return []
  }
}

export function getTheme(id: string): ThemePackage | null {
  return readPackage(id)
}

export async function importTheme(): Promise<ImportResult> {
  const res = await dialog.showOpenDialog({
    title: '导入主题',
    filters: [{ name: '主题包', extensions: ['json', 'ldtheme'] }],
    properties: ['openFile']
  })
  if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true }
  try {
    const v = validateTheme(JSON.parse(readFileSync(res.filePaths[0], 'utf8')))
    if (!v.ok) return { ok: false, error: v.error }
    ensureDir()
    writeAtomic(fileOf(v.theme.id), JSON.stringify(v.theme, null, 2))
    return {
      ok: true,
      theme: { id: v.theme.id, name: v.theme.name, author: v.theme.author, version: v.theme.version }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 导出（内置主题与导入主题同走此路：renderer 传整包，主进程校验后另存） */
export async function exportThemeData(raw: unknown): Promise<ExportResult> {
  const v = validateTheme(raw)
  if (!v.ok) return { ok: false, error: v.error }
  const res = await dialog.showSaveDialog({
    title: '导出主题',
    defaultPath: `${v.theme.id}.ldtheme.json`,
    filters: [{ name: '主题包', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, canceled: true }
  try {
    writeAtomic(res.filePath, JSON.stringify(v.theme, null, 2))
    return { ok: true, path: res.filePath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function removeTheme(id: string): boolean {
  try {
    if (!ID_RE.test(id)) return false
    rmSync(fileOf(id), { force: true })
    return true
  } catch {
    return false
  }
}
