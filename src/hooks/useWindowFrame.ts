import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isWindowMaximized } from '../lib/tauri'

export function useWindowFrame() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let disposed = false
    let disposeFns: Array<() => void> = []

    async function bind() {
      const appWindow = getCurrentWindow()

      const sync = async () => {
        const maximized = await isWindowMaximized()
        if (!disposed) {
          setIsMaximized(maximized)
        }
      }

      await sync()

      disposeFns = await Promise.all([
        appWindow.onResized(sync),
        appWindow.onMoved(sync),
      ])
    }

    void bind()

    return () => {
      disposed = true
      disposeFns.forEach((dispose) => dispose())
    }
  }, [])

  return { isMaximized }
}
