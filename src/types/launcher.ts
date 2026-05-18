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
}

export type LauncherState = {
  categories: Category[]
  items: LauncherItem[]
}

export type ThemeMode = 'dark' | 'light'

export type SettingsState = {
  theme: ThemeMode
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
}

export type UpdateSettingsPayload = {
  theme: ThemeMode
}
