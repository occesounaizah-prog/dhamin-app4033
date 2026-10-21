/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        surface: '#f1f5f9',
        border: '#e2e8f0',
        'muted-foreground': '#64748b',
        navy: {
          DEFAULT: '#0b1f3a',
          deep: '#061427',
          foreground: '#f8fafc',
        },
        gold: {
          DEFAULT: '#c9a227',
          soft: '#fbf6e3',
        },
        money: {
          DEFAULT: '#0f9d76',
          soft: '#e6f7f1',
          foreground: '#ffffff',
        },
        destructive: '#dc2626',
      },
      boxShadow: {
        card: '0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 3px -1px rgba(15, 23, 42, 0.06)',
        elevated: '0 20px 50px -12px rgba(15, 23, 42, 0.25), 0 8px 16px -8px rgba(15, 23, 42, 0.15)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.85)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'in': 'fade-in 0.3s ease-out',
        'zoom-in': 'zoom-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
