import { STORAGE_KEY } from '../data'
import { PROFILE_KEY } from '../profile'
import type { AppState } from '../types'

/** 僅 ?demo=1 才用假資料／略過雲端；預設與正式站一樣走 MantleDB */
export function isDemoHost(): boolean {
  if (typeof window === 'undefined') return false
  const demo = new URLSearchParams(window.location.search).get('demo')
  return demo === '1' || demo === 'true'
}

export function buildDemoState(): AppState {
  const now = Date.now()
  return {
    workers: [
      { id: 'ops-ende', name: '恩德' },
      { id: 'ops-ayong', name: '阿勇' },
    ],
    tasks: [
      {
        id: 'demo-p1',
        title: '【751】補土',
        assigneeId: 'ops-ende',
        category: 'priority',
        urgency: 'urgent',
        order: 0,
        completed: false,
        createdAt: now,
        assigner: '羊',
        detail: '客廳窗邊先補，乾了再磨。',
      },
      {
        id: 'demo-p2',
        title: '【786】帶 PP 板',
        assigneeId: 'ops-ende',
        category: 'priority',
        urgency: 'normal',
        order: 1,
        completed: false,
        createdAt: now - 1,
        assigner: '羊',
      },
      {
        id: 'demo-d1',
        title: '本週交現場照片',
        assigneeId: 'ops-ende',
        category: 'deadline',
        urgency: 'normal',
        dueDate: '2026-10-20',
        order: 0,
        completed: false,
        createdAt: now - 2,
        assigner: '羊',
      },
      {
        id: 'demo-d2',
        title: '逾期：補交測量紀錄',
        assigneeId: 'ops-ende',
        category: 'deadline',
        urgency: 'normal',
        dueDate: '2026-10-01',
        order: 1,
        completed: false,
        createdAt: now - 3,
        assigner: '羊',
      },
      {
        id: 'demo-t1',
        title: '拍照：收邊條放置位置',
        assigneeId: 'ops-ende',
        category: 'todo',
        urgency: 'normal',
        order: 0,
        completed: false,
        createdAt: now - 4,
      },
      {
        id: 'demo-t2',
        title: '整理工具車（不急）',
        assigneeId: 'ops-ende',
        category: 'todo',
        urgency: 'low',
        order: 1,
        completed: false,
        createdAt: now - 5,
      },
      {
        id: 'demo-ay1',
        title: '取修邊刀一支',
        assigneeId: 'ops-ayong',
        category: 'priority',
        urgency: 'urgent',
        order: 0,
        completed: false,
        createdAt: now - 6,
        assigner: '羊',
      },
      {
        id: 'demo-ay2',
        title: '清運紙箱',
        assigneeId: 'ops-ayong',
        category: 'todo',
        urgency: 'normal',
        order: 0,
        completed: false,
        createdAt: now - 7,
      },
    ],
    officeTasks: [],
    assigners: ['羊', '豪哥'],
    deletedIds: [],
    updatedAt: now,
  }
}

/** 在 React 掛載前寫入 demo 資料；回傳是否為 demo 模式 */
export function bootstrapDemoIfNeeded(): boolean {
  if (!isDemoHost()) return false
  const state = buildDemoState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      displayName: '羊',
      role: 'assistant',
      fieldPin: '2468',
      linkedAt: Date.now(),
    }),
  )
  return true
}
