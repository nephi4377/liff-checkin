import { useState, type FormEvent } from 'react'
import type { Worker } from '../types'
import { workerShareUrl } from '../workers'

interface WorkerManagePanelProps {
  workers: Worker[]
  onAdd: (name: string) => Worker | null
  onUpdate: (id: string, name: string) => Worker | null
  onRemove: (id: string) => boolean
  onCreated?: (worker: Worker) => void
  onFocusWorker?: (id: string) => void
}

export function WorkerManagePanel({
  workers,
  onAdd,
  onUpdate,
  onRemove,
  onCreated,
  onFocusWorker,
}: WorkerManagePanelProps) {
  const active = workers.filter((w) => !w.archived)
  const [mode, setMode] = useState<'idle' | 'add' | 'edit'>('idle')
  const [draftName, setDraftName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const startAdd = () => {
    setMode('add')
    setEditId(null)
    setDraftName('')
    setError('')
  }

  const startEdit = (w: Worker) => {
    setMode('edit')
    setEditId(w.id)
    setDraftName(w.name)
    setError('')
  }

  const cancel = () => {
    setMode('idle')
    setEditId(null)
    setDraftName('')
    setError('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const name = draftName.trim()
    if (!name) {
      setError('請輸入名字')
      return
    }
    if (mode === 'add') {
      const w = onAdd(name)
      if (!w) {
        setError('新增失敗')
        return
      }
      onCreated?.(w)
      onFocusWorker?.(w.id)
      cancel()
      return
    }
    if (mode === 'edit' && editId) {
      const w = onUpdate(editId, name)
      if (!w) {
        setError('名稱重複或無法修改')
        return
      }
      cancel()
    }
  }

  const handleRemove = (w: Worker) => {
    const openUrl = workerShareUrl(w.id)
    const ok = window.confirm(
      `確定刪除工務「${w.name}」？\n專屬網址將不再列出（任務仍保留）：\n${openUrl}`,
    )
    if (!ok) return
    if (onRemove(w.id)) {
      if (editId === w.id) cancel()
    }
  }

  return (
    <section className="worker-manage" aria-labelledby="worker-manage-heading">
      <header className="worker-manage-head">
        <div>
          <h2 id="worker-manage-heading">工務名單</h2>
          <p className="worker-manage-lead">
            所有工務（含恩德／阿勇）皆可新增、編輯改名、刪除。網址綁 id，改名不會壞連結。
          </p>
        </div>
        {mode === 'idle' ? (
          <button type="button" className="btn-primary worker-manage-add-btn" onClick={startAdd}>
            ＋ 新增工務
          </button>
        ) : null}
      </header>

      {mode !== 'idle' ? (
        <form className="simple-add-form worker-add-form" onSubmit={handleSubmit}>
          <label className="detail-field">
            <span className="detail-field-label">
              {mode === 'add' ? '新工務名字' : '工務名字'}
            </span>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="例：小明"
              autoFocus
              autoComplete="off"
              required
              maxLength={24}
            />
          </label>
          {error ? <p className="worker-manage-error">{error}</p> : null}
          <div className="simple-add-actions">
            <button type="button" className="btn-ghost" onClick={cancel}>
              取消
            </button>
            <button type="submit" className="btn-primary">
              {mode === 'add' ? '新增' : '儲存'}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="worker-manage-list">
        {active.map((w) => (
          <li key={w.id} className="worker-manage-row">
            <div className="worker-manage-meta">
              <span className="worker-manage-name">{w.name}</span>
            </div>
            <div className="worker-manage-actions">
              <button type="button" className="btn-ghost" onClick={() => startEdit(w)}>
                編輯
              </button>
              <button
                type="button"
                className="btn-ghost worker-manage-delete"
                onClick={() => handleRemove(w)}
              >
                刪除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
