import { useEffect, useState, type KeyboardEvent } from 'react'

type TodoItem = {
  id: string
  text: string
  done: boolean
}

const storageKey = 'orvex.todo.items.v1'

function TodoWindow() {
  const [items, setItems] = useState<TodoItem[]>([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as TodoItem[]
      if (Array.isArray(parsed)) {
        setItems(parsed.filter((item) => typeof item.text === 'string'))
      }
    } catch (error) {
      console.warn('Failed to load todo items', error)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(items))
  }, [items])

  const completedCount = items.filter((item) => item.done).length
  const remainingCount = items.length - completedCount

  function addItem() {
    const nextText = draft.trim()
    if (!nextText) {
      return
    }

    setItems((current) => [
      {
        id: createId(),
        text: nextText,
        done: false,
      },
      ...current,
    ])
    setDraft('')
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    addItem()
  }

  function toggleItem(itemId: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              done: !item.done,
            }
          : item,
      ),
    )
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId))
  }

  function clearCompleted() {
    setItems((current) => current.filter((item) => !item.done))
  }

  return (
    <div
      className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(244,114,54,0.18),_transparent_28%),linear-gradient(180deg,_#fffaf5_0%,_#fff3e8_100%)] text-[#2f241d]"
      style={{
        colorScheme: 'light',
        fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-[720px] flex-col px-6 py-6">
        <div className="rounded-[28px] border border-[#f1d2bb] bg-[rgba(255,252,248,0.92)] p-6 shadow-[0_24px_60px_rgba(154,52,18,0.12)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b75a2f]">
                Quick Capture
              </p>
              <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#221711]">
                待办清单
              </h1>
              <p className="mt-2 text-[14px] leading-6 text-[#7a5a49]">
                灵光一闪就先记下来，按一次热键呼出，再按一次收起。
              </p>
            </div>

            <div className="rounded-[22px] border border-[#efc8af] bg-[#fff5ec] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#b77756]">Remaining</p>
              <p className="mt-2 text-[32px] font-semibold leading-none text-[#241811]">
                {remainingCount}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-[#f0d8c6] bg-white/80 p-4 shadow-[0_14px_30px_rgba(119,69,41,0.08)] sm:flex-row">
            <input
              type="text"
              value={draft}
              placeholder="新任务，回车也可以直接添加"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
              className="h-12 flex-1 rounded-[18px] border border-[#ecd8cb] bg-white px-4 text-[14px] text-[#2f241d] outline-none transition placeholder:text-[#b49b8c] focus:border-[#cf8052] focus:ring-2 focus:ring-[#f6c6aa]"
            />
            <button
              type="button"
              onClick={addItem}
              className="h-12 rounded-[18px] bg-[#2f241d] px-5 text-[14px] font-medium text-white transition hover:bg-[#1f1713]"
            >
              收进清单
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 text-[13px] text-[#8d6d5b]">
            <span>共 {items.length} 项，已完成 {completedCount} 项</span>
            <button
              type="button"
              onClick={clearCompleted}
              disabled={completedCount === 0}
              className="rounded-full border border-[#e9cdbc] px-3 py-1.5 transition hover:bg-[#fff6ef] disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空已完成
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {items.length > 0 ? (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-fade-up flex items-center gap-3 rounded-[20px] border border-[#f0ddd0] bg-white/88 px-4 py-3 shadow-[0_14px_24px_rgba(120,72,43,0.08)]"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <button
                    type="button"
                    aria-pressed={item.done}
                    onClick={() => toggleItem(item.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition"
                    style={{
                      borderColor: item.done ? '#cf8052' : '#d9c1b1',
                      background: item.done ? '#cf8052' : '#ffffff',
                      color: '#ffffff',
                    }}
                  >
                    {item.done ? '✓' : ''}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[14px] leading-6"
                      style={{
                        color: item.done ? '#9a8476' : '#2f241d',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}
                    >
                      {item.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-full px-3 py-1.5 text-[12px] text-[#8a6a5d] transition hover:bg-[#f9efe8] hover:text-[#533a2d]"
                  >
                    删除
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#e8d0c0] bg-[rgba(255,255,255,0.7)] px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <p className="text-[15px] font-medium text-[#5f4639]">这里还空着</p>
                <p className="mt-2 text-[13px] leading-6 text-[#9d7d6c]">
                  想到什么就先记一笔，热键一呼即来，像贴在手边的小便笺。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default TodoWindow
