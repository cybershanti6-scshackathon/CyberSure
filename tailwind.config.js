/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral surface ramp (dark-first, tuned for a security console)
        ink: {
          950: '#070b14',
          900: '#0b1220',
          850: '#0f1728',
          800: '#141d31',
          750: '#1a2439',
          700: '#212d45',
          600: '#2c3a54',
          500: '#3d4c68',
          400: '#5a6b8a',
          300: '#8494b0',
          200: '#aab6cb',
          100: '#d3dbe8',
          50: '#eef2f8',
        },
        accent: {
          50: '#eef7ff',
          100: '#d8ecff',
          200: '#b4dbff',
          300: '#7fc3ff',
          400: '#45a3ff',
          500: '#1b83f8',
          600: '#0a63e6',
          700: '#0a4dbb',
          800: '#0e4296',
          900: '#113a76',
        },
        sev: {
          critical: { soft: '#fdecec', line: '#f6bcbc', fg: '#b42318', dot: '#e5484d' },
          high: { soft: '#fff1e6', line: '#fbd0a8', fg: '#b54708', dot: '#f2760c' },
          medium: { soft: '#fff8e1', line: '#f6e0a0', fg: '#a15c07', dot: '#e3a008' },
          low: { soft: '#eef4ff', line: '#c3d8f7', fg: '#175cd3', dot: '#3b82f6' },
          ok: { soft: '#e8f8f0', line: '#b3e6cd', fg: '#067647', dot: '#17a76a' },
        },
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(8, 15, 30, 0.06), 0 8px 24px -12px rgba(8, 15, 30, 0.18)',
        pop: '0 24px 60px -18px rgba(8, 15, 30, 0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        sweep: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(400%)' } },
        'pulse-ring': { '0%': { opacity: '0.6', transform: 'scale(0.9)' }, '100%': { opacity: '0', transform: 'scale(1.6)' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        /* --- Landing hero network animation --- */
        // A packet dot travelling down a topology link (top -> bottom).
        'cybersure-packet': {
          '0%': { top: '0%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { top: '92%', opacity: '0' },
        },
        // Slow horizontal scan sweep across the hero graph.
        'cybersure-sweep-x': {
          '0%': { transform: 'translateX(-30%)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateX(420%)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out both',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.22,1,0.36,1) both',
        'slide-up': 'slide-up 180ms ease-out both',
        'scale-in': 'scale-in 160ms ease-out both',
        sweep: 'sweep 1.4s linear infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'rise-in': 'rise-in 420ms cubic-bezier(0.22,1,0.36,1) both',
        'cybersure-sweep-x': 'cybersure-sweep-x 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
