/** 可選雲端 LLM（build 時注入 VITE_OPENAI_API_KEY；勿把密鑰 commit）。 */

export type OrganizeMode = 'llm' | 'local'

export function getOrganizeMode(): OrganizeMode {
  const key = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim()
  return key ? 'llm' : 'local'
}

export function hasLlmKey(): boolean {
  return getOrganizeMode() === 'llm'
}

const SYSTEM = `你是工地派工小助手。把使用者的雜亂筆記整理成繁體中文「詳細說明」文字，方便貼進派工系統。
規則：
- 只輸出整理後正文，不要前言、不要 Markdown 代碼塊
- 盡量標出：對象（恩德／阿勇）、分類（優先／限期／待處理）、緊急程度、期限、地點、材料、注意事項
- 用精簡條列，保留原意與專有名詞
- 不要發明沒寫的事實`

export async function llmOrganize(raw: string): Promise<string> {
  const key = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim()
  if (!key) throw new Error('NO_KEY')

  const base = (
    (import.meta.env.VITE_OPENAI_BASE_URL as string | undefined)?.trim() ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '')
  const model =
    (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() ||
    'gpt-4o-mini'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: raw },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LLM ${res.status}: ${errText.slice(0, 120)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('EMPTY_LLM')
  return text
}
