/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0b0f17',
          card: '#121824',
          border: '#1f293d',
          accent: '#3b82f6',
          alert: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
          neon: '#06b6d4'
        }
      }
    },
  },
  plugins: [],
}

