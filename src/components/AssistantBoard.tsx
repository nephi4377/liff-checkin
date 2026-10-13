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
import { compareDeadlineTasks } from '../dueDate'
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
  onUpdateDetail: (id: string, detail: string) => void
  onUpdateAssigner?: (id: string, assigner: string) => void
  onAddAssigner?: (name: string) => string | null
  onUpdateDueDate?: (id: string, dueDate: string) => void
  onUpdateUrgency: (id: string, urgency: Urgency) => void
  assignerOptions?: string[]
  simple?: boolean
}

function emptyLabel(id: TaskCategory): string {
  if (id === 'priority') return '沒有優先'
  if (id === 'deadline') return '沒有限期'
  return '沒有待處理'
}

function Column({
  id,
  title,
  tasks,
  onToggle,
  onUpdateTitle,
  onUpdateDetail,
  onUpdateAssigner,
  onAddAssigner,
  onUpdateDueDate,
  onUpdateUrgency,
  assignerOptions,
  simple,
}: {
  id: TaskCategory
  title: string
  tasks: Task[]
  onToggle: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
  onUpdateDetail: (id: string, detail: string) => void
  onUpdateAssigner?: (id: string, assigner: string) => void
  onAddAssigner?: (name: string) => string | null
  onUpdateDueDate?: (id: string, dueDate: string) => void
  onUpdateUrgency: (id: string, urgency: Urgency) => void
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
                onUpdateDetail={onUpdateDetail}
                onUpdateAssigner={onUpdateAssigner}
                onAddAssigner={onAddAssigner}
                onUpdateDueDate={onUpdateDueDate}
                onUpdateUrgency={
                  id === 'deadline' ? undefined : onUpdateUrgency
                }
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
  simple,
}: {
  tasks: Task[]
  onToggle: (id: string) => void
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
            dragDisabled
            compact={simple}
          />
        ))}
      </ul>
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
  onUpdateDetail,
  onUpdateAssigner,
  onAddAssigner,
  onUpdateDueDate,
  onUpdateUrgency,
  assignerOptions,
  simple,
}: AssistantBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      // Longer delay so normal scrolling doesn't fight drag
      activationConstraint: { delay: 220, tolerance: 10 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const { byCategory, done } = useMemo(() => {
    const map: Record<TaskCategory, Task[]> = {
      priority: [],
      todo: [],
      deadline: [],
    }
    const completed: Task[] = []
    for (const t of tasks) {
      if (t.completed) completed.push(t)
      else (map[t.category] ?? map.todo).push(t)
    }
    map.priority = sortPriorityTasks(map.priority)
    // 代辦：不急永遠沉到最下面，其餘依 order
    map.todo = [...map.todo].sort((a, b) => {
      const aLow = a.urgency === 'low' ? 1 : 0
      const bLow = b.urgency === 'low' ? 1 : 0
      if (aLow !== bLow) return aLow - bLow
      return a.order - b.order
    })
    map.deadline = [...map.deadline].sort(compareDeadlineTasks)
    completed.sort(
      (a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt),
    )
    return { byCategory: map, done: completed }
  }, [tasks])

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId) ?? null)
    : null

  const findContainer = (id: string): TaskCategory | null => {
    if (id === 'priority' || id === 'todo' || id === 'deadline') return id
    const task = tasks.find((t) => t.id === id)
    if (!task || task.completed) return null
    return task.category
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
          onUpdateDetail={onUpdateDetail}
          onUpdateAssigner={onUpdateAssigner}
          onAddAssigner={onAddAssigner}
          onUpdateDueDate={onUpdateDueDate}
          onUpdateUrgency={onUpdateUrgency}
          assignerOptions={assignerOptions}
          simple={simple}
        />
        <Column
          id="deadline"
          title="限期完成"
          tasks={byCategory.deadline}
          onToggle={onToggle}
          onUpdateTitle={onUpdateTitle}
          onUpdateDetail={onUpdateDetail}
          onUpdateAssigner={onUpdateAssigner}
          onAddAssigner={onAddAssigner}
          onUpdateDueDate={onUpdateDueDate}
          onUpdateUrgency={onUpdateUrgency}
          assignerOptions={assignerOptions}
          simple={simple}
        />
        <Column
          id="todo"
          title="待處理"
          tasks={byCategory.todo}
          onToggle={onToggle}
          onUpdateTitle={onUpdateTitle}
          onUpdateDetail={onUpdateDetail}
          onUpdateAssigner={onUpdateAssigner}
          onAddAssigner={onAddAssigner}
          onUpdateDueDate={onUpdateDueDate}
          onUpdateUrgency={onUpdateUrgency}
          assignerOptions={assignerOptions}
          simple={simple}
        />
        <DoneSection tasks={done} onToggle={onToggle} simple={simple} />
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
            <p className="task-title">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
