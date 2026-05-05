/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AppVelocity brand palette — orange-red (#f15b40)
        brand: {
          50:  '#fff4f1',
          100: '#ffe8e2',
          200: '#ffc6b8',
          300: '#ff9985',
          400: '#f97255',
          500: '#f15b40',  // primary
          600: '#d94a30',
          700: '#b53c25',
          800: '#8f2f1c',
          900: '#6b2215',
          950: '#3d1008',
        },
        // Navy palette
        navy: {
          DEFAULT: '#082340',
          md: '#0d3358',
          lt: '#0f3d6e',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
