import { useState, type FormEvent } from 'react'

interface FieldGateProps {
  workerName: string
  onUnlock: () => void
  onCancel: () => void
  expectedPin: string
}

/** Passcode before entering one person's interface */
export function FieldGate({
  workerName,
  onUnlock,
  onCancel,
  expectedPin,
}: FieldGateProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (pin === expectedPin) {
      setError('')
      onUnlock()
      return
    }
    setError('密碼不正確')
  }

  return (
    <div
      className="gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <form className="gate-card" onSubmit={handleSubmit}>
        <h2 id="gate-title">進入{workerName}的介面</h2>
        <p className="section-lead">
          輸入密碼後只會看到<strong>{workerName}</strong>的派工與工務。
        </p>
        <label className="field">
          <span>現場查看密碼</span>
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 8))
              setError('')
            }}
            inputMode="numeric"
            autoFocus
            autoComplete="off"
            placeholder="預設 2468"
          />
        </label>
        {error ? <p className="gate-error">{error}</p> : null}
        <div className="gate-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn-primary">
            進入{workerName}
          </button>
        </div>
      </form>
    </div>
  )
}
