import { ROLE_URLS } from '../role'

/** 總覽頁：連到三個專用網址（畫面全中文） */
export function EntryChooser() {
  return (
    <div className="app-shell link-shell simple-shell">
      <div className="ambient" aria-hidden />
      <section className="link-card simple-card entry-chooser" aria-labelledby="entry-heading">
        <p className="brand">員工待辦</p>
        <h1 id="entry-heading">選擇入口</h1>
        <p className="section-lead">派工、恩德、阿勇分開進入，資料同步共用。</p>

        <div className="entry-zone">
          <p className="entry-zone-label">指派區</p>
          <a className="entry-btn entry-assistant" href={ROLE_URLS.dispatch}>
            <span className="entry-btn-label">派工</span>
            <span className="entry-btn-sub">新增／指派給恩德或阿勇</span>
          </a>
        </div>

        <div className="entry-zone">
          <p className="entry-zone-label">個人區（只勾完成）</p>
          <div className="entry-grid entry-grid-workers">
            <a className="entry-btn entry-ende" href={ROLE_URLS.ende}>
              <span className="entry-btn-label">恩德</span>
              <span className="entry-btn-sub">只看派給恩德的任務</span>
            </a>
            <a className="entry-btn entry-ayong" href={ROLE_URLS.ayong}>
              <span className="entry-btn-label">阿勇</span>
              <span className="entry-btn-sub">只看派給阿勇的任務</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
