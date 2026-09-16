/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          base: '#121212',
          surface: '#181818',
          card: '#242424',
          'card-hover': '#2a2a2a',
          'card-active': '#383838',
          subdued: '#b3b3b3',
          green: '#1DB954',
          'green-hover': '#1ed760',
          red: '#e91429',
          yellow: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Circular Std', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(29, 185, 84, 0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(29, 185, 84, 0.8)' },
        }
      },
      animation: {
        wiggle: 'wiggle 0.4s ease-in-out',
        pulseGlow: 'pulseGlow 2s infinite',
      }
    },
  },
  plugins: [],
}
