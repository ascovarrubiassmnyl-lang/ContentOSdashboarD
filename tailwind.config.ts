import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0A0A12',
        card: '#12121C',
        cardHover: '#161622',
        line: '#1E1E2E',
        primary: '#7C7CF5',
        pink: '#EC5B9A',
        orange: '#F59E4B',
        positive: '#3DDC97',
        negative: '#F0625D',
        muted: '#8B8B9E',
        soft: '#C7C7D6',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,124,245,0.25), 0 8px 32px rgba(124,124,245,0.12)',
        glowPink: '0 0 0 1px rgba(236,91,154,0.25), 0 8px 32px rgba(236,91,154,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
