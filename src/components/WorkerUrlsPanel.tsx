import { useState } from 'react'
import type { Worker } from '../types'
import { workerShareUrl } from '../workers'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function WorkerUrlsPanel({ workers }: { workers: Worker[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const onCopy = async (w: Worker) => {
    const url = workerShareUrl(w.id)
    const ok = await copyText(url)
    if (ok) {
      setCopiedId(w.id)
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === w.id ? null : cur))
      }, 1600)
    }
  }

  return (
    <section className="worker-urls-panel" aria-labelledby="worker-urls-heading">
      <header className="worker-urls-head">
        <h2 id="worker-urls-heading">工務網址</h2>
        <p className="worker-urls-lead">複製後傳給工務，開啟即看自己的任務。</p>
      </header>
      <ul className="worker-url-list">
        {workers.map((w) => {
          const url = workerShareUrl(w.id)
          return (
            <li key={w.id} className="worker-url-row">
              <div className="worker-url-meta">
                <span className="worker-url-name">{w.name}</span>
                <code className="worker-url-text" title={url}>
                  {url}
                </code>
              </div>
              <button
                type="button"
                className="btn-ghost worker-url-copy"
                onClick={() => void onCopy(w)}
              >
                {copiedId === w.id ? '已複製' : '複製'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function WorkerCreatedBanner({
  worker,
  onClose,
}: {
  worker: Worker
  onClose: () => void
}) {
  const url = workerShareUrl(worker.id)
  const [copied, setCopied] = useState(false)

  return (
    <div className="worker-created-banner" role="status">
      <p className="worker-created-title">已新增工務「{worker.name}」</p>
      <p className="worker-created-lead">專屬網址（可複製給對方）：</p>
      <code className="worker-created-url">{url}</code>
      <div className="worker-created-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void copyText(url).then((ok) => {
              if (ok) {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              }
            })
          }}
        >
          {copied ? '已複製' : '複製網址'}
        </button>
        <a className="btn-ghost worker-created-open" href={url} target="_blank" rel="noreferrer">
          開啟
        </a>
        <button type="button" className="btn-ghost" onClick={onClose}>
          關閉
        </button>
      </div>
    </div>
  )
}
