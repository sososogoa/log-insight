import { useEffect } from 'react'
import { useLogsStore } from '@renderer/store/logs'
import { useSourcesStore } from '@renderer/store/sources'

/**
 * Single global subscription — accumulates all source log streams into useLogsStore.sourceLines.
 * Each Canvas component subscribes only to its sourceId in the store, so no unnecessary re-renders occur.
 */
export function useGlobalLogIngest(): void {
  const appendBatch = useLogsStore((s) => s.appendBatch)
  const setError = useSourcesStore((s) => s.setError)

  useEffect(() => {
    const offBatch = window.api.logs.onLineBatch((batch) => appendBatch(batch))
    const offLine = window.api.logs.onLine((line) => appendBatch([line]))
    const offError = window.api.logs.onError(({ sourceId, message }) =>
      setError(sourceId, message)
    )
    return () => {
      offBatch()
      offLine()
      offError()
    }
  }, [appendBatch, setError])
}
