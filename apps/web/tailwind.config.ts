import type { Config } from 'tailwindcss';
import { tokens } from '@execution-layer/ui';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: tokens.colors.gray,
        primary: tokens.colors.primary,
        success: tokens.colors.success,
        error: tokens.colors.error,
        warning: tokens.colors.warning,
        background: tokens.colors.background,
        foreground: tokens.colors.foreground,
        border: tokens.colors.border,
      },
      fontFamily: {
        sans: tokens.fonts.sans.split(', '),
        mono: tokens.fonts.mono.split(', '),
      },
      fontSize: tokens.fontSize,
      fontWeight: tokens.fontWeight,
      lineHeight: tokens.lineHeight,
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      boxShadow: tokens.shadows,
      transitionDuration: {
        fast: '150ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
