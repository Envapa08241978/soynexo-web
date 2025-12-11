/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Esta línea es CRÍTICA: le dice dónde buscar tu código
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0A2540',
          orange: '#FF6B00',
          gray: '#1E3A5F',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace'], // Fuente estilo código para la terminal
        sans: ['Inter', 'system-ui', 'sans-serif'], // Fuente limpia para títulos
      }
    },
  },
  plugins: [],
}