import { useEffect, useMemo, useState } from 'react'
import { AssistantPanel } from './components/AssistantPanel'
import { EntryChooser } from './components/EntryChooser'
import { FirstRunLink } from './components/FirstRunLink'
import { SimpleAssignedList } from './components/SimpleAssignedList'
import { useTasks } from './hooks/useTasks'
import { linkAssistant, loadProfile } from './profile'
import { isWorkerPersona, ROLE_URLS, resolvePersona } from './role'
import type { AssistantProfile } from './types'

export default function App() {
  const {
    workers,
    tasks,
    assigners,
    syncStatus,
    addTask,
    addWorker,
    updateWorker,
    removeWorker,
    toggleComplete,
    reorder,
    moveCategory,
    updateTitle,
    updateCaseNo,
    updateDetail,
    updateWorkerNote,
    updateAssigner,
    addAssigner,
    updateDueDate,
    updateUrgency,
    trashTask,
    restoreTask,
    togglePin,
    resetDemo,
  } = useTasks()

  const syncLabel =
    syncStatus === 'syncing'
      ? '同步中…'
      : syncStatus === 'ok'
        ? '已同步'
        : syncStatus === 'offline'
          ? '離線'
          : syncStatus === 'error'
            ? '同步失敗'
            : ''

  const [profile, setProfile] = useState<AssistantProfile | null>(() => loadProfile())
  const [persona] = useState(() => resolvePersona())
  const [showMore, setShowMore] = useState(false)

  const isWorker = isWorkerPersona(persona)
  const workerId = isWorker ? persona : null
  const workerName =
    (workerId && workers.find((w) => w.id === workerId)?.name) ||
    (workerId === 'ops-ende'
      ? '恩德'
      : workerId === 'ops-ayong'
        ? '阿勇'
        : workerId || '')

  useEffect(() => {
    if (persona === 'hub') document.title = '員工待辦'
    else if (persona === 'assistant') document.title = '派工'
    else document.title = workerName || '工務'
  }, [persona, workerName])

  const myTasks = useMemo(
    () =>
      workerId
        ? tasks.filter((t) => t.assigneeId === workerId && !t.trashedAt)
        : [],
    [tasks, workerId],
  )

  // —— Hub: links ——
  if (persona === 'hub') {
    return <EntryChooser workers={workers} />
  }

  // —— 派工 site ——
  if (persona === 'assistant') {
    if (!profile) {
      return (
        <FirstRunLink
          onLinked={(displayName, pin) => {
            setProfile(linkAssistant(displayName, pin))
          }}
        />
      )
    }

    return (
      <div className="app-shell simple-shell dispatch-zone">
        <div className="ambient" aria-hidden />

        <header className="top-bar">
          <div className="top-bar-main">
            <span className="person-title">派工</span>
            <span className="top-who">
              <span className="zone-badge">指派區</span>
              {syncLabel ? (
                <span
                  className={`sync-pill sync-${syncStatus}`}
                  title="各手機共用同一份清單"
                >
                  {syncLabel}
                </span>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            className="btn-ghost top-more"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            ⋯
          </button>
        </header>

        {showMore ? (
          <div className="more-menu">
            <a className="more-menu-link" href={ROLE_URLS.hub}>
              回總覽
            </a>
            <button
              type="button"
              onClick={() => {
                setShowMore(false)
                resetDemo()
              }}
            >
              重載今日派工
            </button>
          </div>
        ) : null}

        <main>
          <AssistantPanel
            workers={workers}
            tasks={tasks}
            assigners={assigners}
            onAdd={addTask}
            onAddWorker={addWorker}
            onUpdateWorker={updateWorker}
            onRemoveWorker={removeWorker}
            onToggle={toggleComplete}
            onReorder={reorder}
            onMoveCategory={moveCategory}
            onUpdateTitle={updateTitle}
            onUpdateCaseNo={updateCaseNo}
            onUpdateDetail={updateDetail}
            onUpdateAssigner={updateAssigner}
            onAddAssigner={addAssigner}
            onUpdateDueDate={updateDueDate}
            onUpdateUrgency={updateUrgency}
            onTrash={trashTask}
            onRestore={restoreTask}
            onTogglePin={togglePin}
          />
        </main>
      </div>
    )
  }

  // —— 工務專屬頁（恩德／阿勇／自訂） ——
  if (isWorker && workerId) {
    return (
      <div className="app-shell simple-shell person-app">
        <div className="ambient" aria-hidden />
        <header className="top-bar">
          <div className="top-bar-main">
            <p className="person-title">{workerName || '工務'}</p>
            {syncLabel ? (
              <span className={`sync-pill sync-${syncStatus}`}>{syncLabel}</span>
            ) : null}
          </div>
        </header>
        <main>
          <SimpleAssignedList
            workerName={workerName || '工務'}
            tasks={myTasks}
            onToggle={toggleComplete}
            onUpdateWorkerNote={updateWorkerNote}
          />
        </main>
      </div>
    )
  }

  return <EntryChooser workers={workers} />
}
