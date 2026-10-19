import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { buildAssignerOptions } from '../assigners'
import type { Task, TaskCategory, Urgency, Worker } from '../types'
import { activeWorkers, workerDisplayName } from '../workers'
import { AssignerSelect } from './AssignerSelect'
import { AssistantBoard } from './AssistantBoard'
import { WorkerCreatedBanner, WorkerUrlsPanel } from './WorkerUrlsPanel'
import { WorkerManagePanel } from './WorkerManagePanel'

interface AssistantPanelProps {
  workers: Worker[]
  tasks: Task[]
  assigners: string[]
  /** 由右上 ⋯ 選單控制；主畫面不放入口按鈕 */
  showManage: boolean
  showUrls: boolean
  onShowManageChange: (open: boolean) => void
  onShowUrlsChange: (open: boolean) => void
  onAdd: (
    title: string,
    assigneeId: string,
    category: TaskCategory,
    detail?: string,
    urgency?: Urgency,
    dueDate?: string,
    assigner?: string,
    caseNo?: string,
  ) => void
  onAddWorker: (name: string) => Worker | null
  onUpdateWorker: (id: string, name: string) => Worker | null
  onRemoveWorker: (id: string) => boolean
  onToggle: (id: string) => void
  onReorder: (assigneeId: string, category: TaskCategory, ids: string[]) => void
  onMoveCategory: (taskId: string, category: TaskCategory) => void
  onUpdateTitle: (id: string, title: string) => void
  onUpdateCaseNo: (id: string, caseNo: string) => void
  onUpdateDetail: (id: string, detail: string) => void
  onUpdateAssigner: (id: string, assigner: string) => void
  onAddAssigner: (name: string) => string | null
  onUpdateDueDate: (id: string, dueDate: string) => void
  onUpdateUrgency: (id: string, urgency: Urgency) => void
  onTrash: (id: string) => void
  onRestore: (id: string) => void
  onTogglePin: (id: string) => void
}

export function AssistantPanel({
  workers,
  tasks,
  assigners,
  showManage,
  showUrls,
  onShowManageChange,
  onShowUrlsChange,
  onAdd,
  onAddWorker,
  onUpdateWorker,
  onRemoveWorker,
  onToggle,
  onReorder,
  onMoveCategory,
  onUpdateTitle,
  onUpdateCaseNo,
  onUpdateDetail,
  onUpdateAssigner,
  onAddAssigner,
  onUpdateDueDate,
  onUpdateUrgency,
  onTrash,
  onRestore,
  onTogglePin,
}: AssistantPanelProps) {
  /** 工務 pill：依最近派任時間（任務 createdAt）由新到舊；從未派過的排後面 */
  const tabWorkers = useMemo(() => {
    const active = activeWorkers(workers)
    const lastAssignedAt = new Map<string, number>()
    for (const t of tasks) {
      if (t.trashedAt) continue
      const ts = typeof t.createdAt === 'number' ? t.createdAt : 0
      if (!ts) continue
      const prev = lastAssignedAt.get(t.assigneeId) ?? 0
      if (ts > prev) lastAssignedAt.set(t.assigneeId, ts)
    }
    return [...active].sort((a, b) => {
      const ta = lastAssignedAt.get(a.id) ?? 0
      const tb = lastAssignedAt.get(b.id) ?? 0
      if (tb !== ta) return tb - ta
      return a.name.localeCompare(b.name, 'zh-Hant')
    })
  }, [workers, tasks])

  const defaultId = tabWorkers[0]?.id ?? ''
  const [focusWorkerId, setFocusWorkerId] = useState(defaultId)
  const [caseNo, setCaseNo] = useState('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [assigner, setAssigner] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState<TaskCategory>('priority')
  const [showAdd, setShowAdd] = useState(false)
  const [createdWorker, setCreatedWorker] = useState<Worker | null>(null)

  const assignerOptions = useMemo(
    () =>
      buildAssignerOptions([
        ...assigners,
        ...tasks.map((t) => t.assigner),
      ]),
    [assigners, tasks],
  )

  const focusWorkerIdSafe = tabWorkers.some((w) => w.id === focusWorkerId)
    ? focusWorkerId
    : defaultId

  // 刷新／同步後內容變長時，瀏覽器常停在頁底（已完成半張卡＋空白）；強制回頂看優先
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [focusWorkerIdSafe])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onLoad = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    // 雲端 hydrate 後再頂一次（內容高度剛撐開）
    const t1 = window.setTimeout(onLoad, 0)
    const t2 = window.setTimeout(onLoad, 600)
    const t3 = window.setTimeout(onLoad, 1800)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(
      title,
      focusWorkerIdSafe,
      category,
      detail,
      undefined,
      category === 'priority' && dueDate ? dueDate : undefined,
      assigner,
      caseNo,
    )
    setCaseNo('')
    setTitle('')
    setDetail('')
    setAssigner('')
    setDueDate('')
    setShowAdd(false)
  }

  const nameOf = (id: string) => workerDisplayName(workers, id)

  const focused = tasks.filter((t) => t.assigneeId === focusWorkerIdSafe)
  const openFocused = focused.filter((t) => !t.completed && !t.trashedAt)
  const openCount = openFocused.length
  const openPriority = openFocused.filter((t) => t.category === 'priority').length
  const openReminder = openFocused.filter((t) => t.category === 'reminder').length
  const openTodo = openFocused.filter(
    (t) => t.category !== 'priority' && t.category !== 'reminder',
  ).length
  const focusName = nameOf(focusWorkerIdSafe)
  const openBreakdown =
    openCount > 0
      ? [
          openPriority ? `優先 ${openPriority}` : '',
          openTodo ? `待處理 ${openTodo}` : '',
          openReminder ? `提醒 ${openReminder}` : '',
        ]
          .filter(Boolean)
          .join('・')
      : ''

  return (
    <div className="simple-dispatch">
      {createdWorker ? (
        <WorkerCreatedBanner
          worker={createdWorker}
          onClose={() => setCreatedWorker(null)}
        />
      ) : null}

      {showManage ? (
        <div className="worker-tool-panel">
          <div className="worker-tool-panel-bar">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onShowManageChange(false)}
            >
              收起名單
            </button>
          </div>
          <WorkerManagePanel
            workers={workers}
            onAdd={onAddWorker}
            onUpdate={onUpdateWorker}
            onRemove={(id) => {
              const ok = onRemoveWorker(id)
              if (ok && focusWorkerId === id) {
                setFocusWorkerId(defaultId)
              }
              return ok
            }}
            onCreated={(w) => {
              setCreatedWorker(w)
              onShowUrlsChange(true)
              onShowManageChange(true)
            }}
            onFocusWorker={setFocusWorkerId}
          />
        </div>
      ) : null}

      {showUrls ? (
        <div className="worker-tool-panel">
          <div className="worker-tool-panel-bar">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onShowUrlsChange(false)}
            >
              收起網址
            </button>
          </div>
          <WorkerUrlsPanel workers={tabWorkers} />
        </div>
      ) : null}

      <div className="worker-tabs" role="tablist" aria-label="工務">
        {tabWorkers.map((w) => {
          const open = tasks.filter(
            (t) => t.assigneeId === w.id && !t.completed && !t.trashedAt,
          ).length
          return (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={w.id === focusWorkerIdSafe}
              className={`worker-tab ${w.id === focusWorkerIdSafe ? 'is-active' : ''}`}
              onClick={() => setFocusWorkerId(w.id)}
            >
              <span className="worker-tab-name">{w.name}</span>
              {open > 0 ? <span className="worker-tab-count">{open}</span> : null}
            </button>
          )
        })}
      </div>

      <p className="simple-status">
        <strong>{focusName}</strong>
        {openCount > 0
          ? `　還有 ${openCount} 件${openBreakdown ? `（${openBreakdown}）` : ''}`
          : '　已全部勾完'}
      </p>

      <AssistantBoard
        tasks={focused}
        focusName={focusName}
        getAssigneeName={nameOf}
        onToggle={onToggle}
        onReorder={(cat, ids) => onReorder(focusWorkerIdSafe, cat, ids)}
        onMoveCategory={onMoveCategory}
        onUpdateTitle={onUpdateTitle}
        onUpdateCaseNo={onUpdateCaseNo}
        onUpdateDetail={onUpdateDetail}
        onUpdateAssigner={onUpdateAssigner}
        onAddAssigner={onAddAssigner}
        onUpdateDueDate={onUpdateDueDate}
        onUpdateUrgency={onUpdateUrgency}
        onTrash={onTrash}
        onRestore={onRestore}
        onTogglePin={onTogglePin}
        assignerOptions={assignerOptions}
        simple
      />

      <div className="simple-add-bar">
        {showAdd ? (
          <form className="simple-add-form" onSubmit={handleSubmit}>
            <label className="detail-field">
              <input
                value={caseNo}
                onChange={(e) => setCaseNo(e.target.value)}
                placeholder="751（可空）"
                aria-label="案號"
                autoComplete="off"
                inputMode="numeric"
              />
            </label>
            <label className="detail-field">
              <span className="detail-field-label">標題</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`給${focusName}加一件…`}
                autoFocus
                autoComplete="off"
                required
              />
            </label>
            <label className="detail-field">
              <span className="detail-field-label">誰派的</span>
              <AssignerSelect
                value={assigner}
                options={assignerOptions}
                onChange={setAssigner}
                onAddAssigner={onAddAssigner}
                emptyLabel="未指定"
                selectClassName="assigner-select"
              />
            </label>
            <label className="detail-field">
              <span className="detail-field-label">派工說明</span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="地點、材料、注意事項…"
                rows={5}
              />
            </label>
            <div className="cat-toggle cat-toggle-3" role="group" aria-label="分類">
              <button
                type="button"
                className={category === 'priority' ? 'is-active' : ''}
                onClick={() => setCategory('priority')}
              >
                優先
              </button>
              <button
                type="button"
                className={category === 'reminder' ? 'is-active' : ''}
                onClick={() => {
                  setCategory('reminder')
                  setDueDate('')
                }}
              >
                提醒
              </button>
              <button
                type="button"
                className={category === 'todo' ? 'is-active' : ''}
                onClick={() => {
                  setCategory('todo')
                  setDueDate('')
                }}
              >
                待處理
              </button>
            </div>
            {category === 'priority' ? (
              <label className="detail-field">
                <span className="detail-field-label">限期（可選）</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            ) : null}
            <div className="simple-add-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowAdd(false)
                  setCaseNo('')
                  setDetail('')
                  setAssigner('')
                  setDueDate('')
                }}
              >
                取消
              </button>
              <button type="submit" className="btn-primary">
                加入
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-primary btn-xl"
            onClick={() => setShowAdd(true)}
            disabled={!focusWorkerIdSafe}
          >
            ＋ 給{focusName}加工作
          </button>
        )}
      </div>
    </div>
  )
}
