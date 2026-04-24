import { useEffect } from 'react'
import { useLogsStore } from '@renderer/store/logs'
import { useSourcesStore } from '@renderer/store/sources'

/**
 * 전역 1회 구독 — 모든 소스의 로그 스트림을 useLogsStore.sourceLines 에 쌓는다.
 * 각 Canvas 컴포넌트는 스토어의 해당 sourceId 만 구독하므로 불필요한 리렌더가 없다.
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
