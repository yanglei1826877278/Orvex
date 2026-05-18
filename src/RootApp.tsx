import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App'
import LauncherPanel from './panel/LauncherPanel'
import SettingsWindow from './settings/SettingsWindow'
import PickerWindow from './tools/PickerWindow'
import TodoWindow from './tools/TodoWindow'

function RootApp() {
  const currentWindow = getCurrentWindow()
  const requestedWindow = new URLSearchParams(window.location.search).get('window')

  if (currentWindow.label === 'launcher-panel' || requestedWindow === 'launcher-panel') {
    return <LauncherPanel />
  }

  if (currentWindow.label === 'settings' || requestedWindow === 'settings') {
    return <SettingsWindow />
  }

  if (currentWindow.label === 'todo' || requestedWindow === 'todo') {
    return <TodoWindow />
  }

  if (currentWindow.label === 'picker' || requestedWindow === 'picker') {
    return <PickerWindow />
  }

  return <App />
}

export default RootApp
