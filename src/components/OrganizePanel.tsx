import { useRef, useState } from 'react'
import { organizeNotes } from '../organize/organize'

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function OrganizePanel() {
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const canSpeak = Boolean(getSpeechRecognition())

  const runOrganize = async () => {
    if (!raw.trim() || busy) return
    setBusy(true)
    setCopied(false)
    setDone(false)
    try {
      const out = await organizeNotes(raw)
      setResult(out.text)
      setDone(Boolean(out.text.trim()))
    } finally {
      setBusy(false)
    }
  }

  const copyResult = async () => {
    if (!result.trim()) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = result
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleSpeak = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    if (listening && recRef.current) {
      recRef.current.stop()
      setListening(false)
      return
    }
    const rec = new Ctor()
    rec.lang = 'zh-TW'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript?.trim()
      if (said) {
        setRaw((prev) => (prev.trim() ? `${prev.trim()}\n${said}` : said))
      }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  return (
    <section className="organize-panel" aria-label="AI 整理">
      <h2 className="organize-title">AI 整理</h2>
      <p className="organize-lead">
        貼上或說出雜記 → 整理 → 複製 → 貼進下方「詳細說明」
      </p>
      <textarea
        className="organize-input"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={4}
        placeholder="例如：阿勇明天下午去三樓補矽利康 很急 記得帶槍…"
        disabled={busy}
      />
      <div className="organize-actions">
        {canSpeak ? (
          <button
            type="button"
            className={`btn-ghost ${listening ? 'is-listening' : ''}`}
            onClick={toggleSpeak}
            disabled={busy}
          >
            {listening ? '停止' : '說話'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          onClick={() => void runOrganize()}
          disabled={busy || !raw.trim()}
        >
          {busy ? '整理中…' : '整理'}
        </button>
      </div>
      {result ? (
        <div className="organize-result-wrap">
          <pre className="organize-result" tabIndex={0}>
            {result}
          </pre>
          <div className="organize-result-bar">
            <button type="button" className="btn-primary" onClick={() => void copyResult()}>
              {copied ? '已複製' : '複製'}
            </button>
            {done ? <span className="organize-mode">已整理完成</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
