import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0f1a',          // Deep navy — primary background
          primary: '#0a0f1a',
          secondary: '#0f1724',        // Slightly lighter — cards, panels
          tertiary: '#151d2e',         // Elevated surfaces, table headers
          hover: '#1a2332',            // Hover state
          border: '#1e293b',           // Primary borders (slate-800)
          'border-light': '#334155',   // Lighter borders (slate-700)
        },
        text: {
          primary: '#f1f5f9',          // Slate-100 — high contrast text
          secondary: '#94a3b8',        // Slate-400 — secondary text
          tertiary: '#64748b',         // Slate-500 — metadata
          quaternary: '#475569',       // Slate-600 — placeholders, disabled
        },
        accent: {
          primary: '#06b6d4',          // Cyan-500 — main accent
          'primary-hover': '#0891b2',  // Cyan-600
          'primary-subtle': 'rgba(6, 182, 212, 0.10)',
          'primary-muted': 'rgba(6, 182, 212, 0.20)',
          green: '#22c55e',            // Green-500 — success, money
          'green-subtle': 'rgba(34, 197, 94, 0.10)',
          'green-muted': 'rgba(34, 197, 94, 0.20)',
          amber: '#f59e0b',           // Amber-500 — warnings
          'amber-subtle': 'rgba(245, 158, 11, 0.10)',
          'amber-muted': 'rgba(245, 158, 11, 0.20)',
          red: '#ef4444',             // Red-500 — danger, critical
          'red-subtle': 'rgba(239, 68, 68, 0.10)',
          'red-muted': 'rgba(239, 68, 68, 0.20)',
          blue: '#3b82f6',            // Blue-500 — info
          'blue-subtle': 'rgba(59, 130, 246, 0.10)',
          'blue-muted': 'rgba(59, 130, 246, 0.20)',
          purple: '#a855f7',          // Purple-500 — AI operations
          'purple-subtle': 'rgba(168, 85, 247, 0.10)',
          'purple-muted': 'rgba(168, 85, 247, 0.20)',
        },
        chart: {
          revenue: '#22c55e',
          views: '#3b82f6',
          grid: '#1e293b',
          axis: '#64748b',
          tooltip: {
            bg: '#0f1724',
            border: '#1e293b',
            text: '#f1f5f9',
            label: '#64748b',
          }
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.2rem' }],
        sm: ['0.8125rem', { lineHeight: '1.3rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.6875rem' }],
        xl: ['1.25rem', { lineHeight: '2rem' }],
        '2xl': ['1.5rem', { lineHeight: '2.25rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.625rem' }],
        'display-xs': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'display-sm': ['1.5rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }],
        'display-md': ['1.875rem', { lineHeight: '2.625rem', letterSpacing: '-0.02em' }],
        'display-lg': ['2.25rem', { lineHeight: '3rem', letterSpacing: '-0.025em' }],
        'display-xl': ['3rem', { lineHeight: '4rem', letterSpacing: '-0.03em' }],
        'display-2xl': ['3.75rem', { lineHeight: '4.75rem', letterSpacing: '-0.035em' }],
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
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
        'overlay': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.15)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.15)',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-in-fast': 'fadeIn 100ms ease-out',
        'slide-up': 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'shimmer-flow': 'shimmerFlow 2.5s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-pulse': 'orbPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spring': 'spring 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'scan-line': 'scanLine 3s linear infinite',
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
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
