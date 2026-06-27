import type { Config } from 'tailwindcss';

/**
 * Tailwind maps to the CSS variables defined in globals.css so the whole app
 * draws from one token source. Palette is strictly black / white / gold.
 */
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--pos-bg)',
        'bg-2': 'var(--pos-bg-2)',
        text: 'var(--pos-text)',
        muted: 'var(--pos-muted)',
        faint: 'var(--pos-faint)',
        gold: {
          DEFAULT: 'var(--pos-gold)',
          soft: 'var(--pos-gold-soft)',
          deep: 'var(--pos-gold-deep)',
          on: 'var(--pos-on-gold)',
        },
        danger: {
          DEFAULT: 'var(--pos-danger)',
          on: 'var(--pos-on-danger)',
        },
        // surface/glass/border are composed via rgb(var() / alpha) in component classes
        surface: 'rgb(var(--pos-surface) / var(--pos-surface-a))',
        glass: 'rgb(var(--pos-glass) / var(--pos-glass-a))',
        line: 'rgb(var(--pos-border) / var(--pos-border-a))',
      },
      borderRadius: {
        card: 'var(--pos-r-card)',
        sheet: 'var(--pos-r-sheet)',
        pill: 'var(--pos-r-pill)',
      },
      boxShadow: {
        'pos-sm': 'var(--pos-shadow-sm)',
        'pos-md': 'var(--pos-shadow-md)',
        'pos-lg': 'var(--pos-shadow-lg)',
        'gold-glow': 'var(--pos-glow-gold)',
      },
      backdropBlur: {
        xs: '8px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Large, breathable display hierarchy
        display: ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        h1: ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['1.175rem', { lineHeight: '1.25', fontWeight: '600' }],
      },
      transitionTimingFunction: {
        pos: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        pos: '200ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
