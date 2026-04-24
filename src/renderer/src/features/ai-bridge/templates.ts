export interface PromptTemplate {
  slash: string
  label: string
  prompt: string
}

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    slash: '/why',
    label: '원인 분석',
    prompt:
      '다음 로그의 근본 원인을 5줄 이내로 분석해줘. 가능성을 확률 순으로 정리하고, 확인할 수 있는 방법도 함께 알려줘:'
  },
  {
    slash: '/fix',
    label: '수정 제안',
    prompt:
      '다음 에러를 수정하기 위한 구체적인 코드 변경을 제안해줘. 언어는 로그에서 추론하고, diff 형태로 보여줘:'
  },
  {
    slash: '/summary',
    label: '요약',
    prompt:
      '다음 로그를 3~5줄로 요약해줘. 주요 이벤트 · 레벨별 개수 · 시간대 · 이상 징후를 포함:'
  },
  {
    slash: '/incident',
    label: '인시던트 리포트',
    prompt:
      '다음 로그로 인시던트 리포트를 작성해줘. 형식:\n- 발생 시각\n- 영향 범위\n- 추정 원인\n- 즉시 조치\n- 후속 확인 사항'
  },
  {
    slash: '/stack',
    label: '스택트레이스 추적',
    prompt:
      '스택트레이스가 있다면 발생 지점 파일·라인과 호출 경로를 정리하고, 가장 위쪽 프레임의 책임을 설명해줘:'
  },
  {
    slash: '/diff',
    label: '이상 패턴만',
    prompt:
      '다음 로그에서 평소와 다른 패턴, 새로 등장한 메시지, 급증한 에러만 추려서 보여줘. 정상 noise 는 제외:'
  },
  {
    slash: '/perf',
    label: '성능 이슈',
    prompt:
      '다음 로그에서 성능 병목(지연 · timeout · 대기)이 의심되는 부분을 찾아줘. 레이턴시 숫자가 있다면 비교해줘:'
  },
  {
    slash: '/secure',
    label: '보안 이슈',
    prompt:
      '다음 로그에서 인증 실패, 권한 위반, 의심스러운 접근 패턴을 확인해줘:'
  }
]

export function matchSlash(query: string): PromptTemplate[] {
  const q = query.toLowerCase()
  if (!q.startsWith('/')) return []
  const needle = q.slice(1)
  if (!needle) return BUILTIN_TEMPLATES
  return BUILTIN_TEMPLATES.filter(
    (t) =>
      t.slash.slice(1).toLowerCase().startsWith(needle) ||
      t.label.toLowerCase().includes(needle)
  )
}

export function findTemplate(slash: string): PromptTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.slash === slash)
}
