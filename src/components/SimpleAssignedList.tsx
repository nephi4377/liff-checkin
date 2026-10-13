import { useMemo, useState, type ReactNode } from 'react'
import { compareDeadlineTasks, formatDueDateLabel, isOverdue } from '../dueDate'
import type { Task, TaskCategory } from '../types'
import { sortPriorityTasks, urgencyLabel } from '../urgency'

interface SimpleAssignedListProps {
  workerName: string
  tasks: Task[]
  onToggle: (id: string) => void
  onUpdateDetail: (id: string, detail: string) => void
}

const CATEGORY_META: {
  id: TaskCategory
  title: string
  empty: string
}[] = [
  { id: 'priority', title: '優先', empty: '沒有優先' },
  { id: 'deadline', title: '限期件', empty: '沒有限期件' },
  { id: 'todo', title: '待處理', empty: '沒有待處理' },
]

function sortOpenInCategory(category: TaskCategory, tasks: Task[]): Task[] {
  const list = tasks.filter((t) => !t.completed && t.category === category)
  if (category === 'priority') return sortPriorityTasks(list)
  if (category === 'deadline') return [...list].sort(compareDeadlineTasks)
  return [...list].sort((a, b) => {
    const aLow = a.urgency === 'low' ? 1 : 0
    const bLow = b.urgency === 'low' ? 1 : 0
    if (aLow !== bLow) return aLow - bLow
    return a.order - b.order
  })
}

function TaskMeta({ task }: { task: Task }) {
  const overdue = isOverdue(task.dueDate, task.completed)
  if (task.category === 'deadline' && task.dueDate) {
    return (
      <span
        className={`cat-chip ${overdue ? 'cat-chip-overdue' : 'cat-chip-due'}`}
      >
        {overdue ? '已逾期' : formatDueDateLabel(task.dueDate)}
      </span>
    )
  }
  if (task.category === 'priority') {
    return (
      <span className={`cat-chip cat-chip-urgency-${task.urgency}`}>
        {urgencyLabel(task.urgency)}
      </span>
    )
  }
  if (task.urgency === 'low') {
    return <span className="cat-chip cat-chip-urgency-low">不急</span>
  }
  return null
}

function WorkerNote({
  task,
  onUpdateDetail,
}: {
  task: Task
  onUpdateDetail: (id: string, detail: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.detail ?? '')

  const openEdit = () => {
    setDraft(task.detail ?? '')
    setEditing(true)
  }

  const commit = () => {
    onUpdateDetail(task.id, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="worker-note is-editing">
        <textarea
          className="worker-note-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="進度、材料、注意事項…"
          autoFocus
          aria-label="任務說明"
        />
        <div className="worker-note-actions">
          <button
            type="button"
            className="btn-ghost worker-note-cancel"
            onClick={() => {
              setDraft(task.detail ?? '')
              setEditing(false)
            }}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary worker-note-save"
            onClick={commit}
          >
            儲存說明
          </button>
        </div>
      </div>
    )
  }

  if (task.detail?.trim()) {
    return (
      <button
        type="button"
        className="worker-note has-text"
        onClick={openEdit}
        aria-label="編輯說明"
      >
        <span className="worker-note-label">說明</span>
        <span className="worker-note-body">{task.detail}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className="worker-note is-empty"
      onClick={openEdit}
      aria-label="新增說明"
    >
      ＋ 新增說明
    </button>
  )
}

function AssignedRow({
  task,
  checked,
  onToggle,
  onUpdateDetail,
}: {
  task: Task
  checked: boolean
  onToggle: (id: string) => void
  onUpdateDetail: (id: string, detail: string) => void
}) {
  const overdue = isOverdue(task.dueDate, task.completed)
  const tone =
    task.category === 'priority'
      ? `urgency-tone-${task.urgency}`
      : task.category === 'todo' && task.urgency === 'low'
        ? 'urgency-tone-low'
        : overdue
          ? 'is-overdue-row'
          : ''

  return (
    <li
      className={`office-row worker-row ${tone}${checked ? ' is-done' : ''}`}
    >
      <label className="office-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(task.id)}
        />
        <span className="sr-only">完成</span>
      </label>
      <div className="office-body">
        {!checked ? <TaskMeta task={task} /> : null}
        <span className="office-title">{task.title}</span>
        {task.assigner ? (
          <p className="task-assigner">派自 {task.assigner}</p>
        ) : null}
        <WorkerNote task={task} onUpdateDetail={onUpdateDetail} />
      </div>
    </li>
  )
}

function CategoryBlock({
  category,
  title,
  empty,
  tasks,
  onToggle,
  onUpdateDetail,
}: {
  category: TaskCategory
  title: string
  empty: string
  tasks: Task[]
  onToggle: (id: string) => void
  onUpdateDetail: (id: string, detail: string) => void
}): ReactNode {
  return (
    <section
      className={`worker-cat worker-cat-${category}`}
      aria-labelledby={`worker-cat-${category}`}
    >
      <header className="worker-cat-head">
        <h3 id={`worker-cat-${category}`}>{title}</h3>
        <span className="worker-cat-count" aria-label={`${tasks.length} 件`}>
          {tasks.length}
        </span>
      </header>
      {tasks.length === 0 ? (
        <p className="worker-cat-empty">{empty}</p>
      ) : (
        <ul className="office-list">
          {tasks.map((t) => (
            <AssignedRow
              key={t.id}
              task={t}
              checked={false}
              onToggle={onToggle}
              onUpdateDetail={onUpdateDetail}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** 工務：四大區塊＋每任務下方說明區（可編輯、同步） */
export function SimpleAssignedList({
  workerName,
  tasks,
  onToggle,
  onUpdateDetail,
}: SimpleAssignedListProps) {
  const byCategory = useMemo(() => {
    const map = {
      priority: sortOpenInCategory('priority', tasks),
      deadline: sortOpenInCategory('deadline', tasks),
      todo: sortOpenInCategory('todo', tasks),
    }
    return map
  }, [tasks])

  const openCount =
    byCategory.priority.length +
    byCategory.deadline.length +
    byCategory.todo.length

  const done = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [tasks],
  )

  return (
    <div className="office-panel simple-assigned">
      <header className="office-head">
        <h2>{workerName}的任務</h2>
        <p className="section-lead">
          {openCount > 0
            ? `進行中 ${openCount} 件 · 勾一下就完成`
            : '今天清單清空了'}
        </p>
      </header>

      <div className="worker-cat-stack" aria-label={`${workerName}的分類任務`}>
        {CATEGORY_META.map((c) => (
          <CategoryBlock
            key={c.id}
            category={c.id}
            title={c.title}
            empty={c.empty}
            tasks={byCategory[c.id]}
            onToggle={onToggle}
            onUpdateDetail={onUpdateDetail}
          />
        ))}
      </div>

      <section
        className="worker-cat worker-cat-done"
        aria-labelledby="assigned-done"
      >
        <header className="worker-cat-head">
          <h3 id="assigned-done">已完成</h3>
          <span className="worker-cat-count">{done.length}</span>
        </header>
        <p className="done-hint">取消勾選可復原 · 超過 10 天自動清除</p>
        {done.length === 0 ? (
          <p className="worker-cat-empty">沒有已完成</p>
        ) : (
          <ul className="office-list">
            {done.map((t) => (
              <AssignedRow
                key={t.id}
                task={t}
                checked
                onToggle={onToggle}
                onUpdateDetail={onUpdateDetail}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
