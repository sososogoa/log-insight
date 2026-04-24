/**
 * 로그 텍스트의 "구조적 지문(fingerprint)"을 만든다.
 * 타임스탬프·UUID·숫자 등 가변 토큰을 플레이스홀더로 치환해
 * 같은 패턴의 로그를 같은 문자열로 매핑한다.
 *
 * 목적: 반복 로그 그루핑 & Focus 모드에서 "같은 형태의 줄만 보기".
 */

const RE_ISO_LEADING = /^\s*\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?Z?\]?\s*/
const RE_HHMMSS = /\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const RE_IP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g
const RE_HEX = /\b[0-9a-f]{8,}\b/gi
const RE_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const RE_QUOTED_DQ = /"[^"]*"/g
const RE_QUOTED_SQ = /'[^']*'/g
const RE_PATH_NUM = /(\/[A-Za-z0-9_-]+)(\/\d+)+/g
const RE_NUMBER = /(?<![A-Za-z])-?\d+(?:\.\d+)?(?![A-Za-z])/g
const RE_WS = /\s+/g

/**
 * 캐싱 — fingerprint 는 text 에만 의존하므로 동일 text 의 재계산을 피함.
 * Map 을 쓰되 MAX_ENTRIES 초과 시 가장 오래된 엔트리부터 삭제 (간단 LRU).
 * FIFO 로그 버퍼가 돌면 오래된 라인은 참조에서 사라져 캐시도 시간이 지나면 해소.
 */
const FP_CACHE_MAX = 20_000
const fpCache = new Map<string, string>()

function cacheSet(key: string, value: string): string {
  if (fpCache.size >= FP_CACHE_MAX) {
    // 앞쪽 1/8 을 비움 (엔트리 만 개 씩 삭제)
    const toDelete = FP_CACHE_MAX / 8
    let i = 0
    for (const k of fpCache.keys()) {
      fpCache.delete(k)
      if (++i >= toDelete) break
    }
  }
  fpCache.set(key, value)
  return value
}

export function fingerprint(text: string): string {
  const cached = fpCache.get(text)
  if (cached !== undefined) return cached

  let s = text

  // 선두 타임스탬프는 완전히 제거 (패턴 비교에서 노이즈가 됨)
  s = s.replace(RE_ISO_LEADING, '')

  // 나머지 시간/ID/숫자 → 플레이스홀더
  s = s.replace(RE_UUID, '{u}')
  s = s.replace(RE_EMAIL, '{e}')
  s = s.replace(RE_IP, '{ip}')
  s = s.replace(RE_HHMMSS, '{t}')
  s = s.replace(RE_HEX, '{h}')
  s = s.replace(RE_QUOTED_DQ, '"_"')
  s = s.replace(RE_QUOTED_SQ, "'_'")
  s = s.replace(RE_PATH_NUM, (_, head) => `${head}/{n}`)
  s = s.replace(RE_NUMBER, '#')
  s = s.replace(RE_WS, ' ').trim()

  // 너무 긴 꼬리는 자름 — 메모리/키 폭발 방지
  if (s.length > 240) s = s.slice(0, 240)

  return cacheSet(text, s)
}

export function previewFingerprint(fp: string, max = 80): string {
  if (fp.length <= max) return fp
  return fp.slice(0, max - 1) + '…'
}
