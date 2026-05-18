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

type HoverCardState = {
  item: LauncherItem | null
  x: number
  y: number
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
    removeLauncherItem,
    openItemLocation,
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
  const [itemMenu, setItemMenu] = useState<ItemMenuState>({
    open: false,
    x: 0,
    y: 0,
    item: null,
  })
  const [hoverCard, setHoverCard] = useState<HoverCardState>({
    item: null,
    x: 0,
    y: 0,
  })
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null)
  const [previewSettings, setPreviewSettings] = useState<SettingsState | null>(null)
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
  const rootBackgroundOpacity = (effectiveSettings?.backgroundOpacity ?? 88) / 100
  const sidebarOpacity = (effectiveSettings?.sidebarOpacity ?? 92) / 100
  const contentOpacity = (effectiveSettings?.contentOpacity ?? 92) / 100
  const frostedGlassEnabled = effectiveSettings?.frostedGlass !== false
  const frostedGlassStrength = effectiveSettings?.frostedGlassStrength ?? 14
  const transparentDragonHeader = effectiveSettings?.transparentDragonHeader === true
  const appearanceSettings = effectiveSettings?.appearance
  const categoryFontSize = appearanceSettings?.category_font_size ?? 14
  const categoryFontColor = appearanceSettings?.category_font_color ?? '#333333'
  const itemFontSize = appearanceSettings?.item_font_size ?? 13
  const itemFontColor = appearanceSettings?.item_font_color ?? '#333333'
  const panelAppearance = useMemo(
    () =>
      buildPanelAppearance({
        theme,
        sidebarOpacity,
        contentOpacity,
        backgroundOpacity: rootBackgroundOpacity,
        hasImageBackground: Boolean(backgroundImageUrl),
      }),
    [backgroundImageUrl, contentOpacity, rootBackgroundOpacity, sidebarOpacity, theme],
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
        '--panel-flash-bg': panelAppearance.flashBg,
        '--panel-flash-border': panelAppearance.flashBorder,
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
    if (!sidebarMenu.open && !itemMenu.open) {
      return
    }

    const close = () => {
      setSidebarMenu({ open: false, x: 0, y: 0, category: null })
      setItemMenu({ open: false, x: 0, y: 0, item: null })
    }
    window.addEventListener('click', close)

    return () => {
      window.removeEventListener('click', close)
    }
  }, [itemMenu.open, sidebarMenu.open])

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
      const result = await launchItem(item.id)
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
          setFlash(`${item.name}${result.detail}，但自动关闭面板失败`)
          return
        }
      }

      setFlash(`${item.name}${result.detail}`)
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? `启动失败：${caughtError.message}` : '启动失败')
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
      const result = await openItemLocation(item.id)
      setFlash(`${item.name}${result.detail}`)
    } catch (caughtError) {
      setFlash(
        caughtError instanceof Error
          ? `打开位置失败：${caughtError.message}`
          : '打开位置失败',
      )
    }
  }

  async function handleRemoveItem(item: LauncherItem) {
    try {
      await removeLauncherItem(item.id)
      setFlash(`${item.name} 已从列表移除`)
    } catch (caughtError) {
      setFlash(caughtError instanceof Error ? caughtError.message : '移除启动项失败')
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
              setFlash(error instanceof Error ? error.message : '打开设置窗口失败')
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

        <div className="relative z-10 grid h-full grid-cols-[160px_minmax(0,1fr)]">
          <aside
            ref={categoryRailRef}
            className="flex h-full flex-col border-r px-3 py-4"
            style={{
              background: panelAppearance.sidebarSurface,
              backdropFilter: 'blur(0px)',
              borderRightColor: 'rgba(0, 0, 0, 0.06)',
              borderRightStyle: 'solid',
            }}
            onContextMenuCapture={handleSidebarContextMenuCapture}
            onContextMenu={handleSidebarContextMenu}
          >
            <div ref={categoryListRef} className="space-y-1">
              {categories.map((category, index) => {
                const isActive = category.id === activeCategory.id
                const isRenaming = renamingCategoryId === category.id
                const pianoMotion = getCategoryPianoMotion(
                  index,
                  hoveredCategoryIndex,
                  categoryFontSize,
                )
                const categoryFontSizeValue = pianoMotion.fontSize
                const categoryTitleColor = categoryFontColor
                const categoryTitleWeight = isActive || isRenaming || index === hoveredCategoryIndex ? 600 : 400
                const rowClass = [
                  'relative flex w-full items-center justify-between rounded-[12px] px-3 text-left transition-[height] duration-150 ease',
                ].join(' ')

                if (isRenaming) {
                  return (
                    <div
                      key={category.id}
                      data-category-item="true"
                      data-category-index={index}
                      className={rowClass}
                      style={{ color: categoryFontColor, height: `${pianoMotion.height}px` }}
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
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: categoryFontColor,
                          color: '#fff',
                        }}
                      >
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
                      data-category-index={index}
                      className={rowClass}
                      style={{ color: categoryTitleColor, height: `${pianoMotion.height}px` }}
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
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: isActive ? categoryFontColor : '#eee',
                        color: isActive ? '#fff' : '#999',
                      }}
                    >
                      {category.count}
                    </span>
                  </button>
                )
              })}

              {creatingCategory ? (
                <div
                  data-category-create="true"
                  className="relative flex h-9 w-full items-center rounded-[12px] px-3 text-[13px] text-[var(--panel-text-strong)]"
                  style={{ backgroundColor: panelAppearance.rowActiveBg }}
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

            <div className="mt-auto px-4 pt-4">
              <div className="text-left text-[28px] font-light text-[#555]">
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
                className="w-full rounded-[16px] border px-4 py-3 text-sm outline-none transition placeholder:text-[#888]"
                style={{
                  background: panelAppearance.searchSurface,
                  borderColor: panelAppearance.searchBorder,
                  color: panelAppearance.textStrong,
                  backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength}px)` : 'none',
                }}
              />
            </div>

            {flash ? (
              <div
                className="mt-3 rounded-[14px] border px-3 py-2 text-[12px] text-[var(--panel-text-strong)]"
                style={{
                  background: panelAppearance.flashBg,
                  borderColor: panelAppearance.flashBorder,
                  backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength}px)` : 'none',
                }}
              >
                {flash}
              </div>
            ) : null}

            <div className="relative mt-4 min-h-0 flex-1">
              <div
                ref={iconGridRef}
                className="h-full overflow-y-auto rounded-[16px] border pr-1 transition"
                style={{
                  background: dragOverIcons ? panelAppearance.gridHoverBg : panelAppearance.gridSurface,
                  borderColor: panelAppearance.gridBorder,
                  backdropFilter: frostedGlassEnabled ? `blur(${frostedGlassStrength}px)` : 'none',
                }}
              >
                <div className="grid min-h-full auto-rows-max content-start grid-cols-[repeat(auto-fill,minmax(80px,1fr))] items-start gap-3 rounded-[16px] border border-transparent p-2 transition">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={[
                        'group flex min-h-[96px] flex-col items-center justify-start rounded-[14px] border border-transparent px-2 py-2 transition',
                        'bg-[var(--panel-item-bg)] hover:-translate-y-0.5 hover:bg-[var(--panel-item-hover-bg)]',
                      ].join(' ')}
                      style={{
                        backdropFilter: frostedGlassEnabled
                          ? `blur(${Math.max(0, frostedGlassStrength - 2)}px)`
                          : 'none',
                      }}
                      onMouseEnter={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setHoverCard({
                          item,
                          x: rect.right + 12,
                          y: rect.top + rect.height / 2,
                        })
                      }}
                      onMouseMove={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setHoverCard((current) =>
                          current.item?.id === item.id
                            ? {
                                item,
                                x: rect.right + 12,
                                y: rect.top + rect.height / 2,
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
            <ContextMenuItem label="管理员方式运行" disabled />
            <ContextMenuItem
              label="打开文件所在位置"
              onClick={() => {
                void handleOpenLocation(itemMenu.item!)
                setItemMenu({ open: false, x: 0, y: 0, item: null })
              }}
            />
            <ContextMenuItem label="添加URL项目" disabled />
            <ContextMenuItem label="添加系统项目" disabled />
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
  return (
    <div
      className="pointer-events-none fixed z-[95] w-[280px] overflow-hidden rounded-[18px] border border-[#d8dee8] bg-[#fdfefe] text-left shadow-[0_22px_50px_rgba(15,23,42,0.18)]"
      style={{
        left: Math.min(x, window.innerWidth - 296),
        top: Math.max(12, Math.min(y - 58, window.innerHeight - 154)),
      }}
    >
      <div className="border-b border-[#e8edf4] bg-[#f6f8fb] px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]">
          应用信息
        </p>
      </div>
      <div className="px-4 py-3.5">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-medium text-[#98a2b3]">路径</p>
            <p className="mt-1 break-all text-[12px] leading-5 text-[#344054]">{item.path}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#98a2b3]">名称</p>
            <p className="mt-1 text-[20px] font-semibold leading-6 text-[#101828]">
              {item.name}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-[12px] bg-[#f7f9fc] px-3 py-2">
            <span className="text-[12px] font-medium text-[#667085]">使用次数</span>
            <span className="text-[14px] font-semibold text-[#101828]">{item.launchCount}</span>
          </div>
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

function getCategoryPianoMotion(
  index: number,
  hoveredIndex: number | null,
  baseFontSize: number,
) {
  if (hoveredIndex === null || index !== hoveredIndex) {
    return { fontSize: baseFontSize, height: 40 }
  }

  return { fontSize: Math.max(baseFontSize, 17), height: 48 }
}

type PanelAppearanceOptions = {
  theme: 'dark' | 'light'
  sidebarOpacity: number
  contentOpacity: number
  backgroundOpacity: number
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
  hasImageBackground,
}: PanelAppearanceOptions): PanelAppearance {
  const isDark = theme === 'dark'
  const sidebarAlpha = clampOpacity(sidebarOpacity, 0, 1)
  const contentAlpha = clampOpacity(contentOpacity, 0, 1)
  const backgroundAlpha = clampOpacity(backgroundOpacity, 0, 1)
  const softCardAlpha = clampOpacity(contentOpacity * 0.76, 0, 1)
  const hoverAlpha = clampOpacity(contentOpacity * 0.9, 0, 1)
  const borderAlpha = clampOpacity(contentOpacity * (isDark ? 0.18 : 0.14), 0, 1)
  const deep = [8, 14, 24] as const
  const deepSoft = [17, 26, 42] as const
  const light = [255, 255, 255] as const
  const lightSoft = [242, 246, 252] as const
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
      searchPlaceholder: '#90A1BB',
      flashBg: toRgba(deep, 0.92),
      flashBorder: toRgba(light, 0.12),
      gridSurface: toRgba(deepSoft, softCardAlpha),
      gridBorder: toRgba(light, borderAlpha),
      gridHoverBg: toRgba(light, contentAlpha * 0.16),
      itemBaseBg: toRgba(light, softCardAlpha * 0.56),
      itemHoverBg: toRgba(light, hoverAlpha * 0.36),
      overlayBg: toRgba(deep, 0.42),
      overlayCardBg: toRgba(deepSoft, clampOpacity(contentAlpha + 0.06, 0, 1)),
      overlayCardBorder: toRgba(light, 0.14),
      timeText: '#95A5BE',
      textStrong: '#F5F8FD',
      textSoft: '#D5DDEC',
      textMuted: '#93A4BD',
      iconShellBg: 'rgba(255,255,255,0.94)',
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
    searchPlaceholder: '#94A3B8',
    flashBg: 'rgba(15,23,42,0.94)',
    flashBorder: 'rgba(15,23,42,0.08)',
    gridSurface: toRgba(light, softCardAlpha),
    gridBorder: 'rgba(148,163,184,0.18)',
    gridHoverBg: toRgba(lightSoft, contentAlpha * 0.72),
    itemBaseBg: toRgba(light, softCardAlpha * 0.78),
    itemHoverBg: toRgba(light, hoverAlpha),
    overlayBg: 'rgba(255,255,255,0.42)',
    overlayCardBg: toRgba(light, clampOpacity(contentAlpha + 0.04, 0, 1)),
    overlayCardBorder: 'rgba(148,163,184,0.22)',
    timeText: '#8B98AD',
    textStrong: '#0F172A',
    textSoft: '#475569',
    textMuted: '#94A3B8',
    iconShellBg: 'rgba(255,255,255,0.94)',
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

function clampOpacity(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default LauncherPanel
