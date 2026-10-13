import { useMemo, useState, type FormEvent } from 'react'
import { buildAssignerOptions } from '../assigners'
import type { Task, TaskCategory, Urgency, Worker } from '../types'
import { AssignerSelect } from './AssignerSelect'
import { AssistantBoard } from './AssistantBoard'
import { OrganizePanel } from './OrganizePanel'

interface AssistantPanelProps {
  workers: Worker[]
  tasks: Task[]
  assigners: string[]
  onAdd: (
    title: string,
    assigneeId: string,
    category: TaskCategory,
    detail?: string,
    urgency?: Urgency,
    dueDate?: string,
    assigner?: string,
  ) => void
  onToggle: (id: string) => void
  onReorder: (assigneeId: string, category: TaskCategory, ids: string[]) => void
  onMoveCategory: (taskId: string, category: TaskCategory) => void
  onUpdateTitle: (id: string, title: string) => void
  onUpdateDetail: (id: string, detail: string) => void
  onUpdateAssigner: (id: string, assigner: string) => void
  onAddAssigner: (name: string) => string | null
  onUpdateDueDate: (id: string, dueDate: string) => void
  onUpdateUrgency: (id: string, urgency: Urgency) => void
}

/** 工務僅恩德、阿勇 */
const WORKER_ORDER = ['ops-ende', 'ops-ayong']

export function AssistantPanel({
  workers,
  tasks,
  assigners,
  onAdd,
  onToggle,
  onReorder,
  onMoveCategory,
  onUpdateTitle,
  onUpdateDetail,
  onUpdateAssigner,
  onAddAssigner,
  onUpdateDueDate,
  onUpdateUrgency,
}: AssistantPanelProps) {
  const tabWorkers = useMemo(() => {
    const byId = new Map(workers.map((w) => [w.id, w]))
    return WORKER_ORDER.map((id) => byId.get(id)).filter(Boolean) as Worker[]
  }, [workers])

  const defaultId = tabWorkers[0]?.id ?? ''
  const [focusWorkerId, setFocusWorkerId] = useState(defaultId)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [assigner, setAssigner] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState<TaskCategory>('priority')
  const [showAdd, setShowAdd] = useState(false)

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (category === 'deadline' && !dueDate) return
    onAdd(
      title,
      focusWorkerIdSafe,
      category,
      detail,
      undefined,
      category === 'deadline' ? dueDate : undefined,
      assigner,
    )
    setTitle('')
    setDetail('')
    setAssigner('')
    setDueDate('')
    setShowAdd(false)
  }

  const nameOf = (id: string) =>
    workers.find((w) => w.id === id)?.name ?? '未知'

  const focused = tasks.filter((t) => t.assigneeId === focusWorkerIdSafe)
  const openCount = focused.filter((t) => !t.completed).length
  const focusName = nameOf(focusWorkerIdSafe)

  return (
    <div className="simple-dispatch">
      <div className="worker-tabs" role="tablist" aria-label="工務">
        {tabWorkers.map((w) => {
          const open = tasks.filter(
            (t) => t.assigneeId === w.id && !t.completed,
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
        {openCount > 0 ? `　還有 ${openCount} 件` : '　已全部勾完'}
      </p>

      <OrganizePanel />

      <AssistantBoard
        tasks={focused}
        focusName={focusName}
        getAssigneeName={nameOf}
        onToggle={onToggle}
        onReorder={(cat, ids) => onReorder(focusWorkerIdSafe, cat, ids)}
        onMoveCategory={onMoveCategory}
        onUpdateTitle={onUpdateTitle}
        onUpdateDetail={onUpdateDetail}
        onUpdateAssigner={onUpdateAssigner}
        onAddAssigner={onAddAssigner}
        onUpdateDueDate={onUpdateDueDate}
        onUpdateUrgency={onUpdateUrgency}
        assignerOptions={assignerOptions}
        simple
      />

      <div className="simple-add-bar">
        {showAdd ? (
          <form className="simple-add-form" onSubmit={handleSubmit}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`給${focusName}加一件…`}
              autoFocus
              autoComplete="off"
            />
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
              <span className="detail-field-label">詳細說明</span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="把上方 AI 整理結果貼進來（地點、材料、注意事項…）"
                rows={5}
              />
              <span className="detail-ai-hint">先用上方「AI 整理」再複製貼上</span>
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
                className={category === 'deadline' ? 'is-active' : ''}
                onClick={() => setCategory('deadline')}
              >
                限期
              </button>
              <button
                type="button"
                className={category === 'todo' ? 'is-active' : ''}
                onClick={() => setCategory('todo')}
              >
                待處理
              </button>
            </div>
            {category === 'deadline' ? (
              <label className="detail-field">
                <span className="detail-field-label">完成期限</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </label>
            ) : null}
            <div className="simple-add-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowAdd(false)
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
          >
            ＋ 給{focusName}加工作
          </button>
        )}
      </div>
    </div>
  )
}
