import { useMemo, useState, type FormEvent } from 'react'
import { buildAssignerOptions } from '../assigners'
import type { Task, TaskCategory, Urgency, Worker } from '../types'
import { AssignerSelect } from './AssignerSelect'
import { AssistantBoard } from './AssistantBoard'
import { WorkerCreatedBanner, WorkerUrlsPanel } from './WorkerUrlsPanel'

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
    caseNo?: string,
  ) => void
  onAddWorker: (name: string) => Worker | null
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
  onAdd,
  onAddWorker,
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
  const tabWorkers = workers

  const defaultId = tabWorkers[0]?.id ?? ''
  const [focusWorkerId, setFocusWorkerId] = useState(defaultId)
  const [caseNo, setCaseNo] = useState('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [assigner, setAssigner] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState<TaskCategory>('priority')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddWorker, setShowAddWorker] = useState(false)
  const [newWorkerName, setNewWorkerName] = useState('')
  const [createdWorker, setCreatedWorker] = useState<Worker | null>(null)
  const [showUrls, setShowUrls] = useState(false)

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

  const handleAddWorker = (e: FormEvent) => {
    e.preventDefault()
    const w = onAddWorker(newWorkerName)
    if (!w) return
    setNewWorkerName('')
    setShowAddWorker(false)
    setFocusWorkerId(w.id)
    setCreatedWorker(w)
    setShowUrls(true)
  }

  const nameOf = (id: string) =>
    workers.find((w) => w.id === id)?.name ?? '未知'

  const focused = tasks.filter((t) => t.assigneeId === focusWorkerIdSafe)
  const openCount = focused.filter((t) => !t.completed && !t.trashedAt).length
  const focusName = nameOf(focusWorkerIdSafe)

  return (
    <div className="simple-dispatch">
      {createdWorker ? (
        <WorkerCreatedBanner
          worker={createdWorker}
          onClose={() => setCreatedWorker(null)}
        />
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
        <button
          type="button"
          className="worker-tab worker-tab-add"
          onClick={() => {
            setShowAddWorker(true)
            setCreatedWorker(null)
          }}
        >
          ＋ 新增工務
        </button>
      </div>

      {showAddWorker ? (
        <form className="simple-add-form worker-add-form" onSubmit={handleAddWorker}>
          <label className="detail-field">
            <span className="detail-field-label">工務名字</span>
            <input
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              placeholder="例：小明"
              autoFocus
              autoComplete="off"
              required
              maxLength={24}
            />
          </label>
          <div className="simple-add-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setShowAddWorker(false)
                setNewWorkerName('')
              }}
            >
              取消
            </button>
            <button type="submit" className="btn-primary">
              新增
            </button>
          </div>
        </form>
      ) : null}

      <p className="simple-status">
        <strong>{focusName}</strong>
        {openCount > 0 ? `　還有 ${openCount} 件` : '　已全部勾完'}
        <button
          type="button"
          className="linkish-btn"
          onClick={() => setShowUrls((v) => !v)}
        >
          {showUrls ? '收起網址' : '查詢／複製工務網址'}
        </button>
      </p>

      {showUrls ? <WorkerUrlsPanel workers={tabWorkers} /> : null}

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
          >
            ＋ 給{focusName}加工作
          </button>
        )}
      </div>
    </div>
  )
}
