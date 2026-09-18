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
        },
        /* ── Home / Landing Page Light Theme ── */
        home: {
          bg: '#FFFBF7',
          'bg-alt': '#FFF5ED',
          surface: '#FFFFFF',
          text: '#1A1A2E',
          'text-secondary': '#6B7280',
          'text-muted': '#9CA3AF',
          accent: '#F26522',
          'accent-hover': '#E05A1B',
          'accent-light': '#FFF0E6',
          'accent-soft': '#FDDCBF',
          border: '#F0E6DC',
          'border-strong': '#E5D5C5',
          'stat-bg': '#FFFDF9',
          'cta-gradient-from': '#FFF0E6',
          'cta-gradient-to': '#FFE4D4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(3deg)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translateY(-8px)' },
          '50%': { transform: 'translateY(4px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'typing': {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.7s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'float-reverse': 'float-reverse 7s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'typing': 'typing 2s steps(30) forwards',
      },
    },
  },
  plugins: [],
}
