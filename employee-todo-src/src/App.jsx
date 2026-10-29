import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildAuthPayload, postTodoAction } from './api.js';
import { readDocumentCache, writeDocumentCache } from './documentCache.js';
import { ensureLiffSession, refreshIdToken } from './liffAuth.js';
import { resolveRoleFromLocation, roleLabel } from './role.js';
import { startSyncLoop } from './sync.js';
import './app.css';

export default function App() {
  const role = useMemo(() => resolveRoleFromLocation(), []);
  const [auth, setAuth] = useState({ ready: false, error: '', displayName: '', canWrite: false });
  const [doc, setDoc] = useState({ tasks: [], officeTasks: [], assigners: [], updatedAt: 0 });
  const [syncState, setSyncState] = useState({ status: 'idle', lastAt: 0, error: '' });
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('ops-ende');
  const [listAwaitingFetch, setListAwaitingFetch] = useState(true);

  useEffect(() => {
    const cached = readDocumentCache(role);
    if (cached) {
      setDoc({
        tasks: cached.tasks || [],
        officeTasks: cached.officeTasks || [],
        assigners: cached.assigners || [],
        updatedAt: cached.updatedAt || 0,
      });
      setListAwaitingFetch(false);
    }
  }, [role]);

  const loadDocument = useCallback(async () => {
    const token = await refreshIdToken();
    if (!token) throw new Error('請先 LINE 登入');
    const data = await postTodoAction(buildAuthPayload(token, 'todo_list'));
    const next = {
      tasks: data.tasks || [],
      officeTasks: data.officeTasks || [],
      assigners: data.assigners || [],
      updatedAt: data.updatedAt || 0,
    };
    setDoc(next);
    writeDocumentCache(role, next);
    setListAwaitingFetch(false);
    setSyncState({ status: 'ok', lastAt: Date.now(), error: '' });
  }, [role]);

  useEffect(() => {
    let cancelSync = () => {};
    (async () => {
      try {
        const session = await ensureLiffSession();
        if (session.pendingLogin) return;
        if (session.configMissing) {
          setAuth({
            ready: true,
            error: session.error || '',
            displayName: '',
            canWrite: false,
          });
          return;
        }
        if (session.preview) {
          setAuth({
            ready: true,
            error: '',
            displayName: session.displayName,
            canWrite: false,
            preview: true,
          });
          setListAwaitingFetch(false);
          return;
        }
        setAuth({
          ready: true,
          error: '',
          displayName: session.displayName,
          canWrite: true,
        });
        cancelSync = startSyncLoop(async () => {
          try {
            await loadDocument();
          } catch (e) {
            setSyncState({ status: 'error', lastAt: Date.now(), error: e.message || String(e) });
          }
        });
      } catch (e) {
        setAuth({ ready: true, error: e.message || String(e), displayName: '', canWrite: false });
      }
    })();
    return () => cancelSync();
  }, [loadDocument]);

  const visibleTasks = useMemo(() => {
    const list = (doc.tasks || []).filter((t) => !t.trashedAt);
    if (role === 'assistant' || role === 'hub') return list;
    return list.filter((t) => t.assigneeId === role);
  }, [doc.tasks, role]);

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const token = await refreshIdToken();
    await postTodoAction(
      buildAuthPayload(token, 'todo_add', {
        task: {
          title,
          assigneeId: newAssignee,
          category: 'todo',
          urgency: 'normal',
          order: visibleTasks.length,
        },
      }),
    );
    setNewTitle('');
    await loadDocument();
  };

  const toggleComplete = async (task) => {
    const token = await refreshIdToken();
    await postTodoAction(
      buildAuthPayload(token, 'todo_update', {
        task: { id: task.id, completed: !task.completed },
      }),
    );
    await loadDocument();
  };

  if (role === 'hub') {
    return (
      <div className="app">
        <header>
          <h1>員工待辦</h1>
          <p>請選擇視角（需 LINE 登入後同步）</p>
        </header>
        <nav className="hub-links">
          <a href="./?role=paigong">派工／行政</a>
          <a href="./?role=ende">恩德</a>
          <a href="./?role=ayong">阿勇</a>
        </nav>
        {auth.error && <p className="error">{auth.error}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>{roleLabel(role)}</h1>
        <p className="meta">
          {auth.displayName ? `你好，${auth.displayName}` : '載入中…'}
          {syncState.lastAt ? ` · 同步 ${new Date(syncState.lastAt).toLocaleTimeString()}` : ''}
        </p>
        {syncState.error && <p className="error">{syncState.error}</p>}
        {auth.error && <p className="error">{auth.error}</p>}
      </header>

      {role === 'assistant' && auth.canWrite && (
        <section className="composer">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="新增派工標題"
          />
          <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
            <option value="ops-ende">恩德</option>
            <option value="ops-ayong">阿勇</option>
          </select>
          <button type="button" onClick={addTask}>新增</button>
        </section>
      )}

      {listAwaitingFetch && visibleTasks.length === 0 && !auth.preview && (
        <div className="list-skeleton" aria-busy="true" aria-label="載入待辦">
          <div className="sk-row" />
          <div className="sk-row" />
          <div className="sk-row short" />
        </div>
      )}

      <ul className="task-list">
        {visibleTasks.map((t) => (
          <li key={t.id} className={t.completed ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={!!t.completed}
                disabled={!auth.canWrite}
                onChange={() => {
                  if (auth.canWrite) toggleComplete(t);
                }}
              />
              <span>
                {t.caseNo ? `${t.caseNo} ` : ''}
                {t.title}
                {t.assigner ? <em>（{t.assigner}）</em> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {doc.officeTasks?.length > 0 && (
        <section className="office">
          <h2>行政助理（唯讀，寫入 API 第二階段）</h2>
          <ul>
            {doc.officeTasks.map((o) => (
              <li key={o.id}>{o.title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
