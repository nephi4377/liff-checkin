import { useState, type FormEvent } from 'react'
import {
  ASSIGNER_ADD_VALUE,
  buildAssignerOptions,
  normalizeAssignerName,
} from '../assigners'

interface AssignerSelectProps {
  value: string
  options?: string[]
  onChange: (name: string) => void
  onAddAssigner: (name: string) => string | null
  emptyLabel?: string
  className?: string
  selectClassName?: string
}

export function AssignerSelect({
  value,
  options = [],
  onChange,
  onAddAssigner,
  emptyLabel = '誰派的',
  className = '',
  selectClassName = 'task-assigner-select',
}: AssignerSelectProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const choices = buildAssignerOptions([...options, value])

  const commitAdd = (e?: FormEvent) => {
    e?.preventDefault()
    const name = normalizeAssignerName(draft)
    if (!name) return
    const saved = onAddAssigner(name) ?? name
    onChange(saved)
    setDraft('')
    setAdding(false)
  }

  return (
    <div className={`assigner-select-wrap ${className}`.trim()}>
      {adding ? (
        <form className="assigner-add-form" onSubmit={commitAdd}>
          <input
            className="assigner-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="新派工人名"
            autoFocus
            maxLength={24}
            aria-label="新派工人名"
          />
          <div className="assigner-add-actions">
            <button
              type="button"
              className="btn-ghost assigner-add-cancel"
              onClick={() => {
                setAdding(false)
                setDraft('')
              }}
            >
              取消
            </button>
            <button type="submit" className="btn-primary assigner-add-ok">
              新增
            </button>
          </div>
        </form>
      ) : (
        <select
          className={selectClassName}
          value={value}
          aria-label="誰派的"
          onChange={(e) => {
            const v = e.target.value
            if (v === ASSIGNER_ADD_VALUE) {
              setAdding(true)
              return
            }
            onChange(v)
          }}
        >
          <option value="">{emptyLabel}</option>
          {choices.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={ASSIGNER_ADD_VALUE}>＋ 新增派工人</option>
        </select>
      )}
    </div>
  )
}
