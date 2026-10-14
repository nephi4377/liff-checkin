import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  pointerWithin,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { isActiveTask, isTrashedTask } from '../data'
import type { Task, TaskCategory, Urgency } from '../types'
import { sortPriorityTasks, urgencyLabel } from '../urgency'
import { TaskCard } from './TaskCard'

interface AssistantBoardProps {
  tasks: Task[]
  focusName: string
  getAssigneeName: (id: string) => string
  onToggle: (id: string) => void
  onReorder: (category: TaskCategory, orderedIds: string[]) => void
  onMoveCategory: (taskId: string, category: TaskCategory) => void
  onUpdateTitle: (id: string, title: string) => void
  onUpdateCaseNo: (id: string, caseNo: string) => void
  onUpdateDetail: (id: string, detail: string) => void
  onUpdateAssigner?: (id: string, assigner: string) => void
  onAddAssigner?: (name: string) => string | null
  onUpdateDueDate?: (id: string, dueDate: string) => void
  onUpdateUrgency: (id: string, urgency: Urgency) => void
  onTrash: (id: string) => void
  onRestore: (id: string) => void
  onTogglePin: (id: string) => void
  assignerOptions?: string[]
  simple?: boolean
}

function emptyLabel(id: TaskCategory): string {
  if (id === 'priority') return '沒有優先'
  if (id === 'reminder') return '沒有提醒'
  return '沒有待處理'
}

function Column({
  id,
  title,
  tasks,
  onToggle,
  onUpdateTitle,
  onUpdateCaseNo,
  onUpdateDetail,
  onUpdateAssigner,
  onAddAssigner,
  onUpdateDueDate,
  onUpdateUrgency,
  onTrash,
  onTogglePin,
  assignerOptions,
  simple,
}: {
  id: TaskCategory
  title: string
  tasks: Task[]
  onToggle: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
  onUpdateCaseNo: (id: string, caseNo: string) => void
  onUpdateDetail: (id: string, detail: string) => void
  onUpdateAssigner?: (id: string, assigner: string) => void
  onAddAssigner?: (name: string) => string | null
  onUpdateDueDate?: (id: string, dueDate: string) => void
  onUpdateUrgency: (id: string, urgency: Urgency) => void
  onTrash: (id: string) => void
  onTogglePin?: (id: string) => void
  assignerOptions?: string[]
  simple?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const ids = tasks.map((t) => t.id)

  return (
    <div
      ref={setNodeRef}
      className={`list-column list-${id} ${isOver ? 'is-drop-target' : ''} ${simple ? 'simple-col' : ''}`}
    >
      <header className="list-header">
        <h2>{title}</h2>
        <span className="count-pill">{tasks.length}</span>
      </header>
      {tasks.length === 0 ? (
        <p className="empty-list">{emptyLabel(id)}</p>
      ) : (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="task-list">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={onToggle}
                onUpdateTitle={onUpdateTitle}
                onUpdateCaseNo={onUpdateCaseNo}
                onUpdateDetail={onUpdateDetail}
                onUpdateAssigner={onUpdateAssigner}
                onAddAssigner={onAddAssigner}
                onUpdateDueDate={onUpdateDueDate}
                onUpdateUrgency={onUpdateUrgency}
                onDelete={onTrash}
                onTogglePin={id === 'priority' ? onTogglePin : undefined}
                assignerOptions={assignerOptions}
                compact={simple}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  )
}

function DoneSection({
  tasks,
  onToggle,
  onTrash,
  simple,
}: {
  tasks: Task[]
  onToggle: (id: string) => void
  onTrash: (id: string) => void
  simple?: boolean
}) {
  if (tasks.length === 0) return null

  return (
    <div className={`list-column list-done ${simple ? 'simple-col' : ''}`}>
      <header className="list-header">
        <h2>已完成</h2>
        <span className="count-pill">{tasks.length}</span>
      </header>
      <p className="done-hint">取消勾選可復原 · 超過 10 天自動清除</p>
      <ul className="task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onTrash}
            dragDisabled
            compact={simple}
          />
        ))}
      </ul>
    </div>
  )
}

function TrashSection({
  tasks,
  onRestore,
  simple,
}: {
  tasks: Task[]
  onRestore: (id: string) => void
  simple?: boolean
}) {
  return (
    <div className={`list-column list-trash ${simple ? 'simple-col' : ''}`}>
      <header className="list-header">
        <h2>已刪</h2>
        <span className="count-pill">{tasks.length}</span>
      </header>
      <p className="done-hint">按復原可救回 · 超過 3 天永久清除</p>
      {tasks.length === 0 ? (
        <p className="empty-list">沒有已刪任務</p>
      ) : (
        <ul className="task-list trash-list">
          {tasks.map((task) => (
            <li key={task.id} className="task-card task-card-compact is-trashed">
              <div className="task-body">
                {task.caseNo ? (
                  <span className="case-no-badge">案號 {task.caseNo}</span>
                ) : null}
                <p className="task-title">{task.title}</p>
                {task.assigner ? (
                  <p className="task-assigner">派自 {task.assigner}</p>
                ) : null}
                <div className="task-actions-row">
                  <button
                    type="button"
                    className="btn-primary task-restore-btn"
                    onClick={() => onRestore(task.id)}
                  >
                    復原
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AssistantBoard({
  tasks,
  focusName,
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
  assignerOptions,
  simple,
}: AssistantBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 10 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const { byCategory, done, trashed } = useMemo(() => {
    const map: Record<TaskCategory, Task[]> = {
      priority: [],
      reminder: [],
      todo: [],
    }
    const completed: Task[] = []
    const trash: Task[] = []
    for (const t of tasks) {
      if (isTrashedTask(t)) {
        trash.push(t)
        continue
      }
      if (!isActiveTask(t)) continue
      if (t.completed) completed.push(t)
      else (map[t.category] ?? map.todo).push(t)
    }
    map.priority = sortPriorityTasks(map.priority)
    map.reminder = [...map.reminder].sort((a, b) => a.order - b.order)
    map.todo = [...map.todo].sort((a, b) => {
      const aLow = a.urgency === 'low' ? 1 : 0
      const bLow = b.urgency === 'low' ? 1 : 0
      if (aLow !== bLow) return aLow - bLow
      return a.order - b.order
    })
    completed.sort(
      (a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt),
    )
    trash.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
    return { byCategory: map, done: completed, trashed: trash }
  }, [tasks])

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId && isActiveTask(t)) ?? null)
    : null

  const findContainer = (id: string): TaskCategory | null => {
    if (id === 'priority' || id === 'reminder' || id === 'todo') return id
    const task = tasks.find((t) => t.id === id)
    if (!task || task.completed || isTrashedTask(task)) return null
    if (task.category === 'priority') return 'priority'
    if (task.category === 'reminder') return 'reminder'
    return 'todo'
  }

  const handleDragStart = (event: DragStartEvent) => {
    document.body.dataset.dndActive = '1'
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    document.body.dataset.dndActive = '0'
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const from = findContainer(String(active.id))
    const overId = String(over.id)
    const to = findContainer(overId)
    if (!from || !to) return

    if (from !== to) {
      onMoveCategory(String(active.id), to)
      return
    }

    if (from === 'priority') {
      const list = byCategory.priority
      const activeTask = list.find((t) => t.id === String(active.id))
      if (!activeTask) return
      const overTask =
        overId === from ? null : list.find((t) => t.id === overId)
      if (overTask && overTask.urgency !== activeTask.urgency) return

      const band = list.filter((t) => t.urgency === activeTask.urgency)
      const bandIds = band.map((t) => t.id)
      const oldIndex = bandIds.indexOf(String(active.id))
      const newIndex =
        overTask && overTask.urgency === activeTask.urgency
          ? bandIds.indexOf(overId)
          : bandIds.length - 1
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const newBandIds = arrayMove(bandIds, oldIndex, newIndex)
      const urgencyLevels = ['urgent', 'normal', 'low'] as const
      const orderedIds: string[] = []
      for (const level of urgencyLevels) {
        if (level === activeTask.urgency) {
          orderedIds.push(...newBandIds)
        } else {
          orderedIds.push(
            ...list.filter((t) => t.urgency === level).map((t) => t.id),
          )
        }
      }
      onReorder(from, orderedIds)
      return
    }

    const ids = byCategory[from].map((t) => t.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex =
      overId === from ? ids.length - 1 : ids.indexOf(overId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    onReorder(from, arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const hits = pointerWithin(args)
        if (hits.length) return hits
        return closestCorners(args)
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        document.body.dataset.dndActive = '0'
        setActiveId(null)
      }}
    >
      <section
        className={`lists-panel ${simple ? 'lists-panel-simple' : ''}`}
        aria-label={`${focusName} 的清單`}
      >
        <Column
          id="priority"
          title="優先"
          tasks={byCategory.priority}
          onToggle={onToggle}
          onUpdateTitle={onUpdateTitle}
          onUpdateCaseNo={onUpdateCaseNo}
          onUpdateDetail={onUpdateDetail}
          onUpdateAssigner={onUpdateAssigner}
          onAddAssigner={onAddAssigner}
          onUpdateDueDate={onUpdateDueDate}
          onUpdateUrgency={onUpdateUrgency}
          onTrash={onTrash}
          onTogglePin={onTogglePin}
          assignerOptions={assignerOptions}
          simple={simple}
        />
        <Column
          id="reminder"
          title="提醒"
          tasks={byCategory.reminder}
          onToggle={onToggle}
          onUpdateTitle={onUpdateTitle}
          onUpdateCaseNo={onUpdateCaseNo}
          onUpdateDetail={onUpdateDetail}
          onUpdateAssigner={onUpdateAssigner}
          onAddAssigner={onAddAssigner}
          onUpdateDueDate={undefined}
          onUpdateUrgency={onUpdateUrgency}
          onTrash={onTrash}
          assignerOptions={assignerOptions}
          simple={simple}
        />
        <Column
          id="todo"
          title="待處理"
          tasks={byCategory.todo}
          onToggle={onToggle}
          onUpdateTitle={onUpdateTitle}
          onUpdateCaseNo={onUpdateCaseNo}
          onUpdateDetail={onUpdateDetail}
          onUpdateAssigner={onUpdateAssigner}
          onAddAssigner={onAddAssigner}
          onUpdateDueDate={onUpdateDueDate}
          onUpdateUrgency={onUpdateUrgency}
          onTrash={onTrash}
          assignerOptions={assignerOptions}
          simple={simple}
        />
        <DoneSection
          tasks={done}
          onToggle={onToggle}
          onTrash={onTrash}
          simple={simple}
        />
        <TrashSection
          tasks={trashed}
          onRestore={onRestore}
          simple={simple}
        />
      </section>

      <DragOverlay>
        {activeTask ? (
          <div
            className={`task-card is-dragging overlay-card ${activeTask.category === 'priority' ? `urgency-tone-${activeTask.urgency}` : ''}`}
          >
            {activeTask.category === 'priority' ? (
              <span className={`urgency-badge urgency-${activeTask.urgency}`}>
                {urgencyLabel(activeTask.urgency)}
              </span>
            ) : null}
            {activeTask.caseNo ? (
              <span className="case-no-badge">案號 {activeTask.caseNo}</span>
            ) : null}
            <p className="task-title">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
