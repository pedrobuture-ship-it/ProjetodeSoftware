import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        field: {
          50: '#eef7f1',
          100: '#d8eadf',
          600: '#2f6f4e',
          700: '#245b40',
          900: '#143324',
        },
        clay: {
          100: '#f3dfd5',
          500: '#b56b45',
          700: '#82472e',
        },
        skyfield: {
          100: '#d7eef4',
          600: '#227c9d',
          700: '#195f78',
        },
        harvest: {
          100: '#faecd2',
          500: '#d79b3d',
        },
      },
      boxShadow: {
        soft: '0 16px 40px -28px rgba(36, 49, 61, 0.45)',
      },
    },
  },
  plugins: [],
} satisfies Config;
