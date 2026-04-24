import { dialog } from 'electron'

export async function openFileDialog(
  filters: Electron.FileFilter[] = []
): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters
  })
  return canceled || filePaths.length === 0 ? null : filePaths[0]
}
