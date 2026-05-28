/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#04060d',
        panel: '#080d1a',
        surface: '#0b1220',
        elevated: '#0f1729',
        edge: '#1b2540',
        brand: {
          DEFAULT: '#3b82f6',
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd6ff',
          300: '#8ebcff',
          400: '#5b97fb',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,130,246,0.18), 0 8px 40px -12px rgba(59,130,246,0.45)',
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.18), 0 8px 40px -12px rgba(34,211,238,0.4)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,0.18), 0 8px 40px -12px rgba(139,92,246,0.4)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -20px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)',
        'radial-brand':
          'radial-gradient(60% 60% at 50% 0%, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 70%)',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
      keyframes: {
        fadeup: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        dash: {
          to: { strokeDashoffset: '0' },
        },
        gridmove: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '44px 44px' },
        },
      },
      animation: {
        fadeup: 'fadeup 0.6s cubic-bezier(0.16,1,0.3,1) both',
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        pulsering: 'pulseRing 2.6s ease-out infinite',
        gridmove: 'gridmove 18s linear infinite',
      },
    },
  },
  plugins: [],
}
