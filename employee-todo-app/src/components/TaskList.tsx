import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import type { Task } from '../types'
import { TaskCard } from './TaskCard'

interface TaskListProps {
  tasks: Task[]
  emptyLabel: string
  getAssigneeName?: (id: string) => string
  showAssignee?: boolean
  onToggle: (id: string) => void
  onDelete?: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  dragDisabled?: boolean
}

export function TaskList({
  tasks,
  emptyLabel,
  getAssigneeName,
  showAssignee,
  onToggle,
  onDelete,
  onReorder,
  dragDisabled,
}: TaskListProps) {
  // Mouse + Touch separately so Android Chrome can long-press-drag
  // without fighting page scroll (PointerSensor alone often fails on phones).
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sorted = [...tasks].sort((a, b) => a.order - b.order)
  const ids = sorted.map((t) => t.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  if (sorted.length === 0) {
    return <p className="empty-list">{emptyLabel}</p>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="task-list">
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assigneeName={getAssigneeName?.(task.assigneeId)}
              showAssignee={showAssignee}
              onToggle={onToggle}
              onDelete={onDelete}
              dragDisabled={dragDisabled}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
