import { localOrganize } from './localOrganize'
import { getOrganizeMode, llmOrganize } from './llmOrganize'

export type OrganizeResult = {
  text: string
  mode: 'llm' | 'local'
  /** true when LLM failed and local fallback was used */
  fellBack?: boolean
  error?: string
}

export async function organizeNotes(raw: string): Promise<OrganizeResult> {
  const trimmed = raw.trim()
  if (!trimmed) return { text: '', mode: getOrganizeMode() }

  if (getOrganizeMode() === 'llm') {
    try {
      const text = await llmOrganize(trimmed)
      return { text, mode: 'llm' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'LLM 失敗'
      return {
        text: localOrganize(trimmed),
        mode: 'local',
        fellBack: true,
        error: msg,
      }
    }
  }

  return { text: localOrganize(trimmed), mode: 'local' }
}

export { getOrganizeMode, hasLlmKey } from './llmOrganize'
