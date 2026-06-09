/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0B0B0B',   // page background
        panel: '#161616',   // cards
        panel2: '#1F1F1F',  // raised / selected
        line: '#2A2A2A',    // hairline borders
        cream: '#F4F2EC',   // text / foreground
        lime: '#8ACE00',
        limeDark: '#6BA300',
        pink: '#FF3E9A',
        blue: '#2A5BFF',
        purple: '#7B3FF2',
        flame: '#FF5A1F',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'Archivo', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
