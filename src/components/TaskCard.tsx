import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  formatDueDateLabel,
  isOverdue,
} from '../dueDate'
import type { Task, Urgency } from '../types'
import { URGENCY_OPTIONS, urgencyLabel } from '../urgency'
import { AssignerSelect } from './AssignerSelect'

interface TaskCardProps {
  task: Task
  assigneeName?: string
  showAssignee?: boolean
  onToggle: (id: string) => void
  /** Soft-delete（左滑） */
  onDelete?: (id: string) => void
  /** 優先區釘選（左滑動作列） */
  onTogglePin?: (id: string) => void
  onUpdateTitle?: (id: string, title: string) => void
  onUpdateDetail?: (id: string, detail: string) => void
  onUpdateAssigner?: (id: string, assigner: string) => void
  onAddAssigner?: (name: string) => string | null
  onUpdateDueDate?: (id: string, dueDate: string) => void
  onUpdateUrgency?: (id: string, urgency: Urgency) => void
  assignerOptions?: string[]
  dragDisabled?: boolean
  compact?: boolean
}

const SWIPE_OPEN_PX = 148
const SWIPE_DELETE_END_PX = 200

export function TaskCard({
  task,
  assigneeName,
  showAssignee,
  onToggle,
  onDelete,
  onTogglePin,
  onUpdateTitle,
  onUpdateDetail,
  onUpdateAssigner,
  onAddAssigner,
  onUpdateDueDate,
  onUpdateUrgency,
  assignerOptions,
  dragDisabled,
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
  const [urgencyOpen, setUrgencyOpen] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const trackRef = useRef<HTMLLIElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const axisRef = useRef<'undecided' | 'x' | 'y'>('undecided')
  const swipeXRef = useRef(0)

  const isPriority = task.category === 'priority'
  const canPin = Boolean(onTogglePin) && isPriority
  const swipeEnabled = Boolean(onDelete) || canPin

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

  const setSwipe = (x: number) => {
    swipeXRef.current = x
    setSwipeX(x)
  }

  const closeActions = () => {
    setActionsOpen(false)
    setSwipe(0)
  }

  const onSwipePointerDown = (e: ReactPointerEvent) => {
    if (!swipeEnabled || editing || editingDetail || isDragging) return
    if ((e.target as HTMLElement).closest('.drag-handle')) return
    if ((e.target as HTMLElement).closest('.swipe-actions')) return
    if (
      (e.target as HTMLElement).closest(
        'input, textarea, select, button, a, label',
      )
    )
      return
    pointerIdRef.current = e.pointerId
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    axisRef.current = 'undecided'
    setSwiping(true)
    try {
      trackRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const onSwipePointerMove = (e: ReactPointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    const dx = e.clientX - startXRef.current
    const dy = e.clientY - startYRef.current
    if (axisRef.current === 'undecided') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axisRef.current === 'y') {
        pointerIdRef.current = null
        setSwiping(false)
        return
      }
    }
    if (axisRef.current !== 'x') return
    e.preventDefault()
    const base = actionsOpen ? -SWIPE_OPEN_PX : 0
    const next = Math.min(0, Math.max(-SWIPE_DELETE_END_PX, base + dx))
    setSwipe(next)
  }

  const finishSwipe = (e: ReactPointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    pointerIdRef.current = null
    setSwiping(false)
    const x = swipeXRef.current
    axisRef.current = 'undecided'

    if (canPin) {
      // 優先：滑出動作列（釘選／刪除），不直接刪
      if (x <= -SWIPE_OPEN_PX * 0.45) {
        setSwipe(-SWIPE_OPEN_PX)
        setActionsOpen(true)
      } else {
        closeActions()
      }
      return
    }

    // 非優先：左滑到底刪除
    const width = trackRef.current?.offsetWidth ?? 300
    const threshold = Math.min(SWIPE_DELETE_END_PX * 0.75, width * 0.5)
    if (onDelete && Math.abs(x) >= threshold) {
      setSwipe(-width)
      window.setTimeout(() => onDelete(task.id), 160)
    } else {
      setSwipe(0)
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: swiping ? undefined : transition,
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
      onClick={() => {
        closeActions()
        setEditing(true)
      }}
    >
      <span className="task-title">
        {task.pinned ? (
          <span className="pin-badge" aria-label="已釘選">
            釘
          </span>
        ) : null}
        {task.title}
      </span>
      <span className="edit-hint">編輯</span>
    </button>
  ) : (
    <p className="task-title">
      {task.pinned ? (
        <span className="pin-badge" aria-label="已釘選">
          釘
        </span>
      ) : null}
      {task.title}
    </p>
  )

  const detailBlock = editingDetail && onUpdateDetail ? (
    <div className="detail-field">
      <span className="detail-field-label">派工說明</span>
      <textarea
        className="task-detail-edit"
        value={detailDraft}
        onChange={(e) => setDetailDraft(e.target.value)}
        onBlur={commitDetail}
        rows={5}
        aria-label="派工說明"
        placeholder="地點、材料、注意事項…"
        autoFocus
      />
    </div>
  ) : onUpdateDetail ? (
    <button
      type="button"
      className="task-detail-btn"
      onClick={() => {
        closeActions()
        setEditingDetail(true)
      }}
    >
      {task.detail ? (
        <>
          <span className="detail-field-label">派工說明</span>
          <span className="task-detail">{task.detail}</span>
        </>
      ) : (
        <span className="task-detail-empty">＋ 派工說明</span>
      )}
    </button>
  ) : task.detail ? (
    <div className="detail-field">
      <span className="detail-field-label">派工說明</span>
      <p className="task-detail">{task.detail}</p>
    </div>
  ) : null

  const workerNoteBlock = task.workerNote?.trim() ? (
    <div className="worker-note-readonly" aria-label="工務說明">
      <span className="worker-note-label">工務說明</span>
      <span className="worker-note-body">{task.workerNote}</span>
    </div>
  ) : null

  const assignerBlock =
    onUpdateAssigner && onAddAssigner ? (
      <AssignerSelect
        value={task.assigner ?? ''}
        options={assignerOptions}
        onChange={(name) => onUpdateAssigner(task.id, name)}
        onAddAssigner={onAddAssigner}
      />
    ) : task.assigner ? (
      <p className="task-assigner">派自 {task.assigner}</p>
    ) : null

  const overdue = isOverdue(task.dueDate, task.completed)
  const dueBlock =
    onUpdateDueDate && isPriority ? (
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

  const isTodoLow = !isPriority && task.urgency === 'low'
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
  if (onUpdateUrgency) {
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

  const toneClass = isPriority
    ? `urgency-tone-${task.urgency}`
    : isTodoLow
      ? 'urgency-tone-low'
      : ''

  const bindRef = (node: HTMLLIElement | null) => {
    trackRef.current = node
    setNodeRef(node)
  }

  const swipeHint = !swipeEnabled
    ? null
    : canPin
      ? '← 左滑：釘選／刪除'
      : '← 左滑到底刪除'

  return (
    <li
      ref={bindRef}
      style={style}
      className={`task-card ${compact ? 'task-card-compact' : ''} swipe-card ${toneClass} ${task.completed ? 'is-done' : ''} ${task.pinned ? 'is-pinned' : ''} ${isDragging ? 'is-dragging' : ''} ${editing ? 'is-editing' : ''} ${swiping || actionsOpen ? 'is-swiping' : ''}`}
      onPointerDown={onSwipePointerDown}
      onPointerMove={onSwipePointerMove}
      onPointerUp={finishSwipe}
      onPointerCancel={finishSwipe}
    >
      {swipeEnabled ? (
        <div className="swipe-behind" aria-hidden={!actionsOpen}>
          {canPin ? (
            <div className="swipe-actions">
              <button
                type="button"
                className="swipe-action swipe-action-pin"
                onClick={() => {
                  onTogglePin?.(task.id)
                  closeActions()
                }}
              >
                {task.pinned ? '取消釘選' : '釘選'}
              </button>
              {onDelete ? (
                <button
                  type="button"
                  className="swipe-action swipe-action-delete"
                  onClick={() => {
                    onDelete(task.id)
                    closeActions()
                  }}
                >
                  刪除
                </button>
              ) : null}
            </div>
          ) : (
            <span className="swipe-delete-label">刪除</span>
          )}
        </div>
      ) : null}

      <div
        className="swipe-front"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease',
        }}
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
          {!editing && !editingDetail ? assignerBlock : null}
          {!editing && !editingDetail
            ? detailBlock
            : editingDetail
              ? detailBlock
              : null}
          {!editing && !editingDetail ? workerNoteBlock : null}
          {!editing && !editingDetail ? dueBlock : null}
          {!editing && !editingDetail ? urgencyBlock : null}
          {showAssignee && assigneeName && !editing && !compact ? (
            <p className="task-meta">指派給 {assigneeName}</p>
          ) : null}
          {swipeHint && !editing && !editingDetail ? (
            <p className="swipe-hint">{swipeHint}</p>
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
      </div>
    </li>
  )
}
