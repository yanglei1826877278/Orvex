export type Category = {
  id: string
  title: string
  caption: string
  description: string
  accent: string
  sort: number
}

export type LauncherItemKind = 'app' | 'folder' | 'workspace' | 'url'

export type LauncherItem = {
  id: string
  order: number
  categoryId: string
  name: string
  alias: string
  kind: LauncherItemKind
  summary: string
  path: string
  iconPath: string | null
  hotkey: string
  usage: string
  monogram: string
  accent: string
  launchCount: number
}

export type LauncherState = {
  categories: Category[]
  items: LauncherItem[]
}

export type ThemeMode = 'dark' | 'light'

export type SortMode = 'custom' | 'usage' | 'name'

export type BackgroundType = 'image' | 'solid'

export type UpdateSource = 'gitee' | 'github'

export type HotkeySetting = {
  value: string
  enabled: boolean
}

export type AppearanceSettings = {
  category_font_size: number
  category_font_color: string
  item_font_size: number
  item_font_color: string
  search_placeholder_color: string
}

export type SettingsState = {
  launchAtStartup: boolean
  showPanelOnStartup: boolean
  closePanelAfterLaunch: boolean
  sortMode: SortMode
  backupRetentionDays: number
  theme: ThemeMode
  backgroundType: BackgroundType
  backgroundImagePath: string
  frostedGlass: boolean
  frostedGlassStrength: number
  sidebarOpacity: number
  contentOpacity: number
  backgroundOpacity: number
  itemCardColor: string
  itemCardOpacity: number
  iconShellColor: string
  iconShellOpacity: number
  transparentDragonHeader: boolean
  appearance: AppearanceSettings
  showCategoryCounts: boolean
  showIconTitles: boolean
  panelHotkey: HotkeySetting
  todoHotkey: HotkeySetting
  pickerHotkey: HotkeySetting
  updateSource: UpdateSource
}

export type LaunchResult = {
  itemId: string
  launched: boolean
  detail: string
}

export type CreateCategoryPayload = {
  title: string
  caption: string
  description: string
  accent: string
}

export type CreateLauncherItemPayload = {
  categoryId: string
  name: string
  alias: string
  kind: LauncherItemKind
  summary: string
  path: string
  iconSourcePath?: string | null
  hotkey: string
  usage: string
  monogram: string
  accent: string
}

export type CreateLauncherItemFromPathPayload = {
  categoryId: string
  path: string
}

export type UpdateCategoryPayload = CreateCategoryPayload & {
  id: string
}

export type UpdateLauncherItemPayload = CreateLauncherItemPayload & {
  id: string
  order: number
}

export type ReorderLauncherItemsPayload = {
  itemIds: string[]
}

export type UpdateSettingsPayload = {
  launchAtStartup: boolean
  showPanelOnStartup: boolean
  closePanelAfterLaunch: boolean
  sortMode: SortMode
  backupRetentionDays: number
  theme: ThemeMode
  backgroundType: BackgroundType
  backgroundImagePath: string
  frostedGlass: boolean
  frostedGlassStrength: number
  sidebarOpacity: number
  contentOpacity: number
  backgroundOpacity: number
  itemCardColor: string
  itemCardOpacity: number
  iconShellColor: string
  iconShellOpacity: number
  transparentDragonHeader: boolean
  appearance: AppearanceSettings
  showCategoryCounts: boolean
  showIconTitles: boolean
  panelHotkey: HotkeySetting
  todoHotkey: HotkeySetting
  pickerHotkey: HotkeySetting
  updateSource: UpdateSource
}

export type RestoreBackupResult = {
  launcherState: LauncherState
  settingsState: SettingsState
}
