/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kindle: {
          bg: '#121212',
          surface: '#1e1e1e',
          card: '#252525',
          border: '#333333',
          sepiaBg: '#f7efe2',
          sepiaSurface: '#eedec8',
          sepiaText: '#3a2e2b',
          paperBg: '#f4f4f0',
          paperText: '#181818',
          accent: '#d97706',
          dc: '#0078f0',
          marvel: '#e23636',
        }
      },
      fontFamily: {
        serif: ['Merriweather', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
