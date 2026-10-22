import { localOrganize } from './localOrganize'

export type OrganizeResult = {
  text: string
  mode: 'local'
}

/** 派工筆記整理（僅本機規則；前端不呼叫外部 LLM／不讀 API 金鑰）。 */
export async function organizeNotes(raw: string): Promise<OrganizeResult> {
  const trimmed = raw.trim()
  if (!trimmed) return { text: '', mode: 'local' }
  return { text: localOrganize(trimmed), mode: 'local' }
}
