import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Urgency } from '../types'
import { URGENCY_OPTIONS, urgencyLabel } from '../urgency'

interface TaskCardProps {
  task: Task
  assigneeName?: string
  showAssignee?: boolean
  onToggle: (id: string) => void
  onDelete?: (id: string) => void
  onUpdateTitle?: (id: string, title: string) => void
  onUpdateDetail?: (id: string, detail: string) => void
  onUpdateUrgency?: (id: string, urgency: Urgency) => void
  dragDisabled?: boolean
  categoryActionLabel?: string
  onCategoryAction?: () => void
  compact?: boolean
}

export function TaskCard({
  task,
  assigneeName,
  showAssignee,
  onToggle,
  onDelete,
  onUpdateTitle,
  onUpdateDetail,
  onUpdateUrgency,
  dragDisabled,
  categoryActionLabel,
  onCategoryAction,
  compact,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: dragDisabled })

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const [editingDetail, setEditingDetail] = useState(false)
  const [detailDraft, setDetailDraft] = useState(task.detail ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(task.title)
  }, [task.title, editing])

  useEffect(() => {
    if (!editingDetail) setDetailDraft(task.detail ?? '')
  }, [task.detail, editingDetail])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = () => {
    const next = draft.trim()
    if (next && next !== task.title) onUpdateTitle?.(task.id, next)
    else setDraft(task.title)
    setEditing(false)
  }

  const commitDetail = () => {
    const next = detailDraft.trim()
    if (next !== (task.detail ?? '').trim()) onUpdateDetail?.(task.id, next)
    setEditingDetail(false)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const titleBlock = editing ? (
    <input
      ref={inputRef}
      className="task-edit-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitEdit()
        }
        if (e.key === 'Escape') {
          setDraft(task.title)
          setEditing(false)
        }
      }}
      aria-label="編輯工作內容"
    />
  ) : onUpdateTitle ? (
    <button
      type="button"
      className="task-title-btn"
      onClick={() => setEditing(true)}
    >
      <span className="task-title">{task.title}</span>
      <span className="edit-hint">編輯</span>
    </button>
  ) : (
    <p className="task-title">{task.title}</p>
  )

  const detailBlock = editingDetail && onUpdateDetail ? (
    <textarea
      className="task-detail-edit"
      value={detailDraft}
      onChange={(e) => setDetailDraft(e.target.value)}
      onBlur={commitDetail}
      rows={3}
      aria-label="詳細說明"
      autoFocus
    />
  ) : onUpdateDetail ? (
    <button
      type="button"
      className="task-detail-btn"
      onClick={() => setEditingDetail(true)}
    >
      {task.detail ? (
        <span className="task-detail">{task.detail}</span>
      ) : (
        <span className="task-detail-empty">＋ 詳細說明</span>
      )}
    </button>
  ) : task.detail ? (
    <p className="task-detail">{task.detail}</p>
  ) : null

  /** 優先：緊急／普通／不急；代辦：僅一般／不急（不急沉底） */
  const isPriority = task.category === 'priority'
  const isTodoLow = !isPriority && task.urgency === 'low'
  const todoLevel: 'normal' | 'low' =
    task.urgency === 'low' ? 'low' : 'normal'

  let urgencyBlock: ReactNode = null
  if (isPriority) {
    urgencyBlock = (
      <div className="urgency-stack">
        <span
          className={`urgency-badge urgency-badge-lg urgency-${task.urgency}`}
          aria-label={`緊急等級：${urgencyLabel(task.urgency)}`}
        >
          {urgencyLabel(task.urgency)}
        </span>
        {onUpdateUrgency ? (
          <div className="urgency-toggle" role="group" aria-label="緊急等級">
            {URGENCY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`urgency-btn urgency-${opt.id} ${task.urgency === opt.id ? 'is-active' : ''}`}
                aria-pressed={task.urgency === opt.id}
                onClick={() => {
                  if (task.urgency !== opt.id) onUpdateUrgency(task.id, opt.id)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  } else if (onUpdateUrgency) {
    urgencyBlock = (
      <div className="urgency-stack">
        {isTodoLow ? (
          <span className="urgency-badge urgency-badge-lg urgency-low">不急</span>
        ) : null}
        <div className="todo-pace-toggle" role="group" aria-label="待處理節奏">
          <button
            type="button"
            className={`todo-pace-btn ${todoLevel === 'normal' ? 'is-active' : ''}`}
            aria-pressed={todoLevel === 'normal'}
            onClick={() => onUpdateUrgency(task.id, 'normal')}
          >
            一般
          </button>
          <button
            type="button"
            className={`todo-pace-btn todo-pace-low ${todoLevel === 'low' ? 'is-active' : ''}`}
            aria-pressed={todoLevel === 'low'}
            onClick={() => onUpdateUrgency(task.id, 'low')}
          >
            不急
          </button>
        </div>
      </div>
    )
  } else if (isTodoLow) {
    urgencyBlock = (
      <span className="urgency-badge urgency-badge-lg urgency-low" aria-label="不急">
        不急
      </span>
    )
  }

  const showCategory =
    Boolean(categoryActionLabel && onCategoryAction && !dragDisabled)
  const showActions = !editing && (showCategory || Boolean(onDelete))
  const toneClass = isPriority
    ? `urgency-tone-${task.urgency}`
    : isTodoLow
      ? 'urgency-tone-low'
      : ''

  if (compact) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className={`task-card task-card-compact ${toneClass} ${task.completed ? 'is-done' : ''} ${isDragging ? 'is-dragging' : ''} ${editing ? 'is-editing' : ''}`}
      >
        <label className="task-check">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(task.id)}
          />
          <span className="check-box" aria-hidden />
        </label>

        <div className="task-body">
          {titleBlock}
          {!editing && !editingDetail ? detailBlock : editingDetail ? detailBlock : null}
          {!editing && !editingDetail ? urgencyBlock : null}
          {showActions && !editingDetail ? (
            <div className="task-actions-row">
              {showCategory ? (
                <button
                  type="button"
                  className="category-move-btn"
                  onClick={onCategoryAction}
                >
                  {categoryActionLabel}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="task-delete-inline"
                  aria-label="刪除"
                  onClick={() => onDelete(task.id)}
                >
                  刪除
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!dragDisabled && !editing ? (
          <button
            type="button"
            className="drag-handle"
            aria-label="長按拖曳排序"
            {...attributes}
            {...listeners}
          >
            <span className="drag-dots" aria-hidden>
              ⋮
            </span>
          </button>
        ) : (
          <span className="drag-spacer" aria-hidden />
        )}
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`task-card ${toneClass} ${task.completed ? 'is-done' : ''} ${isDragging ? 'is-dragging' : ''}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="長按拖曳排序"
        disabled={dragDisabled}
        {...attributes}
        {...listeners}
      >
        <span className="drag-dots" aria-hidden>
          ⋮
        </span>
      </button>

      <label className="task-check">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
        />
        <span className="check-box" aria-hidden />
      </label>

      <div className="task-body">
        {titleBlock}
        {!editing && !editingDetail ? detailBlock : editingDetail ? detailBlock : null}
        {!editing && !editingDetail ? urgencyBlock : null}
        {showAssignee && assigneeName && !editing ? (
          <p className="task-meta">指派給 {assigneeName}</p>
        ) : null}
        {showCategory && !editing ? (
          <button
            type="button"
            className="category-move-btn"
            onClick={onCategoryAction}
          >
            {categoryActionLabel}
          </button>
        ) : null}
      </div>

      {onDelete ? (
        <button
          type="button"
          className="task-delete"
          aria-label="刪除任務"
          onClick={() => onDelete(task.id)}
        >
          ×
        </button>
      ) : null}
    </li>
  )
}
