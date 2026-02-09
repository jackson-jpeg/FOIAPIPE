import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0a0b',
          primary: '#0a0a0b',
          secondary: '#111113',
          tertiary: '#1a1a1e',
          'tertiary-glass': 'rgba(26, 26, 30, 0.7)', // Glass variant with 70% opacity
          border: '#232328',
          'border-light': '#2e2e35',
          hover: '#1e1e23',
        },
        accent: {
          primary: '#e8614d',
          'primary-hover': '#d4553f',
          'primary-subtle': 'rgba(232, 97, 77, 0.06)',
          'primary-muted': 'rgba(232, 97, 77, 0.14)',
          green: '#34d399',
          'green-subtle': 'rgba(52, 211, 153, 0.06)',
          'green-muted': 'rgba(52, 211, 153, 0.12)',
          amber: '#fbbf24',
          'amber-subtle': 'rgba(251, 191, 36, 0.06)',
          'amber-muted': 'rgba(251, 191, 36, 0.12)',
          red: '#f87171',
          'red-subtle': 'rgba(248, 113, 113, 0.06)',
          'red-muted': 'rgba(248, 113, 113, 0.12)',
          purple: '#a78bfa',
          'purple-subtle': 'rgba(167, 139, 250, 0.06)',
          'purple-muted': 'rgba(167, 139, 250, 0.12)',
          blue: '#60a5fa',
          'blue-subtle': 'rgba(96, 165, 250, 0.06)',
          'blue-muted': 'rgba(96, 165, 250, 0.12)',
        },
        text: {
          primary: '#ededef',
          secondary: '#a1a1a9', // Improved from #8f8f97 for 7:1 contrast
          tertiary: '#56565e',
          quaternary: '#52525a', // Fixed WCAG AA failure from #3d3d44 (2.8:1 → 4.5:1)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11px - metadata only
        xs: ['0.75rem', { lineHeight: '1.2rem' }], // 12px - labels, captions
        sm: ['0.8125rem', { lineHeight: '1.3rem' }], // 13px - secondary text
        base: ['0.9375rem', { lineHeight: '1.5rem' }], // 15px - body text (increased from 14px)
        lg: ['1.0625rem', { lineHeight: '1.6875rem' }], // 17px
        xl: ['1.25rem', { lineHeight: '2rem' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '2.25rem' }], // 24px
        '3xl': ['1.875rem', { lineHeight: '2.625rem' }], // 30px
        // Display scale for H6-H1 with negative letter-spacing
        'display-xs': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }], // 18px - H6
        'display-sm': ['1.5rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }], // 24px - H5
        'display-md': ['1.875rem', { lineHeight: '2.625rem', letterSpacing: '-0.02em' }], // 30px - H4
        'display-lg': ['2.25rem', { lineHeight: '3rem', letterSpacing: '-0.025em' }], // 36px - H3
        'display-xl': ['3rem', { lineHeight: '4rem', letterSpacing: '-0.03em' }], // 48px - H2
        'display-2xl': ['3.75rem', { lineHeight: '4.75rem', letterSpacing: '-0.035em' }], // 60px - H1
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.015em',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'card': '0 0 0 1px rgba(255,255,255,0.02), 0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        'card-hover': '0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px 0 rgba(0, 0, 0, 0.35)',
        'elevated': '0 0 0 1px rgba(255,255,255,0.03), 0 8px 24px -4px rgba(0, 0, 0, 0.5)',
        'overlay': '0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px -8px rgba(0, 0, 0, 0.6)',
        'glow-sm': '0 0 12px -2px rgba(232, 97, 77, 0.15)',
        'glow': '0 0 20px -4px rgba(232, 97, 77, 0.2)',
        'inner-ring': 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-in-fast': 'fadeIn 100ms ease-out',
        'slide-up': 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'shimmer-flow': 'shimmerFlow 2.5s ease-in-out infinite', // Dual-layer gradient animation
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-pulse': 'orbPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite', // Status orb animation
        'spring': 'spring 300ms cubic-bezier(0.34, 1.56, 0.64, 1)', // Tactile spring easing
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        shimmerFlow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        orbPulse: {
          '0%, 100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 currentColor',
          },
          '50%': {
            transform: 'scale(1.1)',
            boxShadow: '0 0 8px 2px currentColor',
          },
        },
        spring: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.98)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Tactile spring for buttons
      },
    },
  },
  plugins: [],
};

export default config;
