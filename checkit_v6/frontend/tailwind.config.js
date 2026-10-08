/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta v6 basada en el verde de marca #158740 (tono elegido para
        // el sidebar). Se usa en botones, insignias, enlaces y estados,
        // tanto en modo claro como oscuro.
        brand: {
          50: '#effaf3',
          100: '#dbf5e5',
          200: '#b9e9cc',
          300: '#81daa4',
          400: '#30cf70',
          500: '#21ab58',
          600: '#158942',
          700: '#0d6d32',
          800: '#095325',
          900: '#083a1b',
          950: '#051e0f',
        },
        // Blanco "suavizado" para tarjetas y paneles en modo claro: evita el
        // blanco puro (#ffffff) para reducir el brillo/deslumbre y separar
        // visualmente la tarjeta del fondo de la página (bg-slate-50).
        surface: '#f7f9f8',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
