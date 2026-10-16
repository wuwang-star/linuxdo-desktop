/**
 * 主题工坊：应用与选择（renderer 本地，分层同 prefs.ts——UI 状态不经主进程持久化）。
 * 注入机制：整包 css 写入 <style data-app-theme>（head 末尾，晚于应用样式即同权重覆盖）；
 * token 覆盖由主题 css 自己的 :root{} / :root[data-theme='dark']{} 承载，单一注入路径。
 * 主题只可能是声明式 CSS（主进程 validateTheme 把关），永不执行脚本。
 */

import type { ThemePackage } from '../../../main/themes'
import { feishuTheme } from '../assets/themes/feishu'

const STYLE_ID = 'app-theme-style'
const STORAGE_KEY = 'ldd-theme'

/** 内置主题（不可删，可导出分享）；'' = 默认外观 */
export const BUILTIN_THEMES: ThemePackage[] = [feishuTheme]

export function loadSelectedThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveSelectedThemeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* 存储不可用时静默：本次会话内仍生效 */
  }
}

function styleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    el.dataset.appTheme = ''
    document.head.appendChild(el)
  }
  return el
}

/** 应用整包（css 文本直接注入；空串 = 还原默认） */
export function applyThemePackage(pkg: ThemePackage | null): void {
  styleEl().textContent = pkg?.css ?? ''
}

/**
 * 按选中 id 应用主题：'' = 默认；内置命中静态包；其余走主进程读盘。
 * 返回 false 表示主题不存在/读取失败（保持原状，调用方提示）。
 */
export async function applyThemeById(id: string): Promise<boolean> {
  if (id === '') {
    applyThemePackage(null)
    saveSelectedThemeId(id)
    return true
  }
  const builtin = BUILTIN_THEMES.find((t) => t.id === id)
  const pkg = builtin ?? (await window.api.themesGet(id))
  if (!pkg) return false
  applyThemePackage(pkg)
  saveSelectedThemeId(id)
  return true
}
