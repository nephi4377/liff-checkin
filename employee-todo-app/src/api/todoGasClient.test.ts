import { describe, expect, it, vi } from 'vitest'
import { personaToBoard } from './board'
import { postProjectConsole, todoDelete, todoList, todoReorder } from './todoGasClient'

function mockFetch(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
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
  it('postProjectConsole sends action JSON as text/plain body', async () => {
    const fetchMock = mockFetch({
      success: true,
      data: { tasks: [], workers: [], updatedAt: 1 },
    })
    const data = await postProjectConsole(
      { action: 'todo_list', board: 'paigong' },
      fetchMock,
    )
    expect(data).toMatchObject({ updatedAt: 1 })
    expect(fetchMock).toHaveBeenCalledOnce()
    const init = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'text/plain;charset=utf-8',
    })
    const parsed = JSON.parse(init.body as string)
    expect(parsed.action).toBe('todo_list')
    expect(parsed.board).toBe('paigong')
  })

  it('todoDelete includes liff_id_token on write', async () => {
    const fetchMock = mockFetch({ success: true, data: null })
    await todoDelete('ende', 'task-1', { liff_id_token: 'tok-demo' }, fetchMock)
    const init = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const parsed = JSON.parse(init.body as string)
    expect(parsed.action).toBe('todo_delete')
    expect(parsed.board).toBe('ende')
    expect(parsed.id).toBe('task-1')
    expect(parsed.liff_id_token).toBe('tok-demo')
  })

  it('todoReorder sends orderedIds', async () => {
    const fetchMock = mockFetch({ success: true, data: null })
    await todoReorder(
      'paigong',
      {
        assigneeId: 'ops-ende',
        category: 'priority',
        orderedIds: ['a', 'b'],
      },
      { liff_id_token: 'x' },
      fetchMock,
    )
    const init = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const parsed = JSON.parse(init.body as string)
    expect(parsed.action).toBe('todo_reorder')
    expect(parsed.orderedIds).toEqual(['a', 'b'])
  })

  it('todoList throws on success:false', async () => {
    const fetchMock = mockFetch({ success: false, message: '缺少權限' })
    await expect(todoList('ayong', fetchMock)).rejects.toThrow('缺少權限')
  })
})
