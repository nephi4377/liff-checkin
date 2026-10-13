/** 可選雲端 LLM（build 時注入 VITE_OPENAI_API_KEY；勿把密鑰 commit）。 */

export type OrganizeMode = 'llm' | 'local'

export function getOrganizeMode(): OrganizeMode {
  const key = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim()
  return key ? 'llm' : 'local'
}

export function hasLlmKey(): boolean {
  return getOrganizeMode() === 'llm'
}

const SYSTEM = `你是工地派工小助手。把雜亂中文派工筆記整理成可直接貼進「詳細說明」的繁體中文。
輸出格式（務必遵守）：
1) 第一行：短標題（可含單號如 #786、主要工序、對象）
2) 空一行後用「・」條列細節
3) 有提到就寫：對象（恩德／阿勇）、分類（優先／限期／待處理）、緊急、期限、地點、單號、要拍照／確認的人
規則：
- 只輸出正文，不要前言、不要 Markdown 代碼塊
- 保留專有名詞與單號；可把「豪哥確認」寫成「請豪哥確認」、「拍照」寫成「拍照存證」
- 不要發明原文沒有的事實`

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
