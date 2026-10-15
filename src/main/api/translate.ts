import { net } from 'electron'
import { getTranslateConfig, translateApiKey } from './settings'

const cache = new Map<number, string>()

/**
 * 用 OpenAI 兼容端点翻译帖子正文（渲染层先剥掉 HTML 取纯文本）。
 * 译文按 postId 内存缓存；超长内容截断后翻译。
 */
export async function translatePostText(postId: number, text: string): Promise<string> {
  const hit = cache.get(postId)
  if (hit) return hit

  const cfg = getTranslateConfig()
  const key = translateApiKey()
  if (!cfg.baseUrl || !key) {
    throw new Error('未配置翻译服务：请在登录/设置页填写 baseUrl、model 与 API Key')
  }

  const clipped = text.length > 6000 ? `${text.slice(0, 6000)}\n…（超长已截断）` : text
  const res = await net.fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            '你是论坛帖子翻译器。把用户内容翻译为简体中文：保留段落与换行，不解释、不添加内容，代码块原样保留，直接输出译文。'
        },
        { role: 'user', content: clipped }
      ]
    })
  })
  if (!res.ok) {
    throw new Error(`翻译服务 HTTP ${res.status}（检查 baseUrl/model/API Key）`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const out = data.choices?.[0]?.message?.content?.trim()
  if (!out) throw new Error('翻译服务返回空结果')
  cache.set(postId, out)
  return out
}
