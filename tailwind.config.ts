import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef3ff',
          100: '#d6e4ff',
          400: '#6b92d4',
          500: '#4070bc',
          600: '#1F4993',
          700: '#193a76',
          800: '#132d5e',
          900: '#0d2047',
        },
      },
    },
  },
  plugins: [],
}
export default config
