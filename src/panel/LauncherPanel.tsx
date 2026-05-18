import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WindowFrame } from '../components/WindowFrame'
import { useLauncherState } from '../hooks/useLauncherState'
import { openSettingsWindow as openSettingsWindowCommand, toAssetUrl } from '../lib/tauri'
import type { Category, LauncherItem } from '../types/launcher'

type PanelCategory = Category & {
  count: number
  virtual?: boolean
}

type SidebarMenuState = {
  open: boolean
  x: number
  y: number
  category: PanelCategory | null
}

function LauncherPanel() {
  const {
    launcherState,
    settingsState,
    storageDirectory,
    launchItem,
    addCategory,
    addLauncherItemFromPath,
    editCategory,
    removeCategory,
  } = useLauncherState()
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState('')
  const [launchingItemId, setLaunchingItemId] = useState('')
  const [dragOverlayVisible, setDragOverlayVisible] = useState(false)
  const [dragOverIcons, setDragOverIcons] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [creatingCategoryTitle, setCreatingCategoryTitle] = useState('')
  const [renamingCategoryId, setRenamingCategoryId] = useState('')
  const [renamingCategoryTitle, setRenamingCategoryTitle] = useState('')
  const [submittingCategory, setSubmittingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [sidebarMenu, setSidebarMenu] = useState<SidebarMenuState>({
    open: false,
    x: 0,
    y: 0,
    category: null,
  })
  const categoryRailRef = useRef<HTMLElement | null>(null)
  const iconGridRef = useRef<HTMLDivElement | null>(null)
  const createCategoryInputRef = useRef<HTMLInputElement | null>(null)
  const renameCategoryInputRef = useRef<HTMLInputElement | null>(null)
  const renamingCategorySubmittingRef = useRef(false)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const backgroundImageUrl =
    settingsState?.backgroundType === 'image' && settingsState.backgroundImagePath
      ? toAssetUrl(settingsState.backgroundImagePath)
      : ''

  const theme = settingsState?.theme ?? 'light'
  const showIconTitles = settingsState?.showIconTitles ?? true
  const rootBackgroundOpacity = (settingsState?.backgroundOpacity ?? 88) / 100
  const sidebarOpacity = (settingsState?.cardOpacity ?? 92) / 100

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme
    const previousBodyBackground = document.body.style.background

    document.documentElement.dataset.theme = theme
    document.body.style.background =
      theme === 'dark'
        ? `rgba(15,23,42,${Math.max(rootBackgroundOpacity, 0.4)})`
        : `rgba(255,255,255,${Math.max(rootBackgroundOpacity, 0.4)})`

    return () => {
      if (previousTheme) {
        document.documentElement.dataset.theme = previousTheme
      } else {
        delete document.documentElement.dataset.theme
      }
      document.body.style.background = previousBodyBackground
    }
  }, [rootBackgroundOpacity, theme])

  useEffect(() => {
    if (!creatingCategory) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createCategoryInputRef.current?.focus()
      createCategoryInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [creatingCategory])

  useEffect(() => {
    if (!renamingCategoryId) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      renameCategoryInputRef.current?.focus()
      renameCategoryInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [renamingCategoryId])

  useEffect(() => {
    if (!sidebarMenu.open) {
      return
    }

    const close = () => {
      setSidebarMenu({ open: false, x: 0, y: 0, category: null })
    }
    window.addEventListener('click', close)

    return () => {
      window.removeEventListener('click', close)
    }
  }, [sidebarMenu.open])

  useEffect(() => {
    if (!flash) {
      return
    }

    const timer = window.setTimeout(() => setFlash(''), 2200)
    return () => window.clearTimeout(timer)
  }, [flash])

  const categories = useMemo(() => {
    const base = (launcherState?.categories ?? []).filter((category) => category.id !== 'all')
    const items = launcherState?.items ?? []
    const allCategory: PanelCategory = {
      id: 'all',
      title: '全部',
      caption: '',
      description: '',
      accent: '#333333',
      sort: -1,
      count: items.length,
      virtual: true,
    }

    return [
      allCategory,
      ...base.map((category) => ({
        ...category,
        count: items.filter((item) => item.categoryId === category.id).length,
      })),
    ]
  }, [launcherState])

  const selectedCategoryExists = categories.some(
    (category) => category.id === selectedCategoryId,
  )
  const effectiveCategoryId =
    selectedCategoryId === 'all' || selectedCategoryExists ? selectedCategoryId : 'all'
  const activeCategory =
    categories.find((category) => category.id === effectiveCategoryId) ?? categories[0]

  useEffect(() => {
    if (
      renamingCategoryId &&
      !(launcherState?.categories ?? []).some((category) => category.id === renamingCategoryId)
    ) {
      cancelRenamingCategory()
    }
  }, [launcherState, renamingCategoryId])

  const visibleItems = useMemo(() => {
    const source = launcherState?.items ?? []
    const filtered = source.filter((item) => {
      const inCategory =
        effectiveCategoryId === 'all' || item.categoryId === effectiveCategoryId
      const inQuery =
        deferredQuery.length === 0 ||
        [item.name, item.alias, item.summary, item.path].some((field) =>
          field.toLowerCase().includes(deferredQuery),
        )
      return inCategory && inQuery
    })

    const sortMode = settingsState?.sortMode ?? 'custom'
    if (sortMode === 'usage') {
      return [...filtered].sort((left, right) => right.launchCount - left.launchCount)
    }

    if (sortMode === 'name') {
      return [...filtered].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    }

    return filtered
  }, [deferredQuery, effectiveCategoryId, launcherState, settingsState?.sortMode])

  useEffect(() => {
    let isMounted = true
    let lastOverIcons = false

    async function bindDragDrop() {
      const panelWindow = getCurrentWindow()
      const unlisten = await panelWindow.onDragDropEvent(async (event) => {
        if (!isMounted) {
          return
        }

        if (event.payload.type === 'enter') {
          setDragOverlayVisible(true)
        }

        if (event.payload.type === 'leave') {
          lastOverIcons = false
          setDragOverlayVisible(false)
          setDragOverIcons(false)
          return
        }

        if (event.payload.type === 'over') {
          if (!iconGridRef.current) {
            return
          }

          const rect = iconGridRef.current.getBoundingClientRect()
          const isOverIcons =
            event.payload.position.x >= rect.left &&
            event.payload.position.x <= rect.right &&
            event.payload.position.y >= rect.top &&
            event.payload.position.y <= rect.bottom

          if (lastOverIcons !== isOverIcons) {
            lastOverIcons = isOverIcons
            setDragOverIcons(isOverIcons)
          }
          return
        }

        if (event.payload.type === 'drop') {
          setDragOverlayVisible(false)
          setDragOverIcons(false)
          lastOverIcons = false

          if (!iconGridRef.current) {
            return
          }

          const rect = iconGridRef.current.getBoundingClientRect()
          const droppedIntoIcons =
            event.payload.position.x >= rect.left &&
            event.payload.position.x <= rect.right &&
            event.payload.position.y >= rect.top &&
            event.payload.position.y <= rect.bottom

          if (!droppedIntoIcons) {
            return
          }

          const supportedPaths = event.payload.paths.filter((path) => {
            const lower = path.toLowerCase()
            return (
              lower.endsWith('.exe') ||
              lower.endsWith('.lnk') ||
              lower.endsWith('.bat') ||
              lower.endsWith('.cmd') ||
              !lower.includes('.')
            )
          })

          if (supportedPaths.length === 0) {
            setFlash('只支持拖入 exe、lnk、bat、cmd 或文件夹')
            return
          }

          const targetCategoryId =
            effectiveCategoryId === 'all'
              ? categories.find((category) => category.id !== 'all')?.id ?? 'all'
              : effectiveCategoryId

          for (const path of supportedPaths) {
            try {
              await addLauncherItemFromPath({
                categoryId: targetCategoryId,
                path,
              })
            } catch (caughtError) {
              setFlash(
                caughtError instanceof Error
                  ? `拖入失败：${caughtError.message}`
                  : '拖入创建启动项失败',
              )
              return
            }
          }

        }
      })

      return unlisten
    }

    let cleanup: (() => void) | undefined

    void bindDragDrop().then((unlisten) => {
      cleanup = unlisten
    })

    return () => {
      isMounted = false
      cleanup?.()
    }
  }, [addLauncherItemFromPath, categories, effectiveCategoryId])

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

  function closeSidebarMenu() {
    setSidebarMenu({ open: false, x: 0, y: 0, category: null })
  }

  function cancelCreateCategory() {
    setCreatingCategory(false)
    setCreatingCategoryTitle('')
  }

  function cancelRenamingCategory() {
    setRenamingCategoryId('')
    setRenamingCategoryTitle('')
  }

  function handleSidebarContextMenuCapture(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault()
  }

  function handleSidebarContextMenu(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null
    if (!target) {
      return
    }

    if (target.closest('[data-category-item="true"]')) {
      return
    }

    if (target.closest('[data-category-create="true"]')) {
      return
    }

    closeSidebarMenu()
    setSidebarMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      category: null,
    })
  }

  function handleCategoryContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    category: PanelCategory,
  ) {
    if (category.virtual) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSidebarMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      category,
    })
  }

  function openCreateCategoryInput() {
    closeSidebarMenu()
    cancelRenamingCategory()
    setCreatingCategoryTitle('')
    setCreatingCategory(true)
  }

  function openRenameCategoryInput(category: PanelCategory) {
    if (category.virtual) {
      return
    }

    closeSidebarMenu()
    cancelCreateCategory()
    setSelectedCategoryId(category.id)
    setRenamingCategoryId(category.id)
    setRenamingCategoryTitle(category.title)
  }

  async function handleCreateCategoryConfirm() {
    const title = creatingCategoryTitle.trim()
    if (!title || submittingCategory) {
      cancelCreateCategory()
      return
    }

    setSubmittingCategory(true)

    try {
      const previousIds = new Set((launcherState?.categories ?? []).map((category) => category.id))
      const nextState = await addCategory({
        title,
        caption: '自定义分类',
        description: '',
        accent: '#333333',
      })
      const createdCategory =
        nextState.categories.find((category) => !previousIds.has(category.id)) ??
        nextState.categories[nextState.categories.length - 1]

      if (createdCategory) {
        setSelectedCategoryId(createdCategory.id)
      }

      cancelCreateCategory()
    } finally {
      setSubmittingCategory(false)
    }
  }

  async function handleRenameCategoryConfirm() {
    if (!renamingCategoryId || renamingCategorySubmittingRef.current) {
      return
    }

    const category = (launcherState?.categories ?? []).find(
      (entry) => entry.id === renamingCategoryId,
    )
    if (!category) {
      cancelRenamingCategory()
      return
    }

    const title = renamingCategoryTitle.trim()
    if (!title || title === category.title) {
      cancelRenamingCategory()
      return
    }

    renamingCategorySubmittingRef.current = true
    setEditingCategoryId(category.id)

    try {
      await editCategory({
        id: category.id,
        title,
        caption: category.caption,
        description: category.description,
        accent: category.accent,
      })
      cancelRenamingCategory()
    } finally {
      renamingCategorySubmittingRef.current = false
      setEditingCategoryId('')
    }
  }

  async function handleDeleteCategory(category: PanelCategory) {
    if (category.virtual) {
      return
    }

    closeSidebarMenu()
    cancelRenamingCategory()
    await removeCategory(category.id)

    if (selectedCategoryId === category.id) {
      setSelectedCategoryId('all')
    }
  }

  function handleCreateCategoryKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleCreateCategoryConfirm()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelCreateCategory()
    }
  }

  function handleRenameCategoryKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleRenameCategoryConfirm()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRenamingCategory()
    }
  }

  const timeText = useClock()

  return (
    <WindowFrame
      title="Orvex 面板"
      subtitle="快速启动"
      compact
      variant={theme}
      headerLeftAddon={
        <SettingsEntryButton
          onClick={() => {
            void openSettingsWindowCommand().catch((error) => {
              setFlash(error instanceof Error ? error.message : '打开设置窗口失败')
            })
          }}
        />
      }
    >
      <div
        className={[
          'relative h-[calc(100vh-44px)] w-full overflow-hidden font-[system-ui] text-slate-900',
          settingsState?.frostedGlass === false ? '' : 'backdrop-blur-[20px]',
        ].join(' ')}
        style={{
          background:
            theme === 'dark'
              ? `rgba(15,23,42,${rootBackgroundOpacity})`
              : `rgba(255,255,255,${rootBackgroundOpacity})`,
          backgroundImage: backgroundImageUrl ? `url("${backgroundImageUrl}")` : undefined,
          backgroundSize: backgroundImageUrl ? 'cover' : undefined,
          backgroundPosition: backgroundImageUrl ? 'center' : undefined,
        }}
      >
        <div className="grid h-full grid-cols-[160px_minmax(0,1fr)]">
          <aside
            ref={categoryRailRef}
            className="flex h-full flex-col border-r border-slate-200/70 px-3 py-4"
            style={{
              background:
                theme === 'dark'
                  ? `rgba(15,23,42,${Math.max(sidebarOpacity - 0.24, 0.14)})`
                  : `rgba(255,255,255,${Math.max(sidebarOpacity - 0.24, 0.35)})`,
            }}
            onContextMenuCapture={handleSidebarContextMenuCapture}
            onContextMenu={handleSidebarContextMenu}
          >
            <div className="space-y-1">
              {categories.map((category) => {
                const isActive = category.id === activeCategory.id
                const isRenaming = renamingCategoryId === category.id
                const rowClass = [
                  'relative flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-left text-[13px] transition',
                  isActive || isRenaming
                    ? 'text-[#111111]'
                    : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900',
                ].join(' ')
                const rowStyle = isActive || isRenaming ? { backgroundColor: '#f0f0f0' } : undefined

                if (isRenaming) {
                  return (
                    <div
                      key={category.id}
                      data-category-item="true"
                      className={rowClass}
                      style={rowStyle}
                    >
                      <span
                        className="absolute left-0 top-1.5 h-6 w-[3px] rounded-r-full"
                        style={{ backgroundColor: '#333333' }}
                      />
                      <input
                        ref={renameCategoryInputRef}
                        value={renamingCategoryTitle}
                        onChange={(event) => setRenamingCategoryTitle(event.target.value)}
                        onKeyDown={handleRenameCategoryKeyDown}
                        onBlur={() => {
                          void handleRenameCategoryConfirm()
                        }}
                        disabled={editingCategoryId === category.id}
                        className="w-full bg-transparent pl-1 pr-2 text-[13px] text-[#111111] outline-none disabled:opacity-60"
                      />
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {category.count}
                      </span>
                    </div>
                  )
                }

                return (
                  <button
                    key={category.id}
                    type="button"
                    data-category-item="true"
                    className={rowClass}
                    style={rowStyle}
                    onClick={() => setSelectedCategoryId(category.id)}
                    onContextMenu={(event) => handleCategoryContextMenu(event, category)}
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

              {creatingCategory ? (
                <div
                  data-category-create="true"
                  className="relative flex h-9 w-full items-center rounded-[10px] bg-[#f0f0f0] px-3 text-[13px] text-[#111111]"
                >
                  <span
                    className="absolute left-0 top-1.5 h-6 w-[3px] rounded-r-full"
                    style={{ backgroundColor: '#333333' }}
                  />
                  <input
                    ref={createCategoryInputRef}
                    value={creatingCategoryTitle}
                    onChange={(event) => setCreatingCategoryTitle(event.target.value)}
                    onKeyDown={handleCreateCategoryKeyDown}
                    onBlur={() => {
                      if (!submittingCategory) {
                        cancelCreateCategory()
                      }
                    }}
                    disabled={submittingCategory}
                    placeholder="输入分类名称"
                    className="w-full bg-transparent pl-1 text-[13px] text-[#111111] outline-none placeholder:text-slate-400 disabled:opacity-60"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-auto px-4 pt-4">
              <div className="text-left text-[28px] font-light text-[#999999]">{timeText}</div>
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

            {flash ? (
              <div className="mt-3 rounded-[10px] bg-slate-900 px-3 py-2 text-[12px] text-white/90">
                {flash}
              </div>
            ) : null}

            <div className="relative mt-4 min-h-0 flex-1">
              <div
                ref={iconGridRef}
                className={[
                  'h-full overflow-y-auto rounded-[12px] pr-1 transition',
                  dragOverIcons ? 'bg-slate-100/85' : '',
                ].join(' ')}
              >
                <div className="grid min-h-full auto-rows-max content-start grid-cols-[repeat(auto-fill,minmax(80px,1fr))] items-start gap-3 rounded-[12px] border border-transparent p-1 transition">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="group flex min-h-[96px] flex-col items-center justify-start rounded-[12px] px-2 py-2 transition hover:-translate-y-0.5 hover:bg-slate-100/95"
                      onClick={() => void handleLaunch(item)}
                    >
                      <PanelIcon item={item} storageDirectory={storageDirectory} />
                      {showIconTitles ? (
                        <span className="mt-2 max-w-full whitespace-normal break-all text-center text-[12px] leading-4 text-slate-700">
                          {launchingItemId === item.id ? '启动中...' : item.name}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              {dragOverlayVisible ? (
                <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[12px] bg-white/40 backdrop-blur-[2px]">
                  <div className="rounded-[16px] border border-slate-300/80 bg-white/92 px-5 py-4 text-center shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
                    <p className="text-[15px] font-semibold text-slate-900">
                      拖到这里即可添加启动项
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      支持 exe、lnk、bat、cmd 和文件夹
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </main>
        </div>

        {sidebarMenu.open ? (
          <ContextMenu x={sidebarMenu.x} y={sidebarMenu.y}>
            {sidebarMenu.category ? (
              <>
                <ContextMenuItem
                  label="重命名"
                  onClick={() => openRenameCategoryInput(sidebarMenu.category!)}
                />
                <ContextMenuItem
                  label="删除"
                  danger
                  onClick={() => {
                    void handleDeleteCategory(sidebarMenu.category!)
                  }}
                />
              </>
            ) : (
              <ContextMenuItem label="新建分类" onClick={openCreateCategoryInput} />
            )}
          </ContextMenu>
        ) : null}
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

function SettingsEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="打开设置"
      title="打开设置"
      onMouseDown={(event) => {
        event.stopPropagation()
      }}
      onClick={onClick}
      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(15,23,42,0.10)] bg-white/70 text-[#666666] transition hover:bg-[#f0f0f0] hover:text-[#111111]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.25" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.8a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.2-1.2a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.8a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4L6 4.7a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.8a1 1 0 0 1 1 1v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.7Z" />
      </svg>
    </button>
  )
}

function ContextMenu({
  x,
  y,
  children,
}: {
  x: number
  y: number
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      return
    }

    const { width, height } = menu.getBoundingClientRect()
    const margin = 8
    const left =
      x + width > window.innerWidth - margin ? Math.max(margin, x - width) : Math.max(margin, x)
    const top =
      y + height > window.innerHeight - margin
        ? Math.max(margin, y - height)
        : Math.max(margin, y)

    setPosition({ left, top })
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="animate-context-menu fixed z-[90] min-w-[132px] rounded-[8px] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {children}
    </div>
  )
}

function ContextMenuItem({
  label,
  danger = false,
  onClick,
}: {
  label: string
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex h-8 w-full items-center px-4 text-left text-[13px] transition-colors duration-100 hover:bg-[#f5f5f5]',
        danger ? 'text-[#e53935]' : 'text-[#333333]',
      ].join(' ')}
    >
      {label}
    </button>
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
