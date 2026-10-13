import { useMemo, useState, type FormEvent } from 'react'
import type { OfficeTask, Worker } from '../types'

interface OfficePanelProps {
  workers: Worker[]
  tasks: OfficeTask[]
  /** When set, lock to this worker (現場查看)；hide add */
  lockedWorkerId?: string
  canAdd?: boolean
  onAdd: (title: string, assigneeId: string) => void
  onToggle: (id: string) => void
  selectedId?: string
  onSelectWorker?: (id: string) => void
}

const WORKER_ORDER = ['ops-ende', 'ops-ayong']

function OfficeRow({
  task,
  onToggle,
}: {
  task: OfficeTask
  onToggle: (id: string) => void
}) {
  return (
    <li className={`office-row ${task.completed ? 'is-done' : ''}`}>
      <label className="office-check">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
        />
        <span className="sr-only">完成</span>
      </label>
      <span className="office-title">{task.title}</span>
    </li>
  )
}

export function OfficePanel({
  workers,
  tasks,
  lockedWorkerId,
  canAdd = true,
  onAdd,
  onToggle,
  selectedId,
  onSelectWorker,
}: OfficePanelProps) {
  const tabWorkers = useMemo(() => {
    const byId = new Map(workers.map((w) => [w.id, w]))
    return WORKER_ORDER.map((id) => byId.get(id)).filter(Boolean) as Worker[]
  }, [workers])

  const defaultId = lockedWorkerId || tabWorkers[0]?.id || ''
  const [focusWorkerId, setFocusWorkerId] = useState(defaultId)
  const [title, setTitle] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const focusWorkerIdSafe = lockedWorkerId
    ? lockedWorkerId
    : tabWorkers.some((w) => w.id === (selectedId ?? focusWorkerId))
      ? (selectedId ?? focusWorkerId)
      : defaultId

  const setWorker = (id: string) => {
    if (lockedWorkerId) return
    setFocusWorkerId(id)
    onSelectWorker?.(id)
  }

  const mine = tasks.filter((t) => t.assigneeId === focusWorkerIdSafe)
  const open = useMemo(
    () =>
      [...mine]
        .filter((t) => !t.completed)
        .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [mine],
  )
  const done = useMemo(
    () =>
      [...mine]
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [mine],
  )

  const focusName =
    workers.find((w) => w.id === focusWorkerIdSafe)?.name ?? ''

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !focusWorkerIdSafe) return
    onAdd(title, focusWorkerIdSafe)
    setTitle('')
    setShowAdd(false)
  }

  return (
    <div className="office-panel">
      <header className="office-head">
        <h2>工務</h2>
        <p className="section-lead">
          恩德／阿勇 —{' '}
          {canAdd ? (
            <>
              <strong>不需密碼</strong>；只能勾完成，不能改文字
            </>
          ) : (
            <>只能勾是否完成</>
          )}
        </p>
      </header>

      {!lockedWorkerId ? (
        <div className="worker-tabs" role="tablist" aria-label="工務對象">
          {tabWorkers.map((w) => {
            const openCount = tasks.filter(
              (t) => t.assigneeId === w.id && !t.completed,
            ).length
            return (
              <button
                key={w.id}
                type="button"
                role="tab"
                aria-selected={w.id === focusWorkerIdSafe}
                className={`worker-tab ${w.id === focusWorkerIdSafe ? 'is-active' : ''}`}
                onClick={() => setWorker(w.id)}
              >
                <span className="worker-tab-name">{w.name}</span>
                {openCount > 0 ? (
                  <span className="worker-tab-count">{openCount}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="simple-status">
          <strong>{focusName}</strong>　的工務
        </p>
      )}

      {canAdd ? (
        showAdd ? (
          <form className="assign-form office-add" onSubmit={handleSubmit}>
            <label className="field">
              <span>新增給 {focusName}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：整理收據、對帳…"
                autoFocus
              />
            </label>
            <div className="office-add-actions">
              <button type="submit" className="btn-primary">
                新增
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowAdd(false)
                  setTitle('')
                }}
              >
                取消
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-primary btn-xl"
            onClick={() => setShowAdd(true)}
          >
            ＋ 新增工務給 {focusName}
          </button>
        )
      ) : null}

      <section className="office-section" aria-labelledby="ops-open">
        <h3 id="ops-open">進行中</h3>
        {open.length === 0 ? (
          <p className="empty-list">尚無工務</p>
        ) : (
          <ul className="office-list">
            {open.map((t) => (
              <OfficeRow key={t.id} task={t} onToggle={onToggle} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section
          className="office-section done-section"
          aria-labelledby="ops-done"
        >
          <h3 id="ops-done">已完成</h3>
          <p className="section-lead tiny">超過 10 天自動清除</p>
          <ul className="office-list">
            {done.map((t) => (
              <OfficeRow key={t.id} task={t} onToggle={onToggle} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
