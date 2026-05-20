import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WindowFrame } from '../components/WindowFrame'
import { useLauncherState } from '../hooks/useLauncherState'
import {
  hideLauncherPanel,
  loadSettingsState,
  launchLauncherItemAsAdmin,
  openSettingsWindow as openSettingsWindowCommand,
  toAssetUrl,
} from '../lib/tauri'
import type { Category, LauncherItem, SettingsState } from '../types/launcher'

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

type ItemMenuState = {
  open: boolean
  x: number
  y: number
  item: LauncherItem | null
}

type PanelMenuState = {
  open: boolean
  x: number
  y: number
}

type HoverCardState = {
  item: LauncherItem | null
  x: number
  y: number
}

type DragSortState = {
  active: boolean
  itemId: string
}

type SystemProjectDialogState = {
  open: boolean
  categoryId: string
  categoryTitle: string
}

type UrlProjectDialogState = {
  open: boolean
  categoryId: string
  categoryTitle: string
}

type RenameItemDialogState = {
  open: boolean
  item: LauncherItem | null
}

type SystemProjectOption = {
  id: string
  group: string
  name: string
  alias: string
  kind: 'app' | 'url'
  path: string
  iconSourcePath?: string | null
  staticIconPath?: string
  summary: string
  accent: string
  monogram: string
}

const SYSTEM_PROJECT_OPTIONS: SystemProjectOption[] = [
  {
    id: 'sys-settings',
    group: '系统应用',
    name: 'Windows 设置',
    alias: '系统设置',
    kind: 'url',
    path: 'ms-settings:',
    staticIconPath: '/system-icons/settings.png?v=2',
    summary: '快速打开 Windows 设置主页。',
    accent: '#2563eb',
    monogram: 'SE',
  },
  {
    id: 'sys-calc',
    group: '系统应用',
    name: '计算器',
    alias: 'Windows 计算器',
    kind: 'app',
    path: 'calc.exe',
    iconSourcePath: 'C:\\Windows\\System32\\calc.exe',
    staticIconPath: '/system-icons/calc.png?v=2',
    summary: '执行基础与科学计算。',
    accent: '#0ea5e9',
    monogram: 'CA',
  },
  {
    id: 'sys-notepad',
    group: '系统应用',
    name: '记事本',
    alias: 'Windows 记事本',
    kind: 'app',
    path: 'notepad.exe',
    iconSourcePath: 'C:\\Windows\\System32\\notepad.exe',
    staticIconPath: '/system-icons/notepad.png?v=2',
    summary: '快速记录文本和临时内容。',
    accent: '#14b8a6',
    monogram: 'NP',
  },
  {
    id: 'sys-cmd',
    group: '系统应用',
    name: '命令提示符',
    alias: 'Command Prompt',
    kind: 'app',
    path: 'cmd.exe',
    iconSourcePath: 'C:\\Windows\\System32\\cmd.exe',
    staticIconPath: '/system-icons/cmd.png?v=2',
    summary: '打开经典命令行终端。',
    accent: '#111827',
    monogram: 'CM',
  },
  {
    id: 'sys-powershell',
    group: '系统应用',
    name: 'PowerShell',
    alias: 'Windows PowerShell',
    kind: 'app',
    path: 'powershell.exe',
    iconSourcePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    staticIconPath: '/system-icons/powershell.png?v=2',
    summary: '打开 PowerShell 命令环境。',
    accent: '#2563eb',
    monogram: 'PS',
  },
  {
    id: 'sys-regedit',
    group: '系统应用',
    name: '注册表编辑器',
    alias: 'Registry Editor',
    kind: 'app',
    path: 'regedit.exe',
    iconSourcePath: 'C:\\Windows\\regedit.exe',
    staticIconPath: '/system-icons/regedit.png?v=2',
    summary: '管理 Windows 注册表项目。',
    accent: '#7c3aed',
    monogram: 'RE',
  },
  {
    id: 'sys-taskmgr',
    group: '系统应用',
    name: '任务管理器',
    alias: 'Task Manager',
    kind: 'app',
    path: 'taskmgr.exe',
    iconSourcePath: 'C:\\Windows\\System32\\Taskmgr.exe',
    staticIconPath: '/system-icons/taskmgr.png?v=2',
    summary: '查看进程与系统资源占用。',
    accent: '#f59e0b',
    monogram: 'TM',
  },
  {
    id: 'sys-control',
    group: '系统应用',
    name: '控制面板',
    alias: 'Control Panel',
    kind: 'app',
    path: 'control.exe',
    iconSourcePath: 'C:\\Windows\\System32\\control.exe',
    staticIconPath: '/system-icons/control.png?v=2',
    summary: '打开经典控制面板入口。',
    accent: '#10b981',
    monogram: 'CP',
  },
  {
    id: 'sys-explorer',
    group: '常用入口',
    name: '资源管理器',
    alias: 'File Explorer',
    kind: 'app',
    path: 'explorer.exe',
    iconSourcePath: 'C:\\Windows\\explorer.exe',
    staticIconPath: '/system-icons/explorer.png?v=2',
    summary: '快速打开 Windows 资源管理器。',
    accent: '#f97316',
    monogram: 'EX',
  },
  {
    id: 'sys-rdp',
    group: '常用入口',
    name: '远程桌面连接',
    alias: 'Remote Desktop',
    kind: 'app',
    path: 'mstsc.exe',
    iconSourcePath: 'C:\\Windows\\System32\\mstsc.exe',
    staticIconPath: '/system-icons/mstsc.png?v=2',
    summary: '发起远程桌面连接。',
    accent: '#06b6d4',
    monogram: 'RD',
  },
]

const SYSTEM_PROJECT_FALLBACK_ICONS: Record<string, string> = {
  'sys-settings': '⚙',
  'sys-calc': '⌘',
  'sys-notepad': '📝',
  'sys-cmd': '⌁',
  'sys-powershell': '⟫',
  'sys-regedit': '▦',
  'sys-taskmgr': '▤',
  'sys-control': '◫',
  'sys-explorer': '🗂',
  'sys-rdp': '⎋',
}

function LauncherPanel() {
  const {
    launcherState,
    settingsState,
    storageDirectory,
    launchItem,
    addCategory,
    addLauncherItem,
    addLauncherItemFromPath,
    editCategory,
    editLauncherItem,
    removeCategory,
    removeLauncherItem,
    openItemLocation,
    reorderItems,
    updateSettings,
  } = useLauncherState()
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [query, setQuery] = useState('')
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
  const [itemMenu, setItemMenu] = useState<ItemMenuState>({
    open: false,
    x: 0,
    y: 0,
    item: null,
  })
  const [panelMenu, setPanelMenu] = useState<PanelMenuState>({
    open: false,
    x: 0,
    y: 0,
  })
  const [hoverCard, setHoverCard] = useState<HoverCardState>({
    item: null,
    x: 0,
    y: 0,
  })
  const [systemProjectDialog, setSystemProjectDialog] = useState<SystemProjectDialogState>({
    open: false,
    categoryId: '',
    categoryTitle: '',
  })
  const [dragSortState, setDragSortState] = useState<DragSortState>({
    active: false,
    itemId: '',
  })
  const [dropTargetItemId, setDropTargetItemId] = useState('')
  const [urlProjectDialog, setUrlProjectDialog] = useState<UrlProjectDialogState>({
    open: false,
    categoryId: '',
    categoryTitle: '',
  })
  const [renameItemDialog, setRenameItemDialog] = useState<RenameItemDialogState>({
    open: false,
    item: null,
  })
  const [renameItemDraft, setRenameItemDraft] = useState('')
  const [urlProjectName, setUrlProjectName] = useState('')
  const [urlProjectAddress, setUrlProjectAddress] = useState('')
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null)
  const [previewSettings, setPreviewSettings] = useState<SettingsState | null>(null)
  const dragSortItemIdRef = useRef('')
  const categoryListRef = useRef<HTMLDivElement | null>(null)
  const categoryRailRef = useRef<HTMLElement | null>(null)
  const iconGridRef = useRef<HTMLDivElement | null>(null)
  const createCategoryInputRef = useRef<HTMLInputElement | null>(null)
  const renameCategoryInputRef = useRef<HTMLInputElement | null>(null)
  const renamingCategorySubmittingRef = useRef(false)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const effectiveSettings = previewSettings ?? settingsState
  const backgroundImageUrl =
    effectiveSettings?.backgroundType === 'image' && effectiveSettings.backgroundImagePath
      ? toAssetUrl(effectiveSettings.backgroundImagePath)
      : ''

  const theme = effectiveSettings?.theme ?? 'light'
  const showIconTitles = effectiveSettings?.showIconTitles ?? true
  const showCategoryCounts = effectiveSettings?.showCategoryCounts ?? true
  const rootBackgroundOpacity = (effectiveSettings?.backgroundOpacity ?? 88) / 100
  const sidebarOpacity = (effectiveSettings?.sidebarOpacity ?? 92) / 100
  const contentOpacity = (effectiveSettings?.contentOpacity ?? 92) / 100
  const frostedGlassEnabled = effectiveSettings?.frostedGlass !== false
  const frostedGlassStrength = effectiveSettings?.frostedGlassStrength ?? 14
  const transparentDragonHeader = effectiveSettings?.transparentDragonHeader === true
  const categoryHighlightEnabled = effectiveSettings?.categoryHighlightEnabled === true
  const categoryHighlightColor = effectiveSettings?.categoryHighlightColor ?? '#ffffff'
  const categoryHighlightOpacity = effectiveSettings?.categoryHighlightOpacity ?? 82
  const itemCardColor = effectiveSettings?.itemCardColor ?? '#ffffff'
  const itemCardOpacity = effectiveSettings?.itemCardOpacity ?? 78
  const iconShellColor = effectiveSettings?.iconShellColor ?? '#ffffff'
  const iconShellOpacity = effectiveSettings?.iconShellOpacity ?? 94
  const appearanceSettings = effectiveSettings?.appearance
  const categoryFontSize = appearanceSettings?.category_font_size ?? 14
  const categoryFontColor = appearanceSettings?.category_font_color ?? '#333333'
  const categoryHighlightRadius = Math.max(
    0,
    Math.min(appearanceSettings?.category_highlight_radius ?? 12, 24),
  )
  const itemFontSize = appearanceSettings?.item_font_size ?? 13
  const itemFontColor = appearanceSettings?.item_font_color ?? '#333333'
  const searchPlaceholderColor = appearanceSettings?.search_placeholder_color ?? '#94a3b8'
  const panelAppearance = useMemo(
    () =>
      buildPanelAppearance({
        theme,
        sidebarOpacity,
        contentOpacity,
        backgroundOpacity: rootBackgroundOpacity,
        itemCardColor,
        itemCardOpacity,
        iconShellColor,
        iconShellOpacity,
        searchPlaceholderColor,
        hasImageBackground: Boolean(backgroundImageUrl),
      }),
    [
      backgroundImageUrl,
      contentOpacity,
      itemCardColor,
      itemCardOpacity,
      iconShellColor,
      iconShellOpacity,
      rootBackgroundOpacity,
      searchPlaceholderColor,
      sidebarOpacity,
      theme,
    ],
  )
  const panelCssVars = useMemo(
    () =>
      ({
        color: panelAppearance.textStrong,
        '--panel-text-strong': panelAppearance.textStrong,
        '--panel-text-soft': panelAppearance.textSoft,
        '--panel-text-muted': panelAppearance.textMuted,
        '--panel-row-hover-bg': panelAppearance.rowHoverBg,
        '--panel-row-active-bg': panelAppearance.rowActiveBg,
        '--panel-row-accent': panelAppearance.rowAccent,
        '--panel-badge-bg': panelAppearance.badgeBg,
        '--panel-badge-text': panelAppearance.badgeText,
        '--panel-search-bg': panelAppearance.searchSurface,
        '--panel-search-border': panelAppearance.searchBorder,
        '--panel-search-placeholder': panelAppearance.searchPlaceholder,
        '--panel-grid-bg': panelAppearance.gridSurface,
        '--panel-grid-border': panelAppearance.gridBorder,
        '--panel-grid-hover-bg': panelAppearance.gridHoverBg,
        '--panel-item-bg': panelAppearance.itemBaseBg,
        '--panel-item-hover-bg': panelAppearance.itemHoverBg,
        '--panel-overlay-bg': panelAppearance.overlayBg,
        '--panel-overlay-card-bg': panelAppearance.overlayCardBg,
        '--panel-overlay-card-border': panelAppearance.overlayCardBorder,
        '--panel-time-text': panelAppearance.timeText,
        '--panel-icon-shell-bg': panelAppearance.iconShellBg,
        '--panel-icon-shell-shadow': panelAppearance.iconShellShadow,
        '--panel-settings-bg': panelAppearance.settingsButtonBg,
        '--panel-settings-border': panelAppearance.settingsButtonBorder,
        '--panel-settings-hover-bg': panelAppearance.settingsButtonHoverBg,
        '--panel-settings-hover-border': panelAppearance.settingsButtonHoverBorder,
        '--panel-settings-icon': panelAppearance.settingsButtonIcon,
        '--panel-menu-bg': panelAppearance.menuBg,
        '--panel-menu-border': panelAppearance.menuBorder,
        '--panel-menu-hover-bg': panelAppearance.menuHoverBg,
        '--panel-menu-text': panelAppearance.menuText,
        '--panel-menu-danger': panelAppearance.menuDanger,
        '--panel-blur-strength': `${frostedGlassStrength}px`,
      }) as CSSProperties,
    [frostedGlassStrength, panelAppearance],
  )

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme
    const previousBodyBackground = document.body.style.background

    document.documentElement.dataset.theme = theme
    document.body.style.background = panelAppearance.bodyBackground

    return () => {
      if (previousTheme) {
        document.documentElement.dataset.theme = previousTheme
      } else {
        delete document.documentElement.dataset.theme
      }
      document.body.style.background = previousBodyBackground
    }
  }, [panelAppearance.bodyBackground, theme])

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
    if (!sidebarMenu.open && !itemMenu.open && !panelMenu.open) {
      return
    }

    const close = () => {
      setSidebarMenu({ open: false, x: 0, y: 0, category: null })
      setItemMenu({ open: false, x: 0, y: 0, item: null })
      setPanelMenu({ open: false, x: 0, y: 0 })
    }
    window.addEventListener('click', close)

    return () => {
      window.removeEventListener('click', close)
    }
  }, [itemMenu.open, panelMenu.open, sidebarMenu.open])

  useEffect(() => {
    const categoryList = categoryListRef.current
    if (!categoryList) {
      return
    }

    const handleMouseOver = (event: Event) => {
      const target = event.target as HTMLElement | null
      const item = target?.closest<HTMLElement>('[data-category-item="true"]')
      if (!item || !categoryList.contains(item)) {
        return
      }

      const nextIndex = Number(item.dataset.categoryIndex)
      if (Number.isNaN(nextIndex)) {
        return
      }

      setHoveredCategoryIndex((current) => (current === nextIndex ? current : nextIndex))
    }

    const handleMouseLeave = () => {
      setHoveredCategoryIndex(null)
    }

    categoryList.addEventListener('mouseover', handleMouseOver)
    categoryList.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      categoryList.removeEventListener('mouseover', handleMouseOver)
      categoryList.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined

    async function bindPreview() {
      unlisten = await listen<SettingsState>('orvex://appearance-preview', (event) => {
        if (!disposed) {
          setPreviewSettings(event.payload)
        }
      })
    }

    void bindPreview()

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    if (!dragSortState.active) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const item = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(
        '[data-launcher-item-id]',
      )
      const nextTargetId = item?.dataset.launcherItemId ?? ''

      if (!nextTargetId || nextTargetId === dragSortItemIdRef.current) {
        return
      }

      setDropTargetItemId(nextTargetId)
    }

    const handleMouseUp = () => {
      const draggingId = dragSortItemIdRef.current
      const targetId = dropTargetItemId

      if (draggingId && targetId && draggingId !== targetId) {
        void handleReorderDrop(targetId)
      } else {
        setDragSortState({ active: false, itemId: '' })
        dragSortItemIdRef.current = ''
        setDropTargetItemId('')
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragSortState.active, dropTargetItemId])

  const categories = useMemo<PanelCategory[]>(() => {
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
  const shouldShowSearch = effectiveCategoryId === 'all'

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
        !shouldShowSearch ||
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
  }, [deferredQuery, effectiveCategoryId, launcherState, settingsState?.sortMode, shouldShowSearch])

  const isCustomSortMode = (settingsState?.sortMode ?? 'custom') === 'custom'
  const renderedItems = useMemo(() => {
    if (!dragSortState.active || !dragSortState.itemId || !dropTargetItemId) {
      return visibleItems
    }

    return buildPreviewItems(visibleItems, dragSortState.itemId, dropTargetItemId)
  }, [dragSortState.active, dragSortState.itemId, dropTargetItemId, visibleItems])

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
            console.warn('只支持拖入 exe、lnk、bat、cmd 或文件夹')
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
              console.error('拖入创建启动项失败', caughtError)
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
      let shouldClosePanel = settingsState?.closePanelAfterLaunch ?? false

      try {
        shouldClosePanel = (await loadSettingsState()).closePanelAfterLaunch
      } catch (settingsError) {
        console.warn('Failed to reload panel settings after launch', settingsError)
      }

      if (shouldClosePanel) {
        try {
          await hideLauncherPanel()
          return
        } catch (hideError) {
          console.warn('Failed to hide launcher panel after launch', hideError)
          return
        }
      }
    } catch (caughtError) {
      console.error('启动失败', caughtError)
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
    setItemMenu({ open: false, x: 0, y: 0, item: null })
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
    setSidebarMenu({ open: false, x: 0, y: 0, category: null })
    setPanelMenu({ open: false, x: 0, y: 0 })
    setItemMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      item,
    })
  }

  function openCreateCategoryInput() {
    closeSidebarMenu()
    cancelRenamingCategory()
    setCreatingCategoryTitle('')
    setCreatingCategory(true)
  }

  function handlePanelContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null
    if (!target) {
      return
    }

    if (target.closest('[data-launcher-item="true"]')) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    closeSidebarMenu()
    setItemMenu({ open: false, x: 0, y: 0, item: null })
    setPanelMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
    })
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

  async function handleOpenLocation(item: LauncherItem) {
    try {
      await openItemLocation(item.id)
    } catch (caughtError) {
      console.error('打开位置失败', caughtError)
    }
  }

  async function handleLaunchAsAdmin(item: LauncherItem) {
    setLaunchingItemId(item.id)
    try {
      await launchLauncherItemAsAdmin(item.id)
    } catch (caughtError) {
      console.error('管理员启动失败', caughtError)
    } finally {
      setLaunchingItemId('')
    }
  }

  async function handleAddSystemProject(option: SystemProjectOption) {
    if (!systemProjectDialog.categoryId) {
      return
    }

    const duplicate = (launcherState?.items ?? []).some(
      (item) =>
        item.categoryId === systemProjectDialog.categoryId &&
        item.path.toLowerCase() === option.path.toLowerCase(),
    )

    if (duplicate) {
      console.warn(`${option.name} 已经在 ${systemProjectDialog.categoryTitle} 中了`)
      return
    }

    try {
      await addLauncherItem({
        categoryId: systemProjectDialog.categoryId,
        name: option.name,
        alias: option.alias,
        kind: option.kind,
        summary: option.summary,
        path: option.path,
        iconSourcePath: option.iconSourcePath ?? null,
        hotkey: '',
        usage: '系统项目',
        monogram: option.monogram,
        accent: option.accent,
      })
      setSystemProjectDialog({ open: false, categoryId: '', categoryTitle: '' })
    } catch (caughtError) {
      console.error('添加系统项目失败', caughtError)
    }
  }

  function resolveEditableCategory(): PanelCategory | null {
    const targetCategory: PanelCategory | undefined =
      activeCategory && !activeCategory.virtual
        ? activeCategory
        : categories.find((category) => !category.virtual)

    if (!targetCategory) {
      console.warn('请先创建一个可用分类')
      return null
    }

    return targetCategory
  }

  function openSystemProjectDialog() {
    const resolvedCategory = resolveEditableCategory()
    if (!resolvedCategory) return

    setItemMenu({ open: false, x: 0, y: 0, item: null })
    setPanelMenu({ open: false, x: 0, y: 0 })
    setSystemProjectDialog({
      open: true,
      categoryId: resolvedCategory.id,
      categoryTitle: resolvedCategory.title,
    })
  }

  function openUrlProjectDialog() {
    const resolvedCategory = resolveEditableCategory()
    if (!resolvedCategory) return

    setItemMenu({ open: false, x: 0, y: 0, item: null })
    setPanelMenu({ open: false, x: 0, y: 0 })
    setUrlProjectName('')
    setUrlProjectAddress('')
    setUrlProjectDialog({
      open: true,
      categoryId: resolvedCategory.id,
      categoryTitle: resolvedCategory.title,
    })
  }

  async function handleCreateUrlProject() {
    const name = urlProjectName.trim()
    const address = urlProjectAddress.trim()

    if (!urlProjectDialog.categoryId || !name || !address) {
      console.warn('请填写项目名称和 URL 地址')
      return
    }

    try {
      await addLauncherItem({
        categoryId: urlProjectDialog.categoryId,
        name,
        alias: 'URL 项目',
        kind: 'url',
        summary: `打开 ${address}`,
        path: address,
        iconSourcePath: null,
        hotkey: '',
        usage: 'URL 项目',
        monogram: name.slice(0, 2).toUpperCase(),
        accent: '#2563eb',
      })
      setUrlProjectDialog({ open: false, categoryId: '', categoryTitle: '' })
      setUrlProjectName('')
      setUrlProjectAddress('')
    } catch (caughtError) {
      console.error('添加 URL 项目失败', caughtError)
    }
  }

  async function handleToggleIconTitles() {
    if (!settingsState) {
      return
    }

    try {
      await updateSettings({
        ...settingsState,
        showIconTitles: !showIconTitles,
      })
    } catch (caughtError) {
      console.error('切换图标标题失败', caughtError)
    }
  }

  async function handleRemoveItem(item: LauncherItem) {
    try {
      await removeLauncherItem(item.id)
    } catch (caughtError) {
      console.error('移除启动项失败', caughtError)
    }
  }

  function closeRenameItemDialog() {
    setRenameItemDialog({ open: false, item: null })
    setRenameItemDraft('')
  }

  function openRenameItemDialog(item: LauncherItem) {
    setItemMenu({ open: false, x: 0, y: 0, item: null })
    setRenameItemDialog({ open: true, item })
    setRenameItemDraft(item.name)
  }

  async function handleRenameItem() {
    const item = renameItemDialog.item
    const nextName = renameItemDraft.trim()

    if (!item || !nextName) {
      return
    }

    if (nextName === item.name) {
      closeRenameItemDialog()
      return
    }

    try {
      await editLauncherItem({
        id: item.id,
        order: item.order,
        categoryId: item.categoryId,
        name: nextName,
        alias: item.alias,
        kind: item.kind,
        summary: item.summary,
        path: item.path,
        iconSourcePath: null,
        hotkey: item.hotkey,
        usage: item.usage,
        monogram: buildMonogram(nextName, item.monogram),
        accent: item.accent,
      })
      closeRenameItemDialog()
    } catch (caughtError) {
      console.error('修改启动项名称失败', caughtError)
    }
  }

  async function handleReorderDrop(targetItemId: string) {
    if (!dragSortItemIdRef.current || dragSortItemIdRef.current === targetItemId || !launcherState) {
      setDragSortState({ active: false, itemId: '' })
      dragSortItemIdRef.current = ''
      setDropTargetItemId('')
      return
    }

    const reorderedIds = buildReorderedItemIds(
      launcherState.items,
      dragSortItemIdRef.current,
      targetItemId,
    )

    if (!reorderedIds) {
      setDragSortState({ active: false, itemId: '' })
      dragSortItemIdRef.current = ''
      setDropTargetItemId('')
      return
    }

    try {
      await reorderItems(reorderedIds)
    } catch (caughtError) {
      console.error('调整启动项顺序失败', caughtError)
    } finally {
      setDragSortState({ active: false, itemId: '' })
      dragSortItemIdRef.current = ''
      setDropTargetItemId('')
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
      edgeToEdge
      transparentSurface
      immersiveHeader={transparentDragonHeader}
      headerLeftAddon={
        <SettingsEntryButton
          theme={theme}
          onClick={() => {
            void openSettingsWindowCommand().catch((error) => {
              console.error('打开设置窗口失败', error)
            })
          }}
        />
      }
    >
      <div
        className="relative h-[calc(100vh-44px)] w-full overflow-hidden font-[system-ui] text-[var(--panel-text-strong)]"
        style={{
          ...panelCssVars,
          paddingTop: transparentDragonHeader ? '44px' : '0',
          height: transparentDragonHeader ? '100vh' : 'calc(100vh - 44px)',
        }}
      >
        <div className="absolute inset-0" style={{ background: panelAppearance.baseLayer }} />
        {backgroundImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url("${backgroundImageUrl}")`,
              transform: 'scale(1.03)',
            }}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: panelAppearance.overlayLayer,
            backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength + 8}px)` : 'none',
          }}
        />

        <div className="relative z-10 grid h-full min-h-0 grid-cols-[160px_minmax(0,1fr)]">
          <aside
            ref={categoryRailRef}
            className="flex h-full min-h-0 flex-col border-r px-3 py-4"
            style={{
              background: panelAppearance.sidebarSurface,
              backdropFilter: 'blur(0px)',
              borderRightColor: 'rgba(0, 0, 0, 0.06)',
              borderRightStyle: 'solid',
            }}
            onContextMenuCapture={handleSidebarContextMenuCapture}
            onContextMenu={handleSidebarContextMenu}
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <div
                ref={categoryListRef}
                className="sidebar-scrollbar h-full space-y-0.5 overflow-y-auto pr-1"
              >
              {categories.map((category, index) => {
                const isActive = category.id === activeCategory.id
                const isRenaming = renamingCategoryId === category.id
                const categoryTitleColor = categoryFontColor
                const isHovered = index === hoveredCategoryIndex
                const isHighlighted = isActive || isHovered
                const categoryFontSizeValue = isHighlighted
                  ? Math.min(categoryFontSize + 1, 18)
                  : categoryFontSize
                const categoryTitleWeight = isHighlighted || isRenaming ? 600 : 400
                const shouldShowCount = showCategoryCounts && category.count > 0
                  const categoryHighlightBackground =
                    categoryHighlightEnabled && isHighlighted
                      ? toRgba(hexToRgb(categoryHighlightColor) ?? [255, 255, 255], categoryHighlightOpacity / 100)
                      : 'transparent'
                  const rowClass = [
                    'relative flex h-9 w-full items-center justify-between rounded-[12px] px-3 text-left transition duration-150 ease',
                  ].join(' ')

                if (isRenaming) {
                  return (
                    <div
                      key={category.id}
                      data-category-item="true"
                      data-category-index={index}
                      className={rowClass}
                      style={{
                        color: categoryFontColor,
                        backgroundColor: categoryHighlightBackground,
                        borderRadius: `${categoryHighlightRadius}px`,
                        boxShadow:
                          categoryHighlightEnabled && isHighlighted
                            ? 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 10px 24px rgba(15,23,42,0.08)'
                            : 'none',
                      }}
                    >
                      <span
                        className="absolute left-0 top-1.5 h-6 w-[2px]"
                        style={{ backgroundColor: categoryFontColor }}
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
                        className="w-full bg-transparent pl-1 pr-2 outline-none disabled:opacity-60"
                        style={{
                          color: categoryFontColor,
                          fontSize: `${categoryFontSizeValue}px`,
                          fontWeight: 600,
                          transition: 'font-size 150ms ease',
                        }}
                      />
                      {shouldShowCount ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: categoryFontColor,
                            color: '#fff',
                          }}
                        >
                          {category.count}
                        </span>
                      ) : null}
                    </div>
                  )
                }

                return (
                    <button
                      key={category.id}
                      type="button"
                      data-category-item="true"
                      data-category-index={index}
                      className={rowClass}
                      style={{
                        color: categoryTitleColor,
                        backgroundColor: categoryHighlightBackground,
                        borderRadius: `${categoryHighlightRadius}px`,
                        boxShadow:
                          categoryHighlightEnabled && isHighlighted
                            ? 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 10px 24px rgba(15,23,42,0.08)'
                            : 'none',
                      }}
                      onClick={() => setSelectedCategoryId(category.id)}
                      onContextMenu={(event) => handleCategoryContextMenu(event, category)}
                    >
                    {isActive ? (
                      <span
                        className="absolute left-0 top-1.5 h-6 w-[2px]"
                        style={{ backgroundColor: categoryFontColor }}
                      />
                    ) : null}
                    <span
                      className="truncate pl-1"
                      style={{
                        color: categoryTitleColor,
                        WebkitTextFillColor: categoryTitleColor,
                        fontSize: `${categoryFontSizeValue}px`,
                        fontWeight: categoryTitleWeight,
                        transition: 'font-size 150ms ease',
                      }}
                    >
                      {category.title}
                    </span>
                    {shouldShowCount ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: isActive ? categoryFontColor : '#eee',
                          color: isActive ? '#fff' : '#999',
                        }}
                      >
                        {category.count}
                      </span>
                    ) : null}
                  </button>
                )
              })}

              {creatingCategory ? (
                <div
                  data-category-create="true"
                  className="relative flex h-8 w-full items-center rounded-[12px] px-3 text-[13px] text-[var(--panel-text-strong)]"
                  style={{
                    backgroundColor: panelAppearance.rowActiveBg,
                    borderRadius: `${categoryHighlightRadius}px`,
                  }}
                >
                  <span
                    className="absolute left-0 top-1.5 h-6 w-[3px] rounded-r-full"
                    style={{ backgroundColor: panelAppearance.rowAccent }}
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
                    className="w-full bg-transparent pl-1 text-[13px] text-[var(--panel-text-strong)] outline-none placeholder:text-[var(--panel-text-muted)] disabled:opacity-60"
                  />
                </div>
              ) : null}
              </div>
            </div>

            <div className="shrink-0 px-4 pt-4">
              <div className="text-left text-[28px] font-light text-[#555]">
                {timeText}
              </div>
            </div>
          </aside>

          <main className="flex h-full min-h-0 flex-col overflow-hidden px-5 py-4">
            {shouldShowSearch ? (
              <div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索或直接输入..."
                  className="panel-search-input w-full rounded-[16px] border px-4 py-3 text-sm outline-none transition"
                  style={{
                    background: panelAppearance.searchSurface,
                    borderColor: panelAppearance.searchBorder,
                    color: panelAppearance.textStrong,
                    backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength}px)` : 'none',
                  }}
                />
              </div>
            ) : null}

            <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
              <div
                ref={iconGridRef}
                className="panel-scrollbar h-full overflow-y-scroll rounded-[16px] border pr-1 transition"
                onContextMenu={handlePanelContextMenu}
                style={{
                  background: dragOverIcons ? panelAppearance.gridHoverBg : panelAppearance.gridSurface,
                  borderColor: panelAppearance.gridBorder,
                  backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength}px)` : 'none',
                }}
              >
                <div className="grid min-h-full auto-rows-max content-start grid-cols-[repeat(auto-fill,minmax(80px,1fr))] items-start gap-3 rounded-[16px] border border-transparent p-2 transition">
                  {renderedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-launcher-item-id={item.id}
                      className={[
                        'group flex min-h-[96px] flex-col items-center justify-start rounded-[14px] border border-transparent px-2 py-2 transition',
                        'bg-[var(--panel-item-bg)] hover:-translate-y-0.5 hover:bg-[var(--panel-item-hover-bg)]',
                        dropTargetItemId === item.id ? 'border-[#111111] border-dashed' : '',
                        dragSortState.active && dragSortState.itemId === item.id ? 'opacity-45' : '',
                      ].join(' ')}
                      style={{
                        backdropFilter: frostedGlassEnabled
                          ? `blur(${Math.max(0, frostedGlassStrength - 2)}px)`
                          : 'none',
                      }}
                      onMouseDown={(event) => {
                        if (!isCustomSortMode) {
                          return
                        }
                        if (event.button !== 0) {
                          return
                        }
                        dragSortItemIdRef.current = item.id
                        setDragSortState({ active: true, itemId: item.id })
                        setDropTargetItemId(item.id)
                      }}
                      onMouseEnter={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setHoverCard({
                          item,
                          x: rect.left + rect.width / 2,
                          y: rect.bottom + 10,
                        })
                      }}
                      onMouseMove={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setHoverCard((current) =>
                          current.item?.id === item.id
                            ? {
                                item,
                                x: rect.left + rect.width / 2,
                                y: rect.bottom + 10,
                              }
                            : current,
                        )
                      }}
                      onMouseLeave={() => {
                        setHoverCard((current) =>
                          current.item?.id === item.id
                            ? { item: null, x: 0, y: 0 }
                            : current,
                        )
                      }}
                      onContextMenu={(event) => handleItemContextMenu(event, item)}
                      onClick={() => void handleLaunch(item)}
                    >
                      <PanelIcon item={item} storageDirectory={storageDirectory} />
                      {showIconTitles ? (
                        <span
                          className="mt-2 max-w-full whitespace-normal break-all text-center leading-4"
                          style={{
                            color: itemFontColor,
                            fontSize: `${itemFontSize}px`,
                            textShadow: '0 1px 2px rgba(255,255,255,0.9)',
                          }}
                        >
                          {launchingItemId === item.id ? '启动中...' : item.name}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              {dragOverlayVisible ? (
                <div
                  className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[16px]"
                  style={{ background: panelAppearance.overlayBg }}
                >
                  <div
                    className="rounded-[18px] border px-5 py-4 text-center shadow-[0_12px_36px_rgba(15,23,42,0.12)]"
                    style={{
                      background: panelAppearance.overlayCardBg,
                      borderColor: panelAppearance.overlayCardBorder,
                      backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength + 2}px)` : 'none',
                    }}
                  >
                    <p className="text-[15px] font-semibold text-[var(--panel-text-strong)]">
                      拖到这里即可添加启动项
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--panel-text-muted)]">
                      支持 exe、lnk、bat、cmd 和文件夹
                    </p>
                  </div>
                </div>
              ) : null}

              {hoverCard.item ? (
                <ItemHoverCard
                  item={hoverCard.item}
                  x={hoverCard.x}
                  y={hoverCard.y}
                />
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

        {itemMenu.open && itemMenu.item ? (
          <ContextMenu x={itemMenu.x} y={itemMenu.y}>
            <ContextMenuItem
              label="修改显示名称"
              onClick={() => {
                openRenameItemDialog(itemMenu.item!)
              }}
            />
            <ContextMenuItem
              label="管理员方式运行"
              disabled={itemMenu.item.kind !== 'app'}
              onClick={() => {
                void handleLaunchAsAdmin(itemMenu.item!)
                setItemMenu({ open: false, x: 0, y: 0, item: null })
              }}
            />
            <ContextMenuItem
              label="打开文件所在位置"
              onClick={() => {
                void handleOpenLocation(itemMenu.item!)
                setItemMenu({ open: false, x: 0, y: 0, item: null })
              }}
            />
            <ContextMenuItem label="添加URL项目" onClick={openUrlProjectDialog} />
            <ContextMenuItem
              label="添加系统项目"
              onClick={openSystemProjectDialog}
            />
            <ContextMenuItem label="资源管理器菜单" disabled />
            <ContextMenuItem label="属性" disabled />
            <ContextMenuItem
              label="从列表移除"
              danger
              onClick={() => {
                void handleRemoveItem(itemMenu.item!)
                setItemMenu({ open: false, x: 0, y: 0, item: null })
              }}
            />
          </ContextMenu>
        ) : null}

        {panelMenu.open ? (
          <ContextMenu x={panelMenu.x} y={panelMenu.y}>
            <ContextMenuItem label="添加URL项目" onClick={openUrlProjectDialog} />
            <ContextMenuItem label="添加系统项目" onClick={openSystemProjectDialog} />
            <ContextMenuItem label="锁定主面板" disabled />
            <ContextMenuItem
              label={showIconTitles ? '隐藏图标标题' : '显示图标标题'}
              onClick={() => {
                void handleToggleIconTitles()
                setPanelMenu({ open: false, x: 0, y: 0 })
              }}
            />
            <ContextMenuItem label="批量操作" disabled />
          </ContextMenu>
        ) : null}

        {systemProjectDialog.open ? (
          <SystemProjectDialog
            categoryTitle={systemProjectDialog.categoryTitle}
            items={SYSTEM_PROJECT_OPTIONS}
            existingPaths={
              new Set(
                (launcherState?.items ?? [])
                  .filter((item) => item.categoryId === systemProjectDialog.categoryId)
                  .map((item) => item.path.toLowerCase()),
              )
            }
            onClose={() =>
              setSystemProjectDialog({ open: false, categoryId: '', categoryTitle: '' })
            }
            onSelect={(option) => {
              void handleAddSystemProject(option)
            }}
          />
        ) : null}

        {urlProjectDialog.open ? (
          <UrlProjectDialog
            categoryTitle={urlProjectDialog.categoryTitle}
            name={urlProjectName}
            address={urlProjectAddress}
            onNameChange={setUrlProjectName}
            onAddressChange={setUrlProjectAddress}
            onClose={() => {
              setUrlProjectDialog({ open: false, categoryId: '', categoryTitle: '' })
              setUrlProjectName('')
              setUrlProjectAddress('')
            }}
            onSubmit={() => {
              void handleCreateUrlProject()
            }}
          />
        ) : null}

        {renameItemDialog.open && renameItemDialog.item ? (
          <RenameItemDialog
            item={renameItemDialog.item}
            value={renameItemDraft}
            onChange={setRenameItemDraft}
            onClose={closeRenameItemDialog}
            onSubmit={() => {
              void handleRenameItem()
            }}
          />
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
      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--panel-icon-shell-bg)] shadow-[var(--panel-icon-shell-shadow)]">
        <img src={iconUrl} alt="" className="h-9 w-9 object-contain" draggable={false} />
      </div>
    )
  }

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[11px] font-semibold text-white shadow-[var(--panel-icon-shell-shadow)]"
      style={{ background: item.accent || 'var(--panel-row-accent)' }}
    >
      {item.monogram}
    </div>
  )
}

function ItemHoverCard({
  item,
  x,
  y,
}: {
  item: LauncherItem
  x: number
  y: number
}) {
  const cardWidth = 220
  const cardHeight = 104
  const viewportPadding = 12
  const spaceBelow = window.innerHeight - y - viewportPadding
  const spaceAbove = y - viewportPadding
  const openUpward = spaceBelow < cardHeight && spaceAbove > spaceBelow
  const left = Math.max(
    viewportPadding,
    Math.min(x - cardWidth / 2, window.innerWidth - cardWidth - viewportPadding),
  )
  const top = openUpward
    ? Math.max(viewportPadding, y - cardHeight - 18)
    : Math.max(viewportPadding, Math.min(y, window.innerHeight - cardHeight - viewportPadding))

  return (
    <div
      className="pointer-events-none fixed z-[95] w-[220px] overflow-hidden rounded-[14px] border border-[#d8dee8] bg-[#fdfefe] text-left shadow-[0_18px_36px_rgba(15,23,42,0.16)]"
      style={{
        left,
        top,
      }}
    >
      <div className="border-b border-[#e8edf4] bg-[#f6f8fb] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#667085]">
          应用信息
        </p>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-medium text-[#98a2b3]">名称</p>
          <p className="mt-0.5 truncate text-[13px] font-semibold leading-5 text-[#101828]">
            {item.name}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#98a2b3]">路径</p>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-[#344054]" title={item.path}>
            {item.path}
          </p>
        </div>
      </div>
    </div>
  )
}

function SystemProjectDialog({
  categoryTitle,
  items,
  existingPaths,
  onClose,
  onSelect,
}: {
  categoryTitle: string
  items: SystemProjectOption[]
  existingPaths: Set<string>
  onClose: () => void
  onSelect: (item: SystemProjectOption) => void
}) {
  const groupedItems = items.reduce<Record<string, SystemProjectOption[]>>((groups, item) => {
    if (!groups[item.group]) {
      groups[item.group] = []
    }
    groups[item.group].push(item)
    return groups
  }, {})

  return (
    <div
      className="absolute inset-0 z-[120] flex items-center justify-center px-6 py-8"
      style={{ background: 'rgba(7, 15, 28, 0.24)', backdropFilter: 'blur(8px)' }}
    >
      <div className="max-h-full w-full max-w-[780px] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.42)] bg-[rgba(250,253,251,0.82)] shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur-[18px]">
        <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.08)] px-6 py-4">
          <div>
            <p className="text-[12px] font-medium tracking-[0.16em] text-[#5f6b7a]">
              系统项目
            </p>
            <h2 className="mt-1 text-[24px] font-semibold text-[#162033]">
              添加到 {categoryTitle}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-[9px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-4 py-2 text-[13px] text-[#334155] transition hover:bg-white"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="glass-scrollbar max-h-[68vh] overflow-y-auto px-6 py-5">
          {Object.entries(groupedItems).map(([group, groupItems]) => (
            <section key={group} className="mb-6 last:mb-0">
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-[15px] font-semibold text-[#132238]">{group}</h3>
                <div className="h-px flex-1 bg-[rgba(37,99,235,0.18)]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupItems.map((item) => {
                  const alreadyAdded = existingPaths.has(item.path.toLowerCase())
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={alreadyAdded}
                      className={[
                        'rounded-[10px] border px-4 py-4 text-left transition',
                        alreadyAdded
                          ? 'cursor-not-allowed border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.45)] opacity-60'
                          : 'border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.72)] hover:-translate-y-0.5 hover:border-[rgba(37,99,235,0.32)] hover:bg-white',
                      ].join(' ')}
                      onClick={() => onSelect(item)}
                    >
                      <div className="flex items-start gap-3">
                        <SystemProjectIcon
                          iconPath={item.staticIconPath ?? ''}
                          accent={item.accent}
                          fallback={SYSTEM_PROJECT_FALLBACK_ICONS[item.id] ?? item.monogram}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[17px] font-semibold text-[#102033]">
                              {item.name}
                            </p>
                            {alreadyAdded ? (
                              <span className="rounded-full bg-[rgba(15,23,42,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                                已添加
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px] text-[#64748b]">{item.alias}</p>
                          <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#425466]">
                            {item.summary}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function SystemProjectIcon({
  iconPath,
  accent,
  fallback,
}: {
  iconPath: string
  accent: string
  fallback: string
}) {
  if (iconPath) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
        <img
          src={iconPath}
          alt=""
          className="h-8 w-8 object-contain"
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[18px] font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
      style={{ background: accent }}
    >
      {fallback}
    </div>
  )
}

function UrlProjectDialog({
  categoryTitle,
  name,
  address,
  onNameChange,
  onAddressChange,
  onClose,
  onSubmit,
}: {
  categoryTitle: string
  name: string
  address: string
  onNameChange: (value: string) => void
  onAddressChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div
      className="absolute inset-0 z-[120] flex items-center justify-center px-6 py-8"
      style={{ background: 'rgba(7, 15, 28, 0.24)', backdropFilter: 'blur(8px)' }}
    >
      <div className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.42)] bg-[rgba(250,253,251,0.82)] shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur-[18px]">
        <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.08)] px-6 py-4">
          <div>
            <p className="text-[12px] font-medium tracking-[0.16em] text-[#5f6b7a]">URL 项目</p>
            <h2 className="mt-1 text-[24px] font-semibold text-[#162033]">
              添加到 {categoryTitle}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-[9px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-4 py-2 text-[13px] text-[#334155] transition hover:bg-white"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="glass-scrollbar max-h-[60vh] space-y-4 overflow-y-auto px-6 py-6">
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-[#324155]">项目名称</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="比如：OpenAI、公司后台、文档中心"
              className="h-11 w-full rounded-[10px] border border-[rgba(148,163,184,0.28)] bg-white/80 px-4 text-[14px] text-[#162033] outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-[#324155]">URL 地址</span>
            <input
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              placeholder="https://example.com"
              className="h-11 w-full rounded-[10px] border border-[rgba(148,163,184,0.28)] bg-white/80 px-4 text-[14px] text-[#162033] outline-none"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[rgba(15,23,42,0.08)] px-6 py-4">
          <button
            type="button"
            className="rounded-[9px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-4 py-2 text-[13px] text-[#334155] transition hover:bg-white"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-[9px] bg-[#162033] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#0f172a]"
            onClick={onSubmit}
          >
            添加项目
          </button>
        </div>
      </div>
    </div>
  )
}

function RenameItemDialog({
  item,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  item: LauncherItem
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const trimmedValue = value.trim()

  return (
    <div
      className="absolute inset-0 z-[120] flex items-center justify-center px-6 py-8"
      style={{ background: 'rgba(7, 15, 28, 0.22)', backdropFilter: 'blur(10px)' }}
    >
      <div className="w-full max-w-[460px] overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.42)] bg-[linear-gradient(180deg,rgba(253,254,255,0.92)_0%,rgba(246,249,253,0.86)_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-[20px]">
        <div className="border-b border-[rgba(15,23,42,0.08)] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7a90]">
            Display Name
          </p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#132238]">
            修改显示名称
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[#5f6f83]">
            仅修改 Orvex 面板中的显示名称，不会影响原文件或快捷方式。
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[16px] border border-[rgba(148,163,184,0.18)] bg-white/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a97aa]">当前路径</p>
            <p className="mt-1 truncate text-[12px] text-[#314155]" title={item.path}>
              {item.path}
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-[#324155]">新的显示名称</span>
            <input
              value={value}
              autoFocus
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && trimmedValue) {
                  event.preventDefault()
                  onSubmit()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onClose()
                }
              }}
              placeholder="输入新的显示名称"
              className="h-12 w-full rounded-[14px] border border-[rgba(148,163,184,0.24)] bg-white/82 px-4 text-[15px] text-[#132238] outline-none transition placeholder:text-[#9aa6b8] focus:border-[rgba(37,99,235,0.42)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[rgba(15,23,42,0.08)] px-6 py-4">
          <button
            type="button"
            className="rounded-[10px] border border-[rgba(15,23,42,0.08)] bg-white/72 px-4 py-2 text-[13px] font-medium text-[#334155] transition hover:bg-white"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!trimmedValue}
            className="rounded-[10px] bg-[#162033] px-4 py-2 text-[13px] font-medium text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:bg-[#0f172a] disabled:cursor-not-allowed disabled:bg-[#94a3b8] disabled:shadow-none"
            onClick={onSubmit}
          >
            保存名称
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsEntryButton({
  onClick,
  theme,
}: {
  onClick: () => void
  theme: 'dark' | 'light'
}) {
  return (
    <button
      type="button"
      aria-label="打开设置"
      title="打开设置"
      onMouseDown={(event) => {
        event.stopPropagation()
      }}
      onClick={onClick}
      className={[
        'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition active:scale-95',
      ].join(' ')}
      style={{
        borderColor: 'var(--panel-settings-border)',
        background: 'var(--panel-settings-bg)',
        color: 'var(--panel-settings-icon)',
        backdropFilter: theme === 'dark' ? 'blur(var(--panel-blur-strength))' : 'none',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--panel-settings-hover-bg)'
        event.currentTarget.style.borderColor = 'var(--panel-settings-hover-border)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'var(--panel-settings-bg)'
        event.currentTarget.style.borderColor = 'var(--panel-settings-border)'
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.4 13.5C18.48 13.02 18.48 12.98 18.48 12C18.48 11.02 18.48 10.98 18.4 10.5L20.15 9.15L18.35 6.05L16.25 6.9C15.55 6.35 15.05 6.05 14.2 5.75L13.9 3.5H10.1L9.8 5.75C8.95 6.05 8.45 6.35 7.75 6.9L5.65 6.05L3.85 9.15L5.6 10.5C5.52 10.98 5.52 11.02 5.52 12C5.52 12.98 5.52 13.02 5.6 13.5L3.85 14.85L5.65 17.95L7.75 17.1C8.45 17.65 8.95 17.95 9.8 18.25L10.1 20.5H13.9L14.2 18.25C15.05 17.95 15.55 17.65 16.25 17.1L18.35 17.95L20.15 14.85L18.4 13.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
      className="animate-context-menu fixed z-[90] min-w-[132px] rounded-[12px] border bg-[var(--panel-menu-bg)] py-1 shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
      style={{
        left: position.left,
        top: position.top,
        borderColor: 'var(--panel-menu-border)',
      }}
    >
      {children}
    </div>
  )
}

function ContextMenuItem({
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex h-8 w-full items-center px-4 text-left text-[13px] transition-colors duration-100',
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-[var(--panel-menu-hover-bg)]',
        danger ? 'text-[var(--panel-menu-danger)]' : 'text-[var(--panel-menu-text)]',
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

function buildPreviewItems(
  items: LauncherItem[],
  draggingItemId: string,
  targetItemId: string,
) {
  const sourceIndex = items.findIndex((item) => item.id === draggingItemId)
  const targetIndex = items.findIndex((item) => item.id === targetItemId)

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return items
  }

  const nextItems = [...items]
  const [draggingItem] = nextItems.splice(sourceIndex, 1)
  nextItems.splice(targetIndex, 0, draggingItem)
  return nextItems
}

function buildReorderedItemIds(
  items: LauncherItem[],
  draggingItemId: string,
  targetItemId: string,
) {
  const previewItems = buildPreviewItems(items, draggingItemId, targetItemId)
  if (previewItems === items) {
    return null
  }

  return previewItems.map((item) => item.id)
}

type PanelAppearanceOptions = {
  theme: 'dark' | 'light'
  sidebarOpacity: number
  contentOpacity: number
  backgroundOpacity: number
  itemCardColor: string
  itemCardOpacity: number
  iconShellColor: string
  iconShellOpacity: number
  searchPlaceholderColor: string
  hasImageBackground: boolean
}

type PanelAppearance = {
  bodyBackground: string
  baseLayer: string
  overlayLayer: string
  sidebarSurface: string
  rowHoverBg: string
  rowActiveBg: string
  rowAccent: string
  badgeBg: string
  badgeText: string
  searchSurface: string
  searchBorder: string
  searchPlaceholder: string
  flashBg: string
  flashBorder: string
  gridSurface: string
  gridBorder: string
  gridHoverBg: string
  itemBaseBg: string
  itemHoverBg: string
  overlayBg: string
  overlayCardBg: string
  overlayCardBorder: string
  timeText: string
  textStrong: string
  textSoft: string
  textMuted: string
  iconShellBg: string
  iconShellShadow: string
  settingsButtonBg: string
  settingsButtonBorder: string
  settingsButtonHoverBg: string
  settingsButtonHoverBorder: string
  settingsButtonIcon: string
  menuBg: string
  menuBorder: string
  menuHoverBg: string
  menuText: string
  menuDanger: string
}

function buildPanelAppearance({
  theme,
  sidebarOpacity,
  contentOpacity,
  backgroundOpacity,
  itemCardColor,
  itemCardOpacity,
  iconShellColor,
  iconShellOpacity,
  searchPlaceholderColor,
  hasImageBackground,
}: PanelAppearanceOptions): PanelAppearance {
  const isDark = theme === 'dark'
  const sidebarAlpha = clampOpacity(sidebarOpacity, 0, 1)
  const contentAlpha = clampOpacity(contentOpacity, 0, 1)
  const backgroundAlpha = clampOpacity(backgroundOpacity, 0, 1)
  const iconShellAlpha = clampOpacity(iconShellOpacity / 100, 0, 1)
  const softCardAlpha = clampOpacity(contentOpacity * 0.76, 0, 1)
  const hoverAlpha = clampOpacity(contentOpacity * 0.9, 0, 1)
  const borderAlpha = clampOpacity(contentOpacity * (isDark ? 0.18 : 0.14), 0, 1)
  const deep = [8, 14, 24] as const
  const deepSoft = [17, 26, 42] as const
  const light = [255, 255, 255] as const
  const lightSoft = [242, 246, 252] as const
  const itemCardRgb = hexToRgb(itemCardColor) ?? light
  const itemCardAlpha = clampOpacity(itemCardOpacity / 100, 0, 1)
  const itemCardHoverAlpha = clampOpacity(itemCardAlpha + 0.08, 0, 1)
  const iconShellRgb = hexToRgb(iconShellColor) ?? light
  const baseLayer =
    backgroundAlpha === 0
      ? 'transparent'
      : isDark
        ? `linear-gradient(180deg, rgba(7,17,29,${backgroundAlpha}) 0%, rgba(11,22,38,${backgroundAlpha}) 100%)`
        : `linear-gradient(180deg, rgba(251,252,255,${backgroundAlpha}) 0%, rgba(241,245,251,${backgroundAlpha}) 100%)`
  const overlayAlpha = backgroundAlpha
  const overlayLayer =
    overlayAlpha === 0
      ? 'transparent'
      : hasImageBackground
        ? isDark
          ? `linear-gradient(180deg, rgba(6,12,22,${overlayAlpha}) 0%, rgba(7,12,24,${overlayAlpha}) 100%)`
          : `linear-gradient(180deg, rgba(255,255,255,${overlayAlpha}) 0%, rgba(241,245,249,${overlayAlpha}) 100%)`
        : isDark
          ? `linear-gradient(180deg, rgba(8,14,24,${overlayAlpha}) 0%, rgba(12,20,34,${overlayAlpha}) 100%)`
          : `linear-gradient(180deg, rgba(255,255,255,${overlayAlpha}) 0%, rgba(243,246,252,${overlayAlpha}) 100%)`

  if (isDark) {
    return {
      bodyBackground: 'transparent',
      baseLayer,
      overlayLayer,
      sidebarSurface: toRgba(deepSoft, sidebarAlpha),
      rowHoverBg: toRgba(light, hoverAlpha * 0.22),
      rowActiveBg: toRgba(light, hoverAlpha * 0.28),
      rowAccent: '#F8FBFF',
      badgeBg: toRgba(light, 0.1),
      badgeText: '#C8D2E4',
      searchSurface: toRgba(deepSoft, contentAlpha),
      searchBorder: toRgba(light, borderAlpha),
      searchPlaceholder: searchPlaceholderColor,
      flashBg: toRgba(deep, 0.92),
      flashBorder: toRgba(light, 0.12),
      gridSurface: toRgba(deepSoft, softCardAlpha),
      gridBorder: toRgba(light, borderAlpha),
      gridHoverBg: toRgba(light, contentAlpha * 0.16),
      itemBaseBg: toRgba(itemCardRgb, itemCardAlpha),
      itemHoverBg: toRgba(itemCardRgb, itemCardHoverAlpha),
      overlayBg: toRgba(deep, 0.42),
      overlayCardBg: toRgba(deepSoft, clampOpacity(contentAlpha + 0.06, 0, 1)),
      overlayCardBorder: toRgba(light, 0.14),
      timeText: '#95A5BE',
      textStrong: '#F5F8FD',
      textSoft: '#D5DDEC',
      textMuted: '#93A4BD',
      iconShellBg: toRgba(iconShellRgb, iconShellAlpha),
      iconShellShadow: '0 10px 24px rgba(2, 6, 23, 0.24)',
      settingsButtonBg: toRgba(deepSoft, contentAlpha),
      settingsButtonBorder: toRgba(light, 0.12),
      settingsButtonHoverBg: toRgba(light, 0.16),
      settingsButtonHoverBorder: toRgba(light, 0.22),
      settingsButtonIcon: '#E2E8F0',
      menuBg: toRgba(deepSoft, 0.96),
      menuBorder: toRgba(light, 0.12),
      menuHoverBg: toRgba(light, 0.12),
      menuText: '#E5EDF8',
      menuDanger: '#FCA5A5',
    }
  }

  return {
    bodyBackground: 'transparent',
    baseLayer,
    overlayLayer,
    sidebarSurface: toRgba(light, sidebarAlpha),
    rowHoverBg: toRgba(lightSoft, hoverAlpha * 0.82),
    rowActiveBg: toRgba(light, hoverAlpha * 0.96),
    rowAccent: '#333333',
    badgeBg: 'rgba(148,163,184,0.18)',
    badgeText: '#64748B',
    searchSurface: toRgba(light, contentAlpha),
    searchBorder: 'rgba(148,163,184,0.2)',
    searchPlaceholder: searchPlaceholderColor,
    flashBg: 'rgba(15,23,42,0.94)',
    flashBorder: 'rgba(15,23,42,0.08)',
    gridSurface: toRgba(light, softCardAlpha),
    gridBorder: 'rgba(148,163,184,0.18)',
    gridHoverBg: toRgba(lightSoft, contentAlpha * 0.72),
    itemBaseBg: toRgba(itemCardRgb, itemCardAlpha),
    itemHoverBg: toRgba(itemCardRgb, itemCardHoverAlpha),
    overlayBg: 'rgba(255,255,255,0.42)',
    overlayCardBg: toRgba(light, clampOpacity(contentAlpha + 0.04, 0, 1)),
    overlayCardBorder: 'rgba(148,163,184,0.22)',
    timeText: '#8B98AD',
    textStrong: '#0F172A',
    textSoft: '#475569',
    textMuted: '#94A3B8',
    iconShellBg: toRgba(iconShellRgb, iconShellAlpha),
    iconShellShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
    settingsButtonBg: toRgba(light, contentAlpha),
    settingsButtonBorder: 'rgba(15,23,42,0.08)',
    settingsButtonHoverBg: 'rgba(255,255,255,0.98)',
    settingsButtonHoverBorder: 'rgba(15,23,42,0.18)',
    settingsButtonIcon: '#475569',
    menuBg: 'rgba(255,255,255,0.98)',
    menuBorder: 'rgba(148,163,184,0.18)',
    menuHoverBg: 'rgba(241,245,249,0.9)',
    menuText: '#334155',
    menuDanger: '#E11D48',
  }
}

function toRgba(color: readonly [number, number, number], alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${clampOpacity(alpha, 0, 1)})`
}

function hexToRgb(value: string): readonly [number, number, number] | null {
  const trimmed = value.trim().replace(/^#/, '')

  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.split('').map((character) => Number.parseInt(character + character, 16))
    return [r, g, b]
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return [
      Number.parseInt(trimmed.slice(0, 2), 16),
      Number.parseInt(trimmed.slice(2, 4), 16),
      Number.parseInt(trimmed.slice(4, 6), 16),
    ]
  }

  return null
}

function buildMonogram(name: string, fallback: string) {
  const monogram = name
    .trim()
    .split('')
    .filter((character) => !/\s|[-_]/.test(character))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return monogram || fallback
}

function clampOpacity(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default LauncherPanel
