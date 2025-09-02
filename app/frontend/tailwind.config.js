/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        candy: {
          red: '#FF6B6B',
          yellow: '#FFD93D',
          green: '#6BCF7F',
          blue: '#4ECDC4',
          purple: '#A8E6CF',
          orange: '#FFB347',
          pink: '#FFB6C1',
        },
        gold: {
          DEFAULT: '#FFD700',
          dark: '#FFA500',
          light: '#FFF8DC',
        }
      },
      fontFamily: {
        'candy': ['Bubblegum Sans', 'cursive'],
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      }
    },
  },
  plugins: [],
}