import { useMemo } from 'react'
import type { Task } from '../types'
import { urgencyLabel } from '../urgency'

interface SimpleAssignedListProps {
  workerName: string
  tasks: Task[]
  onToggle: (id: string) => void
}

/** Personal zone: check-only; show urgency on 優先 / 不急 on 待處理 */
export function SimpleAssignedList({
  workerName,
  tasks,
  onToggle,
}: SimpleAssignedListProps) {
  const open = useMemo(
    () =>
      [...tasks]
        .filter((t) => !t.completed)
        .sort((a, b) => {
          const ac = a.category === 'priority' ? 0 : 1
          const bc = b.category === 'priority' ? 0 : 1
          if (ac !== bc) return ac - bc
          if (a.category === 'todo' && b.category === 'todo') {
            const aLow = a.urgency === 'low' ? 1 : 0
            const bLow = b.urgency === 'low' ? 1 : 0
            if (aLow !== bLow) return aLow - bLow
          }
          if (a.category === 'priority' && b.category === 'priority') {
            const rank = { urgent: 0, normal: 1, low: 2 } as const
            const ur = rank[a.urgency] - rank[b.urgency]
            if (ur !== 0) return ur
          }
          return a.order - b.order
        }),
    [tasks],
  )
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
        <p className="section-lead">由「派工」指派 — 只能勾是否完成</p>
      </header>

      <section className="office-section" aria-labelledby="assigned-open">
        <h3 id="assigned-open">進行中</h3>
        {open.length === 0 ? (
          <p className="empty-list">目前沒有任務</p>
        ) : (
          <ul className="office-list">
            {open.map((t) => {
              const isPriority = t.category === 'priority'
              const isTodoLow = !isPriority && t.urgency === 'low'
              const tone = isPriority
                ? `urgency-tone-${t.urgency}`
                : isTodoLow
                  ? 'urgency-tone-low'
                  : ''
              return (
                <li key={t.id} className={`office-row ${tone}`}>
                  <label className="office-check">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => onToggle(t.id)}
                    />
                    <span className="sr-only">完成</span>
                  </label>
                  <div className="office-body">
                    {isPriority ? (
                      <span
                        className={`urgency-badge urgency-badge-lg urgency-${t.urgency}`}
                      >
                        {urgencyLabel(t.urgency)}
                      </span>
                    ) : isTodoLow ? (
                      <span className="urgency-badge urgency-badge-lg urgency-low">
                        不急
                      </span>
                    ) : null}
                    <span className="office-title">{t.title}</span>
                    {t.detail ? (
                      <p className="task-detail">{t.detail}</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section className="office-section" aria-labelledby="assigned-done">
          <h3 id="assigned-done">已完成</h3>
          <ul className="office-list">
            {done.map((t) => (
              <li key={t.id} className="office-row is-done">
                <label className="office-check">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => onToggle(t.id)}
                  />
                  <span className="sr-only">完成</span>
                </label>
                <div className="office-body">
                  <span className="office-title">{t.title}</span>
                  {t.detail ? (
                    <p className="task-detail">{t.detail}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
