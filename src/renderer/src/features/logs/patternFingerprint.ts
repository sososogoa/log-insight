/**
 * Builds a structural fingerprint of log text.
 * Replaces variable tokens (timestamps, UUIDs, numbers, etc.) with placeholders
 * so logs with the same pattern map to the same string.
 *
 * Purpose: repeated-log grouping & Focus mode "show only same-shaped lines".
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
 * Caching — fingerprint depends only on text, so identical text avoids recomputation.
 * Uses a Map; when MAX_ENTRIES is exceeded, oldest entries are evicted (simple LRU).
 * As the FIFO log buffer cycles, old lines drop out of references and the cache self-clears over time.
 */
const FP_CACHE_MAX = 20_000
const fpCache = new Map<string, string>()

function cacheSet(key: string, value: string): string {
  if (fpCache.size >= FP_CACHE_MAX) {
    // evict the oldest 1/8 of entries
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

  // strip leading timestamp entirely (it's noise for pattern comparison)
  s = s.replace(RE_ISO_LEADING, '')

  // replace remaining time/ID/number tokens with placeholders
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

  // truncate overly long tails — prevents memory/key explosion
  if (s.length > 240) s = s.slice(0, 240)

  return cacheSet(text, s)
}

export function previewFingerprint(fp: string, max = 80): string {
  if (fp.length <= max) return fp
  return fp.slice(0, max - 1) + '…'
}
