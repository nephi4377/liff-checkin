import type { FormEvent } from 'react'
import { DEFAULT_DISPLAY_NAME, DEFAULT_FIELD_PIN } from '../profile'

interface FirstRunLinkProps {
  onLinked: (displayName: string, fieldPin: string) => void
}

export function FirstRunLink({ onLinked }: FirstRunLinkProps) {
  const handleStart = (e: FormEvent) => {
    e.preventDefault()
    onLinked(DEFAULT_DISPLAY_NAME, DEFAULT_FIELD_PIN)
  }

  return (
    <div className="app-shell link-shell simple-shell">
      <div className="ambient" aria-hidden />
      <section className="link-card simple-card" aria-labelledby="link-heading">
        <p className="brand">員工待辦</p>
        <h1 id="link-heading">開始派工</h1>
        <p className="section-lead">選恩德／阿勇 → 指派任務 → 他們勾完成。</p>

        <form className="assign-form" onSubmit={handleStart}>
          <button type="submit" className="btn-primary btn-xl">
            開始
          </button>
        </form>
      </section>
    </div>
  )
}
