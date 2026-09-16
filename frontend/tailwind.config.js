/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#111827',
        'surface-elevated': '#1f293d',
        border: '#243049',
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#818cf8',
          subtle: 'rgba(99, 102, 241, 0.15)'
        },
        verdict: {
          accepted: '#10b981',
          'accepted-bg': 'rgba(16, 185, 129, 0.15)',
          wrong: '#f59e0b',
          'wrong-bg': 'rgba(245, 158, 11, 0.15)',
          compile: '#f43f5e',
          'compile-bg': 'rgba(244, 63, 94, 0.15)',
          runtime: '#ef4444',
          'runtime-bg': 'rgba(239, 68, 68, 0.15)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
