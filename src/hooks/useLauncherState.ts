import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  createCategory,
  createLauncherItemFromPath,
  createLauncherItem,
  deleteCategory,
  deleteLauncherItem,
  getStorageDirectory,
  launchLauncherItem,
  loadLauncherState,
  loadSettingsState,
  openLauncherItemLocation,
  reorderLauncherItems,
  updateCategory,
  updateLauncherItem,
  updateSettingsState,
} from '../lib/tauri'
import type {
  CreateCategoryPayload,
  CreateLauncherItemFromPathPayload,
  CreateLauncherItemPayload,
  LaunchResult,
  LauncherState,
  SettingsState,
  UpdateSettingsPayload,
  UpdateCategoryPayload,
  UpdateLauncherItemPayload,
} from '../types/launcher'

type LauncherStateResult = {
  launcherState: LauncherState | null
  settingsState: SettingsState | null
  storageDirectory: string
  loading: boolean
  error: string
  addCategory: (payload: CreateCategoryPayload) => Promise<LauncherState>
  addLauncherItem: (payload: CreateLauncherItemPayload) => Promise<void>
  addLauncherItemFromPath: (payload: CreateLauncherItemFromPathPayload) => Promise<void>
  editCategory: (payload: UpdateCategoryPayload) => Promise<void>
  editLauncherItem: (payload: UpdateLauncherItemPayload) => Promise<void>
  removeCategory: (categoryId: string) => Promise<void>
  removeLauncherItem: (itemId: string) => Promise<void>
  reorderItems: (itemIds: string[]) => Promise<void>
  launchItem: (itemId: string) => Promise<LaunchResult>
  openItemLocation: (itemId: string) => Promise<LaunchResult>
  updateSettings: (payload: UpdateSettingsPayload) => Promise<SettingsState>
  reloadState: () => Promise<void>
}

export function useLauncherState(): LauncherStateResult {
  const [launcherState, setLauncherState] = useState<LauncherState | null>(null)
  const [settingsState, setSettingsState] = useState<SettingsState | null>(null)
  const [storageDirectory, setStorageDirectory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refreshState() {
    const [state, settings, directory] = await Promise.all([
      loadLauncherState(),
      loadSettingsState(),
      getStorageDirectory(),
    ])

    setLauncherState(state)
    setSettingsState(settings)
    setStorageDirectory(directory)
    setError('')
  }

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      try {
        const [state, settings, directory] = await Promise.all([
          loadLauncherState(),
          loadSettingsState(),
          getStorageDirectory(),
        ])

        if (!alive) {
          return
        }

        setLauncherState(state)
        setSettingsState(settings)
        setStorageDirectory(directory)
        setError('')
      } catch (caughtError) {
        if (!alive) {
          return
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load launcher state.',
        )
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let unlisteners: Array<() => void> = []

    async function bindEvents() {
      const listeners = await Promise.all([
        listen('orvex://settings-updated', () => {
          void refreshState()
        }),
        listen('orvex://launcher-state-updated', () => {
          void refreshState()
        }),
      ])

      if (disposed) {
        listeners.forEach((unlisten) => unlisten())
        return
      }

      unlisteners = listeners
    }

    void bindEvents()

    return () => {
      disposed = true
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [])

  async function addCategory(payload: CreateCategoryPayload) {
    const nextState = await createCategory(payload)
    setLauncherState(nextState)
    return nextState
  }

  async function addLauncherItem(payload: CreateLauncherItemPayload) {
    const nextState = await createLauncherItem(payload)
    setLauncherState(nextState)
  }

  async function addLauncherItemFromPath(payload: CreateLauncherItemFromPathPayload) {
    const nextState = await createLauncherItemFromPath(payload)
    setLauncherState(nextState)
  }

  async function editCategory(payload: UpdateCategoryPayload) {
    const nextState = await updateCategory(payload)
    setLauncherState(nextState)
  }

  async function editLauncherItem(payload: UpdateLauncherItemPayload) {
    const nextState = await updateLauncherItem(payload)
    setLauncherState(nextState)
  }

  async function removeCategory(categoryId: string) {
    const nextState = await deleteCategory(categoryId)
    setLauncherState(nextState)
  }

  async function removeLauncherItem(itemId: string) {
    const nextState = await deleteLauncherItem(itemId)
    setLauncherState(nextState)
  }

  async function reorderItems(itemIds: string[]) {
    const nextState = await reorderLauncherItems({ itemIds })
    setLauncherState(nextState)
  }

  async function launchItem(itemId: string) {
    const result = await launchLauncherItem(itemId)
    await refreshState()
    return result
  }

  async function openItemLocation(itemId: string) {
    return openLauncherItemLocation(itemId)
  }

  async function updateSettings(payload: UpdateSettingsPayload) {
    const nextSettings = await updateSettingsState(payload)
    setSettingsState(nextSettings)
    return nextSettings
  }

  return {
    launcherState,
    settingsState,
    storageDirectory,
    loading,
    error,
    addCategory,
    addLauncherItem,
    addLauncherItemFromPath,
    editCategory,
    editLauncherItem,
    removeCategory,
    removeLauncherItem,
    reorderItems,
    launchItem,
    openItemLocation,
    updateSettings,
    reloadState: refreshState,
  }
}
