/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'monospace']
      },
      colors: {
        log: {
          info: '#60a5fa',
          warn: '#fbbf24',
          error: '#f87171',
          debug: '#94a3b8',
          trace: '#64748b'
        },
        surface: {
          terminal: '#000000',
          deep: '#0a0a0a',
          panel: '#171717',
          elevated: '#262626'
        }
      }
    }
  },
  plugins: []
}
