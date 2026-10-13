import type { AssistantProfile } from './types'

export const PROFILE_KEY = 'employee-todo-profile-v1'
export const DEFAULT_DISPLAY_NAME = '羊'
export const DEFAULT_FIELD_PIN = '2468'

export function loadProfile(): AssistantProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AssistantProfile
    if (parsed?.role === 'assistant' && parsed.displayName?.trim()) {
      return {
        displayName: parsed.displayName.trim(),
        role: 'assistant',
        fieldPin: parsed.fieldPin?.trim() || DEFAULT_FIELD_PIN,
        linkedAt: parsed.linkedAt || Date.now(),
        lineUserId: parsed.lineUserId,
        lineDisplayName: parsed.lineDisplayName,
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function saveProfile(profile: AssistantProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY)
}

export function linkAssistant(
  displayName: string,
  fieldPin?: string,
  line?: { userId?: string; displayName?: string },
): AssistantProfile {
  const profile: AssistantProfile = {
    displayName: displayName.trim() || DEFAULT_DISPLAY_NAME,
    role: 'assistant',
    fieldPin:
      (fieldPin?.trim() || DEFAULT_FIELD_PIN).replace(/\D/g, '').slice(0, 8) ||
      DEFAULT_FIELD_PIN,
    linkedAt: Date.now(),
    lineUserId: line?.userId,
    lineDisplayName: line?.displayName,
  }
  saveProfile(profile)
  return profile
}
