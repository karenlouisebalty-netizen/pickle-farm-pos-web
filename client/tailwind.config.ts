import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream:      { DEFAULT: '#F7F4EE', dark: '#1C1F1A' },
        olive:      { DEFAULT: '#6B7C3A', light: '#8A9E4A', dark: '#4A5728' },
        dg:         { DEFAULT: '#2C4A1E', light: '#3A6028', dark: '#1A2E12' },
        maroon:     { DEFAULT: '#7A2030', light: '#9B3040', dark: '#561525' },
        surface:    { DEFAULT: '#EEE9DE', dark: '#252820' },
        border:     { DEFAULT: '#D8D2C4', dark: '#333629' },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        sm:  '5px',
        DEFAULT: '8px',
        md:  '8px',
        lg:  '12px',
        xl:  '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
        modal:'0 8px 32px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08)',
      }
    }
  },
  plugins: []
}

export default config
