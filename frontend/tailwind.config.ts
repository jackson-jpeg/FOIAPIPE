import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#faf8f6',       // Warm cream background (Claude-style)
          primary: '#faf8f6',
          secondary: '#ffffff',     // Pure white for cards
          tertiary: '#f5f3f1',      // Subtle elevated surfaces
          hover: '#f0eeec',         // Hover state
          border: '#e6e4e2',        // Subtle borders (rarely used)
          'border-light': '#efefed',
        },
        text: {
          primary: '#1a1816',       // Near-black for primary text
          secondary: '#666461',     // Gray for secondary text
          tertiary: '#9a9894',      // Lighter gray for metadata
          quaternary: '#c4c2bf',    // Placeholder text
        },
        accent: {
          primary: '#d97706',       // Warm amber (journalism/alert)
          'primary-hover': '#b45309',
          'primary-subtle': 'rgba(217, 119, 6, 0.08)',
          'primary-muted': 'rgba(217, 119, 6, 0.15)',
          green: '#059669',         // Emerald for success
          'green-subtle': 'rgba(5, 150, 105, 0.08)',
          'green-muted': 'rgba(5, 150, 105, 0.15)',
          amber: '#d97706',
          'amber-subtle': 'rgba(217, 119, 6, 0.08)',
          'amber-muted': 'rgba(217, 119, 6, 0.15)',
          red: '#dc2626',           // Red for danger
          'red-subtle': 'rgba(220, 38, 38, 0.08)',
          'red-muted': 'rgba(220, 38, 38, 0.15)',
          blue: '#2563eb',          // Blue for info
          'blue-subtle': 'rgba(37, 99, 235, 0.08)',
          'blue-muted': 'rgba(37, 99, 235, 0.15)',
          purple: '#7c3aed',        // Purple for special
          'purple-subtle': 'rgba(124, 58, 237, 0.08)',
          'purple-muted': 'rgba(124, 58, 237, 0.15)',
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
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'overlay': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
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
