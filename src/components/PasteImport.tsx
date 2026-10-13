import { useMemo, useState } from 'react'
import type { TaskCategory, Urgency } from '../types'
import { PASTE_TEMPLATE, parsePasteText, type ParsedPasteLine } from '../pasteFormat'

interface PasteImportProps {
  onAdd: (
    title: string,
    assigneeId: string,
    category: TaskCategory,
    detail?: string,
    urgency?: Urgency,
    dueDate?: string,
    assigner?: string,
  ) => void
}

export function PasteImport({ onAdd }: PasteImportProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParsedPasteLine[] | null>(null)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [addedMsg, setAddedMsg] = useState('')

  const okLines = useMemo(
    () => (preview ?? []).filter((p) => p.ok),
    [preview],
  )

  const handleParse = () => {
    const parsed = parsePasteText(text)
    setPreview(parsed)
    const next: Record<number, boolean> = {}
    for (const p of parsed) {
      if (p.ok) next[p.lineNo] = true
    }
    setSelected(next)
    setAddedMsg('')
  }

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(PASTE_TEMPLATE)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setText(PASTE_TEMPLATE)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleConfirm = () => {
    let n = 0
    for (const p of okLines) {
      if (!selected[p.lineNo]) continue
      if (!p.assigneeId || !p.category || !p.title || !p.urgency) continue
      onAdd(
        p.title,
        p.assigneeId,
        p.category,
        p.detail,
        p.urgency,
        p.dueDate,
        p.assigner,
      )
      n += 1
    }
    setAddedMsg(n > 0 ? `已加入 ${n} 件` : '未勾選')
    if (n > 0) {
      setText('')
      setPreview(null)
      setSelected({})
    }
  }

  if (!open) {
    return (
      <div className="paste-import-bar">
        <button
          type="button"
          className="btn-ghost paste-toggle"
          onClick={() => setOpen(true)}
        >
          整理後貼上
        </button>
      </div>
    )
  }

  return (
    <section className="paste-import" aria-labelledby="paste-heading">
      <header className="paste-import-head">
        <h2 id="paste-heading">整理後貼上</h2>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          收合
        </button>
      </header>
      <textarea
        className="paste-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={PASTE_TEMPLATE}
        spellCheck={false}
        aria-label="貼上整理後的工作"
      />
      <div className="paste-actions">
        <button type="button" className="btn-ghost" onClick={handleCopyTemplate}>
          {copied ? '已複製' : '複製範本'}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleParse}
          disabled={!text.trim()}
        >
          解析並預覽
        </button>
      </div>

      {preview ? (
        <div className="paste-preview">
          <ul className="paste-preview-list">
            {preview.map((p) => (
              <li
                key={p.lineNo}
                className={p.ok ? 'paste-row is-ok' : 'paste-row is-bad'}
              >
                {p.ok ? (
                  <label className="paste-row-label">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[p.lineNo])}
                      onChange={(e) =>
                        setSelected((s) => ({
                          ...s,
                          [p.lineNo]: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      {p.workerName} · {p.title}
                      {p.assigner ? ` · 派自${p.assigner}` : ''}
                    </span>
                  </label>
                ) : (
                  <span>
                    第 {p.lineNo} 行：{p.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-primary btn-xl"
            onClick={handleConfirm}
            disabled={okLines.every((p) => !selected[p.lineNo])}
          >
            確認加入
          </button>
        </div>
      ) : null}

      {addedMsg ? <p className="paste-added">{addedMsg}</p> : null}
    </section>
  )
}
