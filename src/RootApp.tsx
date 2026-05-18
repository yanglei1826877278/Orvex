import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App'
import LauncherPanel from './panel/LauncherPanel'

function RootApp() {
  const currentWindow = getCurrentWindow()
  return currentWindow.label === 'launcher-panel' ? <LauncherPanel /> : <App />
}

export default RootApp
