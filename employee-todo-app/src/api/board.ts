import { resolvePersona, type AppPersona } from '../role'

/** 對齊 Backend_GAS `employee-todo-rebuild.md` board 參數 */
export type TodoBoard = 'paigong' | 'ende' | 'ayong'

export function personaToBoard(persona: AppPersona): TodoBoard | null {
  if (persona === 'assistant') return 'paigong'
  if (persona === 'ops-ende') return 'ende'
  if (persona === 'ops-ayong') return 'ayong'
  return null
}

export function resolveTodoBoard(): TodoBoard | null {
  return personaToBoard(resolvePersona())
}
