import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  formatDueDateLabel,
  isOverdue,
} from '../dueDate'
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
  onUpdateAssigner?: (id: string, assigner: string) => void
  onUpdateDueDate?: (id: string, dueDate: string) => void
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
  onUpdateAssigner,
  onUpdateDueDate,
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
  const [editingAssigner, setEditingAssigner] = useState(false)
  const [assignerDraft, setAssignerDraft] = useState(task.assigner ?? '')
  const [urgencyOpen, setUrgencyOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(task.title)
  }, [task.title, editing])

  useEffect(() => {
    if (!editingDetail) setDetailDraft(task.detail ?? '')
  }, [task.detail, editingDetail])

  useEffect(() => {
    if (!editingAssigner) setAssignerDraft(task.assigner ?? '')
  }, [task.assigner, editingAssigner])

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

  const commitAssigner = () => {
    const next = assignerDraft.trim()
    if (next !== (task.assigner ?? '').trim()) onUpdateAssigner?.(task.id, next)
    setEditingAssigner(false)
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
    <div className="detail-field">
      <textarea
        className="task-detail-edit"
        value={detailDraft}
        onChange={(e) => setDetailDraft(e.target.value)}
        onBlur={commitDetail}
        rows={5}
        aria-label="詳細說明"
        placeholder="可貼上上方 AI 整理後的說明"
        autoFocus
      />
      <span className="detail-ai-hint">用派工頁「AI 整理」後複製貼上</span>
    </div>
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

  const assignerBlock = editingAssigner && onUpdateAssigner ? (
    <input
      className="task-assigner-edit"
      value={assignerDraft}
      onChange={(e) => setAssignerDraft(e.target.value)}
      onBlur={commitAssigner}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitAssigner()
        }
        if (e.key === 'Escape') {
          setAssignerDraft(task.assigner ?? '')
          setEditingAssigner(false)
        }
      }}
      aria-label="誰派的"
      placeholder="誰派的"
      autoFocus
    />
  ) : onUpdateAssigner ? (
    <button
      type="button"
      className="task-assigner-btn"
      onClick={() => setEditingAssigner(true)}
    >
      {task.assigner ? (
        <span className="task-assigner">派自 {task.assigner}</span>
      ) : (
        <span className="task-detail-empty">＋ 誰派的</span>
      )}
    </button>
  ) : task.assigner ? (
    <p className="task-assigner">派自 {task.assigner}</p>
  ) : null

  const overdue = isOverdue(task.dueDate, task.completed)
  const dueBlock =
    task.category === 'deadline' || task.dueDate ? (
      onUpdateDueDate ? (
        <label className={`due-date-field ${overdue ? 'is-overdue' : ''}`}>
          <span className="due-date-label">限期</span>
          <input
            type="date"
            value={task.dueDate ?? ''}
            onChange={(e) => onUpdateDueDate(task.id, e.target.value)}
          />
          {overdue ? <span className="due-overdue-tag">已逾期</span> : null}
        </label>
      ) : task.dueDate ? (
        <p className={`due-date-read ${overdue ? 'is-overdue' : ''}`}>
          {formatDueDateLabel(task.dueDate)}
          {overdue ? ' · 已逾期' : ''}
        </p>
      ) : null
    ) : null

  /** 優先：緊急／普通／不急；待處理：一般／不急 — 精簡 chip，點開再選 */
  const isPriority = task.category === 'priority'
  const isDeadline = task.category === 'deadline'
  const isTodoLow = !isPriority && !isDeadline && task.urgency === 'low'
  const todoOptions = [
    { id: 'normal' as const, label: '一般' },
    { id: 'low' as const, label: '不急' },
  ]
  const currentUrgencyLabel = isPriority
    ? urgencyLabel(task.urgency)
    : task.urgency === 'low'
      ? '不急'
      : '一般'

  let urgencyBlock: ReactNode = null
  if (isDeadline) {
    urgencyBlock = null
  } else if (onUpdateUrgency) {
    const options = isPriority ? URGENCY_OPTIONS : todoOptions
    urgencyBlock = (
      <div className={`urgency-compact ${urgencyOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className={`urgency-chip urgency-${task.urgency === 'urgent' ? 'urgent' : task.urgency === 'low' ? 'low' : 'normal'}`}
          aria-expanded={urgencyOpen}
          aria-haspopup="listbox"
          onClick={() => setUrgencyOpen((v) => !v)}
        >
          {currentUrgencyLabel}
          <span className="urgency-chip-caret" aria-hidden>
            {urgencyOpen ? '▴' : '▾'}
          </span>
        </button>
        {urgencyOpen ? (
          <div className="urgency-menu" role="listbox" aria-label="選擇緊急等級">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={
                  isPriority
                    ? task.urgency === opt.id
                    : (task.urgency === 'low' ? 'low' : 'normal') === opt.id
                }
                className={`urgency-menu-item ${
                  (
                    isPriority
                      ? task.urgency === opt.id
                      : (task.urgency === 'low' ? 'low' : 'normal') === opt.id
                  )
                    ? 'is-active'
                    : ''
                }`}
                onClick={() => {
                  if (task.urgency !== opt.id) onUpdateUrgency(task.id, opt.id)
                  setUrgencyOpen(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  } else if (isPriority) {
    urgencyBlock = (
      <span
        className={`urgency-badge urgency-${task.urgency}`}
        aria-label={`緊急等級：${urgencyLabel(task.urgency)}`}
      >
        {urgencyLabel(task.urgency)}
      </span>
    )
  } else if (isTodoLow) {
    urgencyBlock = (
      <span className="urgency-badge urgency-low" aria-label="不急">
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
          {!editing && !editingDetail ? assignerBlock : editingAssigner ? assignerBlock : null}
          {!editing && !editingDetail ? detailBlock : editingDetail ? detailBlock : null}
          {!editing && !editingDetail ? dueBlock : null}
          {!editing && !editingDetail ? urgencyBlock : null}
          {showActions && !editingDetail && !editingAssigner ? (
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
        {!editing && !editingDetail ? assignerBlock : editingAssigner ? assignerBlock : null}
        {!editing && !editingDetail ? detailBlock : editingDetail ? detailBlock : null}
        {!editing && !editingDetail ? dueBlock : null}
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
