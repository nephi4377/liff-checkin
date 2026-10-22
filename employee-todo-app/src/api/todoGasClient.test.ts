import { describe, expect, it, vi } from 'vitest'
import { personaToBoard } from './board'
import {
  postProjectConsole,
  todoAdd,
  todoDelete,
  todoList,
  todoReorder,
  todoUpdate,
  TodoApiError,
} from './todoGasClient'

const sampleListBody = {
  success: true,
  tasks: [{ id: 't1', title: '測試', assigneeId: 'ops-ende', category: 'todo', order: 0, completed: false, createdAt: 1, urgency: 'normal' }],
  workers: [{ id: 'ops-ende', name: '恩德', order: 0 }],
  officeTasks: [],
  deletedIds: [] as string[],
  updatedAt: 1730000000000,
  assigners: ['豪哥'],
}

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch
}

describe('personaToBoard', () => {
  it('maps paigong / ende / ayong personas', () => {
    expect(personaToBoard('assistant')).toBe('paigong')
    expect(personaToBoard('ops-ende')).toBe('ende')
    expect(personaToBoard('ops-ayong')).toBe('ayong')
    expect(personaToBoard('hub')).toBeNull()
  })
})

describe('todoGasClient', () => {
  it('postProjectConsole reads top-level fields (not nested data)', async () => {
    const fetchMock = mockFetch(sampleListBody)
    const data = await postProjectConsole(
      { action: 'todo_list', board: 'paigong' },
      fetchMock,
    )
    expect(data).toMatchObject({
      updatedAt: 1730000000000,
      tasks: sampleListBody.tasks,
      assigners: ['豪哥'],
    })
    expect((data as { success?: boolean }).success).toBeUndefined()
  })

  it('todoList sends liff_id_token', async () => {
    const fetchMock = mockFetch(sampleListBody)
    await todoList('ende', { liff_id_token: 'list-tok' }, fetchMock)
    const init = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const parsed = JSON.parse(init.body as string)
    expect(parsed.action).toBe('todo_list')
    expect(parsed.board).toBe('ende')
    expect(parsed.liff_id_token).toBe('list-tok')
  })

  it('todoAdd posts task at top-level success response', async () => {
    const fetchMock = mockFetch({
      success: true,
      ...sampleListBody,
      updatedAt: 1730000000001,
    })
    const task = sampleListBody.tasks[0]
    const out = await todoAdd('paigong', task, { liff_id_token: 'w' }, fetchMock)
    expect(out.updatedAt).toBe(1730000000001)
    const parsed = JSON.parse(
      ((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
        .body as string,
    )
    expect(parsed.action).toBe('todo_add')
    expect(parsed.task.id).toBe('t1')
  })

  it('todoUpdate posts task body', async () => {
    const fetchMock = mockFetch({ success: true, ...sampleListBody })
    const task = { ...sampleListBody.tasks[0], completed: true }
    await todoUpdate('ayong', task, { liff_id_token: 'tok' }, fetchMock)
    const parsed = JSON.parse(
      ((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
        .body as string,
    )
    expect(parsed.action).toBe('todo_update')
    expect(parsed.task.completed).toBe(true)
  })

  it('todoDelete includes id and liff_id_token', async () => {
    const fetchMock = mockFetch({ success: true, ...sampleListBody })
    await todoDelete('ende', 'task-1', { liff_id_token: 'tok-demo' }, fetchMock)
    const parsed = JSON.parse(
      ((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
        .body as string,
    )
    expect(parsed.action).toBe('todo_delete')
    expect(parsed.id).toBe('task-1')
    expect(parsed.liff_id_token).toBe('tok-demo')
  })

  it('todoReorder sends orders: [{ id, order }]', async () => {
    const fetchMock = mockFetch({ success: true, ...sampleListBody })
    await todoReorder(
      'paigong',
      {
        assigneeId: 'ops-ende',
        category: 'priority',
        orders: [{ id: 'a', order: 0 }, { id: 'b', order: 1 }],
      },
      { liff_id_token: 'x' },
      fetchMock,
    )
    const parsed = JSON.parse(
      ((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
        .body as string,
    )
    expect(parsed.action).toBe('todo_reorder')
    expect(parsed.orders).toEqual([
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
    ])
    expect(parsed.orderedIds).toBeUndefined()
  })

  it('throws TodoApiError on success:false', async () => {
    const fetchMock = mockFetch({ success: false, message: '缺少權限' })
    await expect(todoList('ayong', { liff_id_token: '' }, fetchMock)).rejects.toThrow(
      '缺少權限',
    )
  })

  it('throws on non-JSON body', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'not json',
    })) as unknown as typeof fetch
    await expect(
      postProjectConsole({ action: 'todo_list' }, fetchMock),
    ).rejects.toBeInstanceOf(TodoApiError)
  })

  it('throws on HTTP error', async () => {
    const fetchMock = mockFetch({ success: true }, false, 500)
    await expect(
      postProjectConsole({ action: 'todo_list' }, fetchMock),
    ).rejects.toThrow('HTTP 500')
  })
})
