import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WindowFrame } from '../components/WindowFrame'
import { useLauncherState } from '../hooks/useLauncherState'
import { toAssetUrl } from '../lib/tauri'
import type { LauncherItem } from '../types/launcher'

function LauncherPanel() {
  const { launcherState, storageDirectory, launchItem } = useLauncherState()
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [query, setQuery] = useState('')
  const [launchingItemId, setLaunchingItemId] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme
    const previousBodyBackground = document.body.style.background

    document.documentElement.dataset.theme = 'light'
    document.body.style.background = 'rgba(255,255,255,0.92)'

    return () => {
      if (previousTheme) {
        document.documentElement.dataset.theme = previousTheme
      } else {
        delete document.documentElement.dataset.theme
      }
      document.body.style.background = previousBodyBackground
    }
  }, [])

  const categories = useMemo(() => {
    const base = launcherState?.categories ?? []
    const items = launcherState?.items ?? []
    return [
      {
        id: 'all',
        title: '全部',
        count: items.length,
      },
      ...base.map((category) => ({
        id: category.id,
        title: category.title,
        count: items.filter((item) => item.categoryId === category.id).length,
      })),
    ]
  }, [launcherState])

  const activeCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0]

  const visibleItems = useMemo(() => {
    const source = launcherState?.items ?? []
    return source.filter((item) => {
      const inCategory =
        selectedCategoryId === 'all' || item.categoryId === selectedCategoryId
      const inQuery =
        deferredQuery.length === 0 ||
        [item.name, item.alias, item.summary, item.path].some((field) =>
          field.toLowerCase().includes(deferredQuery),
        )
      return inCategory && inQuery
    })
  }, [deferredQuery, launcherState, selectedCategoryId])

  async function handleLaunch(item: LauncherItem) {
    setLaunchingItemId(item.id)
    try {
      await launchItem(item.id)
      const panelWindow = getCurrentWindow()
      await panelWindow.hide()
    } finally {
      setLaunchingItemId('')
    }
  }

  const timeText = useClock()

  return (
    <WindowFrame title="Orvex 面板" subtitle="快速启动" compact variant="light">
      <div className="h-[calc(100vh-44px)] w-full overflow-hidden bg-[rgba(255,255,255,0.88)] font-[system-ui] text-slate-900 backdrop-blur-[20px]">
        <div className="grid h-full grid-cols-[160px_minmax(0,1fr)]">
          <aside className="flex h-full flex-col border-r border-slate-200/70 bg-white/35 px-3 py-4">
            <div className="space-y-1">
              {categories.map((category) => {
                const isActive = category.id === activeCategory.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={[
                      'relative flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-left text-[13px] transition',
                      isActive
                        ? ''
                        : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900',
                    ].join(' ')}
                    style={
                      isActive
                        ? {
                            backgroundColor: '#f0f0f0',
                            color: '#111111',
                          }
                        : undefined
                    }
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {isActive ? (
                      <span
                        className="absolute left-0 top-1.5 h-6 w-[3px] rounded-r-full"
                        style={{ backgroundColor: '#333333' }}
                      />
                    ) : null}
                    <span className="truncate pl-1">{category.title}</span>
                    <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {category.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-auto px-4 pt-4">
              <div className="text-left text-[28px] font-light text-[#999999]">
                {timeText}
              </div>
            </div>
          </aside>

          <main className="flex h-full flex-col px-5 py-4">
            <div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索或直接输入..."
                className="w-full rounded-[8px] border-none bg-[#f5f5f5] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-[#f5f5f5]"
              />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group flex h-20 flex-col items-center justify-start rounded-[12px] px-2 py-2 transition hover:-translate-y-0.5 hover:bg-slate-100/95"
                    onClick={() => void handleLaunch(item)}
                  >
                    <PanelIcon item={item} storageDirectory={storageDirectory} />
                    <span className="mt-2 line-clamp-2 text-center text-[12px] leading-4 text-slate-700">
                      {launchingItemId === item.id ? '启动中...' : item.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </WindowFrame>
  )
}

function PanelIcon({
  item,
  storageDirectory,
}: {
  item: LauncherItem
  storageDirectory: string
}) {
  const iconUrl =
    item.iconPath && storageDirectory
      ? toAssetUrl(
          `${storageDirectory.replace(/[\\/]+$/, '')}\\${item.iconPath.replace(/\//g, '\\')}`,
        )
      : null

  if (iconUrl) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
        <img src={iconUrl} alt="" className="h-9 w-9 object-contain" draggable={false} />
      </div>
    )
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-slate-900 text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
      {item.monogram}
    </div>
  )
}

function useClock() {
  const [time, setTime] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(formatClock(new Date()))
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return time
}

function formatClock(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export default LauncherPanel
