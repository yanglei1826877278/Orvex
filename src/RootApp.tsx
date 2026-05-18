import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App'
import LauncherPanel from './panel/LauncherPanel'
import SettingsWindow from './settings/SettingsWindow'

function RootApp() {
  const currentWindow = getCurrentWindow()
  const requestedWindow = new URLSearchParams(window.location.search).get('window')

  if (currentWindow.label === 'launcher-panel' || requestedWindow === 'launcher-panel') {
    return <LauncherPanel />
  }

  if (currentWindow.label === 'settings' || requestedWindow === 'settings') {
    return <SettingsWindow />
  }

  return <App />
}

export default RootApp
