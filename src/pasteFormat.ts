import { normalizeDueDate } from './dueDate'
import type { TaskCategory, Urgency } from './types'

/** 貼上格式（給 Cursor AI／羊複製用）— 僅派工頁 */
export const PASTE_TEMPLATE = `恩德｜優先｜緊急｜【751】補土｜現場要帶刮刀
阿勇｜待處理｜一般｜拍照收邊條位置
恩德｜限期｜2026-12-31｜交驗收資料｜含照片`

export const PASTE_FORMAT_HINT =
  '優先／待處理：人名｜分類｜緊急｜標題｜詳細（可省）。限期：人名｜限期｜YYYY-MM-DD｜標題｜詳細（可省）'

export interface ParsedPasteLine {
  lineNo: number
  raw: string
  ok: boolean
  error?: string
  workerName?: '恩德' | '阿勇'
  assigneeId?: 'ops-ende' | 'ops-ayong'
  category?: TaskCategory
  urgency?: Urgency
  dueDate?: string
  title?: string
  detail?: string
}

function mapWorker(token: string): {
  workerName: '恩德' | '阿勇'
  assigneeId: 'ops-ende' | 'ops-ayong'
} | null {
  const t = token.trim()
  if (t === '恩德' || t === '@恩德') return { workerName: '恩德', assigneeId: 'ops-ende' }
  if (t === '阿勇' || t === '@阿勇') return { workerName: '阿勇', assigneeId: 'ops-ayong' }
  return null
}

function mapCategory(token: string): TaskCategory | null {
  const t = token.trim()
  if (t === '優先' || t === '【優先】') return 'priority'
  if (t === '待處理' || t === '代辦' || t === '【待處理】') return 'todo'
  if (t === '限期' || t === '限期完成' || t === '【限期】') return 'deadline'
  return null
}

function mapUrgency(token: string, category: TaskCategory): Urgency | null {
  const t = token.trim()
  if (t === '緊急') return 'urgent'
  if (t === '普通' || t === '一般') return 'normal'
  if (t === '不急') return 'low'
  if (category === 'deadline') return 'normal'
  return null
}

/** 解析「整理後貼上」文字（以 ｜ 或 | 分隔） */
export function parsePasteText(text: string): ParsedPasteLine[] {
  const lines = text.split(/\r?\n/)
  const out: ParsedPasteLine[] = []

  lines.forEach((raw, i) => {
    const lineNo = i + 1
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const parts = trimmed.split(/｜|\|/).map((p) => p.trim())
    if (parts.length < 4) {
      out.push({
        lineNo,
        raw,
        ok: false,
        error: '欄位不足',
      })
      return
    }

    const worker = mapWorker(parts[0] ?? '')
    const category = mapCategory(parts[1] ?? '')
    if (!worker) {
      out.push({ lineNo, raw, ok: false, error: '人名須為「恩德」或「阿勇」' })
      return
    }
    if (!category) {
      out.push({
        lineNo,
        raw,
        ok: false,
        error: '分類須為「優先」「待處理」或「限期」',
      })
      return
    }

    if (category === 'deadline') {
      const dueDate = normalizeDueDate(parts[2])
      if (!dueDate) {
        out.push({
          lineNo,
          raw,
          ok: false,
          error: '限期須為日期 YYYY-MM-DD',
        })
        return
      }
      const title = (parts[3] ?? '').trim()
      if (!title) {
        out.push({ lineNo, raw, ok: false, error: '缺少標題' })
        return
      }
      const detail = parts.slice(4).join('｜').trim() || undefined
      out.push({
        lineNo,
        raw,
        ok: true,
        workerName: worker.workerName,
        assigneeId: worker.assigneeId,
        category,
        urgency: 'normal',
        dueDate,
        title,
        detail,
      })
      return
    }

    let urgency = mapUrgency(parts[2] ?? '', category)
    if (!urgency) {
      out.push({
        lineNo,
        raw,
        ok: false,
        error: '緊急須為「緊急」「普通／一般」或「不急」',
      })
      return
    }
    if (category === 'todo' && urgency === 'urgent') urgency = 'normal'

    const title = (parts[3] ?? '').trim()
    if (!title) {
      out.push({ lineNo, raw, ok: false, error: '缺少標題' })
      return
    }
    const detail = parts.slice(4).join('｜').trim() || undefined

    out.push({
      lineNo,
      raw,
      ok: true,
      workerName: worker.workerName,
      assigneeId: worker.assigneeId,
      category,
      urgency,
      title,
      detail,
    })
  })

  return out
}
