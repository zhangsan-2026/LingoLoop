/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        notion: {
          bg: '#FFFFFF',
          sidebar: '#F7F7F5',
          hover: '#EFEFEF',
          border: '#E1E1E0',
          text: '#37352F',
          gray: '#9B9A97',
          blue: '#2383E2',
        }
      },
      fontFamily: {
        sans: ['inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
