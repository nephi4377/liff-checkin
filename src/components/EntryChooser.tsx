import { ROLE_URLS } from '../role'
import type { Worker } from '../types'
import { workerLocalHref } from '../workers'

/** 總覽頁：派工＋各工務入口 */
export function EntryChooser({ workers = [] }: { workers?: Worker[] }) {
  const list =
    workers.length > 0
      ? workers
      : [
          { id: 'ops-ende', name: '恩德' },
          { id: 'ops-ayong', name: '阿勇' },
        ]

  return (
    <div className="app-shell link-shell simple-shell">
      <div className="ambient" aria-hidden />
      <section className="link-card simple-card entry-chooser" aria-labelledby="entry-heading">
        <p className="brand">員工待辦</p>
        <h1 id="entry-heading">選擇入口</h1>
        <p className="section-lead">派工與各工務分開進入，資料同步共用。</p>

        <div className="entry-zone">
          <p className="entry-zone-label">指派區</p>
          <a className="entry-btn entry-assistant" href={ROLE_URLS.dispatch}>
            <span className="entry-btn-label">派工</span>
            <span className="entry-btn-sub">新增／指派給工務</span>
          </a>
        </div>

        <div className="entry-zone">
          <p className="entry-zone-label">個人區（只勾完成）</p>
          <div className="entry-grid entry-grid-workers">
            {list.map((w) => (
              <a
                key={w.id}
                className={`entry-btn ${w.id === 'ops-ende' ? 'entry-ende' : w.id === 'ops-ayong' ? 'entry-ayong' : 'entry-worker'}`}
                href={workerLocalHref(w.id)}
              >
                <span className="entry-btn-label">{w.name}</span>
                <span className="entry-btn-sub">只看派給{w.name}的任務</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
