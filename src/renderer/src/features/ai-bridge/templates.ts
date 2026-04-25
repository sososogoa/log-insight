export interface PromptTemplate {
  slash: string
  label: string
  prompt: string
}

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    slash: '/why',
    label: 'Root Cause',
    prompt:
      'Analyze the root cause of the following logs in 5 lines or fewer. List possibilities in order of likelihood and suggest how to verify each:'
  },
  {
    slash: '/fix',
    label: 'Fix Suggestion',
    prompt:
      'Suggest specific code changes to fix the following error. Infer the language from the logs and show the diff:'
  },
  {
    slash: '/summary',
    label: 'Summary',
    prompt:
      'Summarize the following logs in 3–5 lines. Include key events, counts by level, time range, and any anomalies:'
  },
  {
    slash: '/incident',
    label: 'Incident Report',
    prompt:
      'Write an incident report from the following logs. Format:\n- Time of occurrence\n- Blast radius\n- Estimated cause\n- Immediate action\n- Follow-up items'
  },
  {
    slash: '/stack',
    label: 'Stack Trace',
    prompt:
      'If a stack trace is present, identify the file and line of origin, summarize the call path, and explain the responsibility of the top frame:'
  },
  {
    slash: '/diff',
    label: 'Anomalies Only',
    prompt:
      'Show only unusual patterns, newly appearing messages, and spiking errors from the following logs. Exclude normal noise:'
  },
  {
    slash: '/perf',
    label: 'Performance',
    prompt:
      'Identify suspected performance bottlenecks (latency · timeout · blocking) in the following logs. Compare latency numbers if present:'
  },
  {
    slash: '/secure',
    label: 'Security',
    prompt:
      'Check the following logs for authentication failures, authorization violations, and suspicious access patterns:'
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
