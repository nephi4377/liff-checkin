import { isActiveTask } from '../data'
import type { Task } from '../types'
import { sortPriorityTasks } from '../urgency'
import { TaskList } from './TaskList'

interface FieldPanelProps {
  workerName: string
  tasks: Task[]
  onToggle: (id: string) => void
}

/** Single-person 派工 view — no worker switcher */
export function FieldPanel({ workerName, tasks, onToggle }: FieldPanelProps) {
  const active = tasks.filter((t) => isActiveTask(t) && !t.completed)
  const priority = sortPriorityTasks(
    active.filter((t) => t.category === 'priority'),
  )
  const reminder = active
    .filter((t) => t.category === 'reminder')
    .sort((a, b) => a.order - b.order)
  const todo = active
    .filter((t) => t.category === 'todo')
    .sort((a, b) => {
      const aLow = a.urgency === 'low' ? 1 : 0
      const bLow = b.urgency === 'low' ? 1 : 0
      if (aLow !== bLow) return aLow - bLow
      return a.order - b.order
    })
  const done = [...tasks.filter((t) => isActiveTask(t) && t.completed)].sort(
    (a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt),
  )
  const openCount = active.length

  return (
    <div className="simple-dispatch person-shell">
      <p className="simple-status person-banner">
        <strong>{workerName}</strong> 的派工
        {openCount > 0 ? `　剩 ${openCount}` : '　今天做完了'}
      </p>

      <section className="lists-panel lists-panel-simple" aria-label={`${workerName}的派工`}>
        <div className="list-column list-priority simple-col">
          <header className="list-header">
            <h2>優先</h2>
            <span className="count-pill">{priority.length}</span>
          </header>
          <TaskList
            tasks={priority}
            emptyLabel="沒有優先"
            onToggle={onToggle}
            onReorder={() => {}}
            dragDisabled
          />
        </div>
        <div className="list-column list-reminder simple-col">
          <header className="list-header">
            <h2>提醒</h2>
            <span className="count-pill">{reminder.length}</span>
          </header>
          <TaskList
            tasks={reminder}
            emptyLabel="沒有提醒"
            onToggle={onToggle}
            onReorder={() => {}}
            dragDisabled
          />
        </div>
        <div className="list-column list-todo simple-col">
          <header className="list-header">
            <h2>待處理</h2>
            <span className="count-pill">{todo.length}</span>
          </header>
          <TaskList
            tasks={todo}
            emptyLabel="沒有待處理"
            onToggle={onToggle}
            onReorder={() => {}}
            dragDisabled
          />
        </div>
        {done.length > 0 ? (
          <div className="list-column list-done simple-col">
            <header className="list-header">
              <h2>已完成</h2>
              <span className="count-pill">{done.length}</span>
            </header>
            <p className="done-hint">取消勾選可復原 · 超過 10 天自動清除</p>
            <TaskList
              tasks={done}
              emptyLabel="沒有已完成"
              onToggle={onToggle}
              onReorder={() => {}}
              dragDisabled
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
