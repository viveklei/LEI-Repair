/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#f8fafc',
          dark: '#0f172a',    // Dark Blue
          gray: '#64748b',    // Grey
          blue: '#1e3a8a',    // Corporate Engineering Blue
          accent: '#06b6d4',  // Cyan details
        }
      }
    },
  },
  plugins: [],
}
