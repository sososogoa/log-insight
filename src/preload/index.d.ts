import type { ElectronAPI } from '@electron-toolkit/preload'
import type { LogInsightApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: LogInsightApi
  }
}
