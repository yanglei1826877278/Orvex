/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ember: '#d36c44',
        teal: '#499287',
        coal: '#161410',
        paper: '#f7efe6',
      },
      boxShadow: {
        panel: '0 28px 90px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
}
