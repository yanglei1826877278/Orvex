import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type {
  CreateCategoryPayload,
  CreateLauncherItemFromPathPayload,
  CreateLauncherItemPayload,
  LaunchResult,
  LauncherState,
  RestoreBackupResult,
  SettingsState,
  UpdateSettingsPayload,
  UpdateCategoryPayload,
  UpdateLauncherItemPayload,
} from '../types/launcher'

export async function loadLauncherState() {
  return invoke<LauncherState>('load_launcher_state')
}

export async function loadSettingsState() {
  return invoke<SettingsState>('load_settings_state')
}

export async function importBackgroundImage(sourcePath: string) {
  return invoke<string>('import_background_image', { sourcePath })
}

export async function cacheIconFromSource(sourcePath: string) {
  return invoke<string | null>('cache_icon_from_source', { sourcePath })
}

export async function createCategory(payload: CreateCategoryPayload) {
  return invoke<LauncherState>('create_category', { payload })
}

export async function createLauncherItem(payload: CreateLauncherItemPayload) {
  return invoke<LauncherState>('create_launcher_item', { payload })
}

export async function createLauncherItemFromPath(
  payload: CreateLauncherItemFromPathPayload,
) {
  return invoke<LauncherState>('create_launcher_item_from_path', { payload })
}

export async function updateCategory(payload: UpdateCategoryPayload) {
  return invoke<LauncherState>('update_category', { payload })
}

export async function updateLauncherItem(payload: UpdateLauncherItemPayload) {
  return invoke<LauncherState>('update_launcher_item', { payload })
}

export async function updateSettingsState(payload: UpdateSettingsPayload) {
  return invoke<SettingsState>('update_settings_state', { payload })
}

export async function createBackupArchive() {
  return invoke<string>('create_backup_archive')
}

export async function restoreBackupArchive(content: string) {
  return invoke<RestoreBackupResult>('restore_backup_archive', { content })
}

export async function openSettingsWindow() {
  return invoke<void>('open_settings_window')
}

export async function hideLauncherPanel() {
  return invoke<void>('hide_launcher_panel')
}

export async function deleteCategory(categoryId: string) {
  return invoke<LauncherState>('delete_category', { categoryId })
}

export async function deleteLauncherItem(itemId: string) {
  return invoke<LauncherState>('delete_launcher_item', { itemId })
}

export async function launchLauncherItem(itemId: string) {
  return invoke<LaunchResult>('launch_item', { itemId })
}

export async function launchLauncherItemAsAdmin(itemId: string) {
  return invoke<LaunchResult>('launch_item_as_admin', { itemId })
}

export async function openLauncherItemLocation(itemId: string) {
  return invoke<LaunchResult>('open_item_location', { itemId })
}

export async function getStorageDirectory() {
  return invoke<string>('get_storage_directory')
}

export function toAssetUrl(filePath: string) {
  return convertFileSrc(filePath)
}

export async function minimizeWindow() {
  return getCurrentWindow().minimize()
}

export async function toggleMaximizeWindow() {
  return getCurrentWindow().toggleMaximize()
}

export async function closeWindow() {
  return getCurrentWindow().close()
}

export async function isWindowMaximized() {
  return getCurrentWindow().isMaximized()
}

export async function startWindowDrag() {
  return getCurrentWindow().startDragging()
}

export async function startWindowResize(
  direction:
    | 'East'
    | 'North'
    | 'NorthEast'
    | 'NorthWest'
    | 'South'
    | 'SouthEast'
    | 'SouthWest'
    | 'West',
) {
  return getCurrentWindow().startResizeDragging(direction)
}
