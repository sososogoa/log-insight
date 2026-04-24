// Subsequence fuzzy matcher. Returns a score; null when query chars don't all
// appear in order within target. Bonuses: consecutive match (+4), word boundary
// (+6), camelCase boundary (+3), case match (+1), position 0 (+2). Minor length
// penalty (−1 per 20 chars) so shorter targets win ties.

const WORD_BOUNDARY = /[\s/\\\-_.]/

function isWordBoundary(ch: string): boolean {
  return WORD_BOUNDARY.test(ch)
}

export function fuzzyMatch(query: string, target: string): { score: number } | null {
  if (!query) return { score: 0 }
  if (query.length > target.length) return null

  const q = query.toLowerCase()
  const t = target.toLowerCase()

  let score = 0
  let qi = 0
  let prevMatched = false
  let prevIdx = -1

  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      let bonus = 1
      if (prevMatched && prevIdx === i - 1) bonus += 4
      const prevChar = i > 0 ? target[i - 1] : ' '
      if (isWordBoundary(prevChar)) {
        bonus += 6
      } else if (
        i > 0 &&
        target[i - 1] === target[i - 1].toLowerCase() &&
        target[i] !== target[i].toLowerCase()
      ) {
        bonus += 3
      }
      if (target[i] === query[qi]) bonus += 1
      if (i === 0) bonus += 2

      score += bonus
      qi++
      prevMatched = true
      prevIdx = i
    } else {
      prevMatched = false
    }
  }

  if (qi < q.length) return null
  score -= Math.floor(target.length / 20)
  return { score }
}
