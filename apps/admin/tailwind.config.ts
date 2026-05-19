import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF1E8',
          100: '#FFE0CC',
          500: '#F1641E',
          600: '#F1641E',
          700: '#D5530F',
          800: '#A33F08',
        },
        ink: {
          900: '#222222',
          700: '#595959',
          500: '#8F8F8F',
          300: '#BFBFBF',
        },
        line: '#E1E3DF',
        canvas: '#FAF9F5',
        surface: '#FFFFFF',
        success: '#2E7D32',
        warn: '#B26A00',
        danger: '#C5221F',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      borderRadius: { pill: '999px' },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04)',
        pop: '0 8px 24px rgba(0,0,0,.10)',
      },
      maxWidth: { container: '1440px' },
    },
  },
  plugins: [],
};

export default config;
