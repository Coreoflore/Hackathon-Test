/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1120',
        panel: '#111827',
        cyan: '#67e8f9'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(103,232,249,0.08), 0 24px 70px rgba(0,0,0,0.25)'
      }
    }
  },
  plugins: []
};
