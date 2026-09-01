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
        wa: {
          dark: '#111b21',
          panel: '#202c33',
          panelHover: '#2a3942',
          header: '#202c33',
          border: '#222d34',
          subtext: '#8696a0',
          teal: '#00a884',
          tealDark: '#008069',
          greenLight: '#25d366',
          bubbleOut: '#005c4b',
          bubbleIn: '#202c33',
          chatBg: '#0b141a',
          badgeExpired: '#ef4444',
          badgeActive: '#10b981'
        }
      }
    },
  },
  plugins: [],
}
