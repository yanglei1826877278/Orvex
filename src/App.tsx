import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { toAssetUrl } from './lib/tauri'
import { WindowFrame } from './components/WindowFrame'
import { useLauncherState } from './hooks/useLauncherState'
import type {
  Category,
  CreateCategoryPayload,
  CreateLauncherItemPayload,
  LauncherItem,
  LauncherItemKind,
  ThemeMode,
  UpdateCategoryPayload,
  UpdateLauncherItemPayload,
} from './types/launcher'

const accentOptions = ['#0f172a', '#1d4ed8', '#059669', '#7c3aed', '#ea580c', '#dc2626']

const itemKinds: Array<{ value: LauncherItemKind; label: string }> = [
  { value: 'app', label: '应用' },
  { value: 'folder', label: '文件夹' },
  { value: 'workspace', label: '工作区' },
  { value: 'url', label: '网址' },
]

type SidebarMenuState = {
  open: boolean
  x: number
  y: number
  category: Category | null
}

type ItemMenuState = {
  open: boolean
  x: number
  y: number
  item: LauncherItem | null
}

function App() {
  const {
    launcherState,
    settingsState,
    storageDirectory,
    error,
    addCategory,
    addLauncherItemFromPath,
    addLauncherItem,
    editCategory,
    editLauncherItem,
    removeCategory,
    removeLauncherItem,
    launchItem,
    openItemLocation,
    updateSettings,
  } = useLauncherState()
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState('')
  const [openingLocationItemId, setOpeningLocationItemId] = useState('')
  const [showCategoryCreate, setShowCategoryCreate] = useState(false)
  const [showItemCreate, setShowItemCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [dragOverlayVisible, setDragOverlayVisible] = useState(false)
  const [dragOverIcons, setDragOverIcons] = useState(false)
  const [sidebarMenu, setSidebarMenu] = useState<SidebarMenuState>({
    open: false,
    x: 0,
    y: 0,
    category: null,
  })
  const [itemMenu, setItemMenu] = useState<ItemMenuState>({
    open: false,
    x: 0,
    y: 0,
    item: null,
  })
  const [categoryDraft, setCategoryDraft] = useState<CreateCategoryPayload>({
    title: '',
    caption: '',
    description: '',
    accent: '#1d4ed8',
  })
  const [itemDraft, setItemDraft] = useState<CreateLauncherItemPayload>({
    categoryId: 'dev',
    name: '',
    alias: '',
    kind: 'app',
    summary: '',
    path: '',
    hotkey: '',
    usage: '',
    monogram: '',
    accent: '#1d4ed8',
  })
  const [categoryEditDraft, setCategoryEditDraft] = useState<UpdateCategoryPayload | null>(null)
  const [itemEditDraft, setItemEditDraft] = useState<UpdateLauncherItemPayload | null>(null)
  const [submittingCategory, setSubmittingCategory] = useState(false)
  const [submittingItem, setSubmittingItem] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [editingItemId, setEditingItemId] = useState('')
  const [updatingTheme, setUpdatingTheme] = useState(false)

  const categoryRailRef = useRef<HTMLDivElement | null>(null)
  const iconGridRef = useRef<HTMLDivElement | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const theme = settingsState?.theme ?? 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const categories = useMemo(
    () => buildCategories(launcherState?.categories ?? [], launcherState?.items ?? []),
    [launcherState],
  )
  const selectedCategoryExists = categories.some(
    (category) => category.id === selectedCategoryId,
  )
  const effectiveCategoryId =
    selectedCategoryId === 'all' || selectedCategoryExists ? selectedCategoryId : 'all'

  const activeCategory =
    categories.find((category) => category.id === effectiveCategoryId) ?? categories[0]

  const visibleItems = useMemo(() => {
    const source = launcherState?.items ?? []

    return source.filter((item) => {
      const inCategory =
        effectiveCategoryId === 'all' || item.categoryId === effectiveCategoryId
      const inQuery =
        deferredQuery.length === 0 ||
        [item.name, item.summary, item.path, item.alias].some((field) =>
          field.toLowerCase().includes(deferredQuery),
        )

      return inCategory && inQuery
    })
  }, [deferredQuery, effectiveCategoryId, launcherState])

  useEffect(() => {
    if (!flash) {
      return
    }

    const timer = window.setTimeout(() => setFlash(''), 2200)
    return () => window.clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    if (!sidebarMenu.open && !itemMenu.open) {
      return
    }

    const close = () => {
      setSidebarMenu((state) => ({ ...state, open: false, category: null }))
      setItemMenu((state) => ({ ...state, open: false, item: null }))
    }
    window.addEventListener('click', close)

    return () => {
      window.removeEventListener('click', close)
    }
  }, [itemMenu.open, sidebarMenu.open])

  useEffect(() => {
    let isMounted = true
    let lastOverIcons = false

    async function bindDragDrop() {
      const appWindow = getCurrentWindow()
      const unlisten = await appWindow.onDragDropEvent(async (event) => {
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

          setFlash(`已导入 ${supportedPaths.length} 个启动项`)
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

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittingCategory(true)

    try {
      await addCategory(categoryDraft)
      setCategoryDraft({
        title: '',
        caption: '',
        description: '',
        accent: '#1d4ed8',
      })
      setShowCategoryCreate(false)
      setFlash('分类已创建')
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? caughtError.message : '新建分类失败')
    } finally {
      setSubmittingCategory(false)
    }
  }

  async function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittingItem(true)

    try {
      await addLauncherItem(itemDraft)
      setItemDraft((draft) => ({
        ...draft,
        name: '',
        alias: '',
        summary: '',
        path: '',
        hotkey: '',
        usage: '',
        monogram: '',
      }))
      setShowItemCreate(false)
      setFlash('启动项已创建')
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? caughtError.message : '新建启动项失败')
    } finally {
      setSubmittingItem(false)
    }
  }

  async function handleCategoryEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryEditDraft) {
      return
    }

    setEditingCategoryId(categoryEditDraft.id)
    try {
      await editCategory(categoryEditDraft)
      setCategoryEditDraft(null)
      setFlash('分类已更新')
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? caughtError.message : '更新分类失败')
    } finally {
      setEditingCategoryId('')
    }
  }

  async function handleItemEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!itemEditDraft) {
      return
    }

    setEditingItemId(itemEditDraft.id)
    try {
      await editLauncherItem(itemEditDraft)
      setItemEditDraft(null)
      setFlash('启动项已更新')
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? caughtError.message : '更新启动项失败')
    } finally {
      setEditingItemId('')
    }
  }

  async function handleLaunch(item: LauncherItem) {
    try {
      const result = await launchItem(item.id)
      setFlash(`${item.name}${result.detail}`)
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? `启动失败：${caughtError.message}` : '启动失败')
    }
  }

  async function handleOpenLocation(item: LauncherItem) {
    setOpeningLocationItemId(item.id)
    try {
      const result = await openItemLocation(item.id)
      setFlash(`${item.name}${result.detail}`)
    } catch (caughtError) {
      setFlash(
        caughtError instanceof Error
          ? `打开位置失败：${caughtError.message}`
          : '打开位置失败',
      )
    } finally {
      setOpeningLocationItemId('')
    }
  }

  async function handleDeleteCategory(category: Category) {
    try {
      await removeCategory(category.id)
      setFlash(`分类 ${category.title} 已删除`)
    } catch (caughtError) {
      setFlash(
        caughtError instanceof Error
          ? `删除分类失败：${caughtError.message}`
          : '删除分类失败',
      )
    }
  }

  async function handleDeleteItem(item: LauncherItem) {
    try {
      await removeLauncherItem(item.id)
      setFlash(`启动项 ${item.name} 已删除`)
    } catch (caughtError) {
      setFlash(
        caughtError instanceof Error
          ? `删除启动项失败：${caughtError.message}`
          : '删除启动项失败',
      )
    }
  }

  async function handleThemeChange(nextTheme: ThemeMode) {
    if (nextTheme === theme) {
      return
    }

    setUpdatingTheme(true)
    try {
      await updateSettings({ theme: nextTheme })
      setFlash(nextTheme === 'dark' ? '已切换到黑色主题' : '已切换到白色主题')
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? caughtError.message : '切换主题失败')
    } finally {
      setUpdatingTheme(false)
    }
  }

  function handleSidebarContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()
    setItemMenu((state) => ({ ...state, open: false, item: null }))

    const bounds = categoryRailRef.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }

    setSidebarMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      category: null,
    })
  }

  function handleCategoryContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    category: Category,
  ) {
    event.preventDefault()
    event.stopPropagation()
    setItemMenu((state) => ({ ...state, open: false, item: null }))
    setSidebarMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      category,
    })
  }

  function handleItemContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    item: LauncherItem,
  ) {
    event.preventDefault()
    event.stopPropagation()
    setSidebarMenu((state) => ({ ...state, open: false, category: null }))
    setItemMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      item,
    })
  }

  function openCreateCategorySheet() {
    setSidebarMenu({ open: false, x: 0, y: 0, category: null })
    setShowCategoryCreate(true)
  }

  return (
    <WindowFrame>
      <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(148,163,184,0.08),_transparent_16%)]" />
        </div>

        <div className="relative grid h-[calc(100vh-56px)] grid-cols-[220px_minmax(0,1fr)] gap-4 p-4">
          <aside
            ref={categoryRailRef}
            className="shell-panel thin-scrollbar relative overflow-hidden p-3"
            onContextMenu={handleSidebarContextMenu}
          >
            <div className="flex h-full flex-col">
              <div className="mb-3 px-2">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--soft)]">
                  分类
                </p>
                <h1 className="mt-2 text-[20px] font-semibold text-[var(--paper)]">Orvex</h1>
              </div>

              <div className="thin-scrollbar flex-1 overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  {categories.map((category) => {
                    const isActive = category.id === activeCategory.id

                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={[
                          'flex h-9 w-full items-center justify-between rounded-[12px] px-3 text-left text-sm transition',
                          isActive
                            ? 'bg-[var(--surface-soft)] text-[var(--paper)]'
                            : 'text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--paper)]',
                        ].join(' ')}
                        onClick={() => setSelectedCategoryId(category.id)}
                        onContextMenu={(event) => handleCategoryContextMenu(event, category)}
                        title={category.caption}
                      >
                        <span className="truncate pr-2 text-[13px] font-medium">
                          {category.title}
                        </span>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            borderColor: 'var(--line)',
                            background: 'var(--surface-soft)',
                            color: 'var(--soft)',
                          }}
                        >
                          {category.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                className="mt-3 rounded-[14px] border border-dashed px-4 py-2.5 text-sm font-semibold transition"
                style={{
                  borderColor: 'var(--line)',
                  color: 'var(--paper)',
                  background: 'var(--surface-soft)',
                }}
                onClick={openCreateCategorySheet}
              >
                + 新建分类
              </button>
            </div>
          </aside>

          <main className="shell-panel thin-scrollbar relative overflow-hidden">
            <div className="flex h-full flex-col">
              <div className="border-b px-6 py-5" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--soft)]">
                      {activeCategory.caption}
                    </p>
                    <h2 className="mt-2 text-[28px] font-semibold text-[var(--paper)]">
                      {activeCategory.title}
                    </h2>
                    <label className="shell-input mt-4 flex w-[42%] min-w-[260px] max-w-[440px] items-center gap-3">
                      <SearchIcon />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索启动项"
                        className="w-full bg-transparent text-[var(--paper)] outline-none placeholder:text-[var(--soft)]"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="shell-chip"
                      onClick={() => setShowSettings(true)}
                    >
                      设置
                    </button>
                    <button
                      type="button"
                      className="rounded-[14px] px-4 py-3 text-sm font-semibold transition"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                      }}
                      onClick={() => setShowItemCreate(true)}
                    >
                      新建启动项
                    </button>
                  </div>
                </div>
              </div>

              {flash ? (
                <div
                  className="mx-6 mt-4 rounded-[14px] border px-4 py-3 text-sm animate-fade-up"
                  style={{
                    borderColor: 'var(--line)',
                    background: 'var(--surface-soft)',
                    color: 'var(--paper)',
                  }}
                >
                  {flash}
                </div>
              ) : null}

              {error ? (
                <div
                  className="mx-6 mt-4 rounded-[14px] border px-4 py-3 text-sm animate-fade-up"
                  style={{
                    borderColor: 'rgba(220,38,38,0.2)',
                    background: 'rgba(220,38,38,0.08)',
                    color: '#fca5a5',
                  }}
                >
                  {error}
                </div>
              ) : null}

              <div className="thin-scrollbar flex-1 overflow-y-auto px-6 py-6">
                {visibleItems.length > 0 ? (
                  <div
                    ref={iconGridRef}
                    className={[
                      'grid grid-cols-[repeat(auto-fill,minmax(120px,120px))] justify-start gap-4 rounded-[20px] border border-transparent p-2 transition',
                      dragOverIcons ? 'bg-[var(--surface-soft)]' : '',
                    ].join(' ')}
                    style={{
                      borderColor: dragOverIcons ? 'var(--line-strong)' : 'transparent',
                    }}
                  >
                    {visibleItems.map((item) => (
                      <div
                        key={item.id}
                        className="shell-card group w-[120px] px-3 py-3 text-center transition hover:-translate-y-0.5"
                      >
                        <button
                          type="button"
                          className="w-full"
                          onClick={() => void handleLaunch(item)}
                          onContextMenu={(event) => handleItemContextMenu(event, item)}
                        >
                        <LauncherIcon
                          key={`${item.id}:${item.iconPath ?? 'fallback'}`}
                          item={item}
                          storageDirectory={storageDirectory}
                        />
                          <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-4 text-[var(--paper)]">
                            {item.name}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-[var(--soft)]">
                            {item.alias}
                          </p>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    ref={iconGridRef}
                    className="grid h-full min-h-[360px] place-items-center rounded-[24px] border border-dashed"
                    style={{
                      borderColor: 'var(--line)',
                      background: 'var(--surface-soft)',
                    }}
                  >
                    <div className="text-center">
                      <p className="text-lg font-semibold text-[var(--paper)]">当前没有启动项</p>
                      <p className="mt-2 text-sm text-[var(--soft)]">
                        新建一个启动项，或者拖入 exe 试试看。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {dragOverlayVisible ? (
              <div
                className="pointer-events-none absolute inset-0 z-30 grid place-items-center"
                style={{
                  background: dragOverIcons
                    ? 'rgba(15, 23, 42, 0.08)'
                    : 'rgba(15, 23, 42, 0.02)',
                }}
              >
                <div
                  className="rounded-[20px] border px-6 py-5 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
                  style={{
                    borderColor: 'var(--line-strong)',
                    background: 'var(--surface-elevated)',
                  }}
                >
                  <p className="text-lg font-semibold text-[var(--paper)]">
                    拖到这里即可添加启动项
                  </p>
                  <p className="mt-2 text-sm text-[var(--soft)]">
                    支持 exe、lnk、bat、cmd 和文件夹
                  </p>
                </div>
              </div>
            ) : null}
          </main>
        </div>

        {sidebarMenu.open ? (
          <ContextMenu x={sidebarMenu.x} y={sidebarMenu.y}>
            {sidebarMenu.category ? (
              <>
                <ContextMenuItem
                  label="编辑分类"
                  onClick={() => {
                    setCategoryEditDraft({
                      id: sidebarMenu.category!.id,
                      title: sidebarMenu.category!.title,
                      caption: sidebarMenu.category!.caption,
                      description: sidebarMenu.category!.description,
                      accent: sidebarMenu.category!.accent,
                    })
                    setSidebarMenu((state) => ({ ...state, open: false, category: null }))
                  }}
                />
                <ContextMenuItem
                  label="删除分类"
                  danger
                  onClick={() => {
                    void handleDeleteCategory(sidebarMenu.category!)
                    setSidebarMenu((state) => ({ ...state, open: false, category: null }))
                  }}
                />
              </>
            ) : null}
            <ContextMenuItem label="新建分类" onClick={openCreateCategorySheet} />
          </ContextMenu>
        ) : null}

        {itemMenu.open && itemMenu.item ? (
          <ContextMenu x={itemMenu.x} y={itemMenu.y}>
            <ContextMenuItem label="以管理员身份运行" disabled />
            <ContextMenuItem
              label={openingLocationItemId === itemMenu.item.id ? '正在打开位置...' : '打开文件位置'}
              onClick={() => {
                void handleOpenLocation(itemMenu.item!)
                setItemMenu((state) => ({ ...state, open: false, item: null }))
              }}
            />
            <ContextMenuItem
              label="编辑"
              onClick={() => {
                setItemEditDraft(mapItemToUpdateDraft(itemMenu.item!))
                setItemMenu((state) => ({ ...state, open: false, item: null }))
              }}
            />
            <ContextMenuItem
              label="删除"
              danger
              onClick={() => {
                void handleDeleteItem(itemMenu.item!)
                setItemMenu((state) => ({ ...state, open: false, item: null }))
              }}
            />
          </ContextMenu>
        ) : null}

        <Sheet
          open={showSettings}
          title="设置"
          onClose={() => setShowSettings(false)}
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--paper)]">主题模式</p>
              <div className="grid grid-cols-2 gap-3">
                <ThemePill
                  active={theme === 'dark'}
                  label="黑色主题"
                  onClick={() => void handleThemeChange('dark')}
                />
                <ThemePill
                  active={theme === 'light'}
                  label="白色主题"
                  onClick={() => void handleThemeChange('light')}
                />
              </div>
            </div>
            <div className="shell-card px-4 py-3 text-sm text-[var(--soft)]">
              {updatingTheme ? '正在切换主题...' : '主题会自动保存在本地设置中。'}
            </div>
          </div>
        </Sheet>

        <Sheet
          open={showCategoryCreate}
          title="新建分类"
          onClose={() => setShowCategoryCreate(false)}
        >
          <form className="space-y-3" onSubmit={handleCategorySubmit}>
            <Field
              label="名称"
              value={categoryDraft.title}
              onChange={(value) => setCategoryDraft((draft) => ({ ...draft, title: value }))}
              placeholder="开发工具"
            />
            <Field
              label="短标语"
              value={categoryDraft.caption}
              onChange={(value) => setCategoryDraft((draft) => ({ ...draft, caption: value }))}
              placeholder="编码与交付"
            />
            <Field
              label="描述"
              value={categoryDraft.description}
              onChange={(value) =>
                setCategoryDraft((draft) => ({ ...draft, description: value }))
              }
              placeholder="把常用工具聚成一栏"
            />
            <AccentPicker
              label="强调色"
              value={categoryDraft.accent}
              onChange={(value) => setCategoryDraft((draft) => ({ ...draft, accent: value }))}
            />
            <button
              type="submit"
              disabled={submittingCategory}
              className="w-full rounded-[16px] px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              {submittingCategory ? '正在创建分类...' : '创建分类'}
            </button>
          </form>
        </Sheet>

        <Sheet
          open={showItemCreate}
          title="新建启动项"
          onClose={() => setShowItemCreate(false)}
        >
          <form className="space-y-3" onSubmit={handleItemSubmit}>
            <Field
              label="名称"
              value={itemDraft.name}
              onChange={(value) => setItemDraft((draft) => ({ ...draft, name: value }))}
              placeholder="VS Code"
            />
            <Field
              label="别名"
              value={itemDraft.alias}
              onChange={(value) => setItemDraft((draft) => ({ ...draft, alias: value }))}
              placeholder="主力编辑器"
            />
            <SelectField
              label="所属分类"
              value={itemDraft.categoryId}
              options={categories
                .filter((category) => category.id !== 'all')
                .map((category) => ({
                  value: category.id,
                  label: category.title,
                }))}
              onChange={(value) =>
                setItemDraft((draft) => ({ ...draft, categoryId: value }))
              }
            />
            <SelectField
              label="类型"
              value={itemDraft.kind}
              options={itemKinds}
              onChange={(value) =>
                setItemDraft((draft) => ({
                  ...draft,
                  kind: value as LauncherItemKind,
                }))
              }
            />
            <Field
              label="路径或网址"
              value={itemDraft.path}
              onChange={(value) => setItemDraft((draft) => ({ ...draft, path: value }))}
              placeholder="C:\\Tools\\App.exe"
            />
            <Field
              label="说明"
              value={itemDraft.summary}
              onChange={(value) =>
                setItemDraft((draft) => ({ ...draft, summary: value }))
              }
              placeholder="这个项目用来做什么"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="热键位"
                value={itemDraft.hotkey}
                onChange={(value) => setItemDraft((draft) => ({ ...draft, hotkey: value }))}
                placeholder="09"
              />
              <Field
                label="使用情况"
                value={itemDraft.usage}
                onChange={(value) => setItemDraft((draft) => ({ ...draft, usage: value }))}
                placeholder="新置顶"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="缩写"
                value={itemDraft.monogram}
                onChange={(value) =>
                  setItemDraft((draft) => ({
                    ...draft,
                    monogram: value.slice(0, 2).toUpperCase(),
                  }))
                }
                placeholder="VS"
              />
              <AccentPicker
                label="强调色"
                value={itemDraft.accent}
                onChange={(value) => setItemDraft((draft) => ({ ...draft, accent: value }))}
              />
            </div>
            <button
              type="submit"
              disabled={submittingItem}
              className="w-full rounded-[16px] px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              {submittingItem ? '正在创建启动项...' : '创建启动项'}
            </button>
          </form>
        </Sheet>

        <Sheet
          open={categoryEditDraft !== null}
          title="编辑分类"
          onClose={() => setCategoryEditDraft(null)}
        >
          {categoryEditDraft ? (
            <form className="space-y-3" onSubmit={handleCategoryEditSubmit}>
              <Field
                label="名称"
                value={categoryEditDraft.title}
                onChange={(value) =>
                  setCategoryEditDraft((draft) =>
                    draft ? { ...draft, title: value } : draft,
                  )
                }
                placeholder="开发工具"
              />
              <Field
                label="短标语"
                value={categoryEditDraft.caption}
                onChange={(value) =>
                  setCategoryEditDraft((draft) =>
                    draft ? { ...draft, caption: value } : draft,
                  )
                }
                placeholder="编码与交付"
              />
              <Field
                label="描述"
                value={categoryEditDraft.description}
                onChange={(value) =>
                  setCategoryEditDraft((draft) =>
                    draft ? { ...draft, description: value } : draft,
                  )
                }
                placeholder="把常用工具聚成一栏"
              />
              <AccentPicker
                label="强调色"
                value={categoryEditDraft.accent}
                onChange={(value) =>
                  setCategoryEditDraft((draft) =>
                    draft ? { ...draft, accent: value } : draft,
                  )
                }
              />
              <button
                type="submit"
                disabled={editingCategoryId === categoryEditDraft.id}
                className="w-full rounded-[16px] px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {editingCategoryId === categoryEditDraft.id ? '正在保存分类...' : '保存分类'}
              </button>
            </form>
          ) : null}
        </Sheet>

        <Sheet
          open={itemEditDraft !== null}
          title="编辑启动项"
          onClose={() => setItemEditDraft(null)}
        >
          {itemEditDraft ? (
            <form className="space-y-3" onSubmit={handleItemEditSubmit}>
              <Field
                label="名称"
                value={itemEditDraft.name}
                onChange={(value) =>
                  setItemEditDraft((draft) => (draft ? { ...draft, name: value } : draft))
                }
                placeholder="VS Code"
              />
              <Field
                label="别名"
                value={itemEditDraft.alias}
                onChange={(value) =>
                  setItemEditDraft((draft) => (draft ? { ...draft, alias: value } : draft))
                }
                placeholder="主力编辑器"
              />
              <SelectField
                label="所属分类"
                value={itemEditDraft.categoryId}
                options={categories
                  .filter((category) => category.id !== 'all')
                  .map((category) => ({
                    value: category.id,
                    label: category.title,
                  }))}
                onChange={(value) =>
                  setItemEditDraft((draft) =>
                    draft ? { ...draft, categoryId: value } : draft,
                  )
                }
              />
              <SelectField
                label="类型"
                value={itemEditDraft.kind}
                options={itemKinds}
                onChange={(value) =>
                  setItemEditDraft((draft) =>
                    draft ? { ...draft, kind: value as LauncherItemKind } : draft,
                  )
                }
              />
              <Field
                label="路径或网址"
                value={itemEditDraft.path}
                onChange={(value) =>
                  setItemEditDraft((draft) => (draft ? { ...draft, path: value } : draft))
                }
                placeholder="C:\\Tools\\App.exe"
              />
              <Field
                label="说明"
                value={itemEditDraft.summary}
                onChange={(value) =>
                  setItemEditDraft((draft) =>
                    draft ? { ...draft, summary: value } : draft,
                  )
                }
                placeholder="这个项目用来做什么"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="热键位"
                  value={itemEditDraft.hotkey}
                  onChange={(value) =>
                    setItemEditDraft((draft) => (draft ? { ...draft, hotkey: value } : draft))
                  }
                  placeholder="09"
                />
                <Field
                  label="使用情况"
                  value={itemEditDraft.usage}
                  onChange={(value) =>
                    setItemEditDraft((draft) => (draft ? { ...draft, usage: value } : draft))
                  }
                  placeholder="新置顶"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="缩写"
                  value={itemEditDraft.monogram}
                  onChange={(value) =>
                    setItemEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            monogram: value.slice(0, 2).toUpperCase(),
                          }
                        : draft,
                    )
                  }
                  placeholder="VS"
                />
                <AccentPicker
                  label="强调色"
                  value={itemEditDraft.accent}
                  onChange={(value) =>
                    setItemEditDraft((draft) => (draft ? { ...draft, accent: value } : draft))
                  }
                />
              </div>
              <button
                type="submit"
                disabled={editingItemId === itemEditDraft.id}
                className="w-full rounded-[16px] px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {editingItemId === itemEditDraft.id ? '正在保存启动项...' : '保存启动项'}
              </button>
            </form>
          ) : null}
        </Sheet>
      </div>
    </WindowFrame>
  )
}

function buildCategories(categories: Category[], items: LauncherItem[]) {
  const baseCategories = categories.filter((category) => category.id !== 'all')
  const sorted = [...baseCategories].sort((left, right) => left.sort - right.sort)
  const allCategory: Category & { count: number } = {
    id: 'all',
    title: '全部',
    caption: '所有项目',
    description: '总览当前全部启动项。',
    accent: '#0f172a',
    sort: -1,
    count: items.length,
  }

  const detailed = sorted.map((category) => ({
    ...category,
    count: items.filter((item) => item.categoryId === category.id).length,
  }))

  return [allCategory, ...detailed]
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--paper)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="shell-input w-full"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--paper)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="shell-input w-full"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function AccentPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-[var(--paper)]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {accentOptions.map((accent) => {
          const isActive = accent === value
          return (
            <button
              key={accent}
              type="button"
              onClick={() => onChange(accent)}
              className={[
                'h-8 w-8 rounded-full border transition',
                isActive ? 'scale-110 border-[var(--line-strong)]' : 'border-[var(--line)]',
              ].join(' ')}
              style={{ backgroundColor: accent }}
              aria-label={`强调色 ${accent}`}
            />
          )
        })}
      </div>
    </div>
  )
}

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) {
    return null
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/30 backdrop-blur-[2px]">
      <div
        className="absolute right-6 top-6 w-[400px] rounded-[28px] border p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
        style={{
          borderColor: 'var(--line)',
          background: 'var(--surface-elevated)',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-[var(--paper)]">{title}</h3>
          <button type="button" className="shell-chip" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ThemePill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={[
        'rounded-[14px] border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-[var(--line-strong)] bg-[var(--paper)] text-[var(--accent-contrast)]'
          : 'border-[var(--line)] bg-transparent text-[var(--soft)] hover:border-[var(--line-strong)] hover:text-[var(--paper)]',
      ].join(' ')}
      onClick={onClick}
    >
      {label}
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
  return (
    <div
      className="fixed z-[90] min-w-[190px] rounded-[16px] border p-2 shadow-[0_24px_80px_rgba(15,23,42,0.14)]"
      style={{
        left: x,
        top: y,
        borderColor: 'var(--line)',
        background: 'var(--surface-elevated)',
      }}
    >
      {children}
    </div>
  )
}

function ContextMenuItem({
  label,
  disabled = false,
  danger = false,
  onClick,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm transition',
        disabled
          ? 'cursor-not-allowed text-[var(--soft)] opacity-60'
          : danger
            ? 'text-[#dc2626] hover:bg-[rgba(220,38,38,0.08)]'
            : 'text-[var(--paper)] hover:bg-[var(--surface-soft)]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-[var(--soft)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.25 4.25" />
    </svg>
  )
}

function mapItemToUpdateDraft(item: LauncherItem): UpdateLauncherItemPayload {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    alias: item.alias,
    kind: item.kind,
    summary: item.summary,
    path: item.path,
    hotkey: item.hotkey,
    usage: item.usage,
    monogram: item.monogram,
    accent: item.accent,
  }
}

function LauncherIcon({
  item,
  storageDirectory,
}: {
  item: LauncherItem
  storageDirectory: string
}) {
  const [broken, setBroken] = useState(false)

  if (item.iconPath && storageDirectory && !broken) {
    const normalizedBase = storageDirectory.replace(/[\\/]+$/, '')
    const normalizedRelative = item.iconPath.replace(/\//g, '\\')
    const iconAbsolutePath = `${normalizedBase}\\${normalizedRelative}`
    const iconUrl = toAssetUrl(iconAbsolutePath)

    return (
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-[12px] border bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
        style={{ borderColor: 'var(--line)' }}
      >
        <img
          key={item.iconPath}
          src={iconUrl}
          alt=""
          className="h-8 w-8 object-contain"
          draggable={false}
          onError={() => setBroken(true)}
        />
      </div>
    )
  }

  return (
    <div
      className="mx-auto flex h-10 w-10 items-center justify-center rounded-[12px] border text-xs font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
      style={{
        background: `linear-gradient(145deg, ${item.accent}, ${item.accent}cc)`,
        color: '#ffffff',
        borderColor: 'rgba(255,255,255,0.16)',
      }}
    >
      {item.monogram}
    </div>
  )
}

export default App
