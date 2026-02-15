import { createTheme, alpha, PaletteMode, Shadows } from '@mui/material/styles';

declare module '@mui/material/Paper' {
  interface PaperPropsVariantOverrides {
    highlighted: true;
    chartContainer: true;
  }
}

declare module '@mui/material/styles' {
  interface ColorRange {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  }

  interface PaletteColor extends ColorRange {}

  interface Palette {
    baseShadow: string;
  }
}

const defaultTheme = createTheme();
const customShadows: Shadows = [...defaultTheme.shadows];

export const getDesignTokens = (mode: PaletteMode) => {
  customShadows[1] =
    mode === 'dark'
      ? 'hsla(220, 30%, 5%, 0.7) 0px 4px 16px 0px, hsla(220, 25%, 10%, 0.8) 0px 8px 16px -5px'
      : 'hsla(220, 30%, 5%, 0.07) 0px 4px 16px 0px, hsla(220, 25%, 10%, 0.07) 0px 8px 16px -5px';

  return {
    typography,
    shape,
    shadows: customShadows,
  };
};

export const colorSchemes = {
  light: {
    palette: {
      primary: {
        main: '#7c3aed', // Slightly adjusted purple for light mode
        light: '#a78bfa',
        dark: '#6d28d9',
      },
      secondary: {
        main: '#3b82f6', // Slightly adjusted blue for light mode
        light: '#60a5fa',
        dark: '#1e40af',
      },
      background: {
        default: '#f8fafc',
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#475569',
      },
      divider: '#e2e8f0',
    },
  },
  dark: {
    palette: {
      primary: {
        main: '#8e54e9',
        light: '#a78bfa',
        dark: '#7c3aed',
      },
      secondary: {
        main: '#4776e6',
        light: '#60a5fa',
        dark: '#3b82f6',
      },
      background: {
        default: '#0b0f1a',
        paper: '#121826',
      },
      text: {
        primary: '#f1f5f9',
        secondary: '#cbd5e1',
      },
      divider: '#334155',
    },
  },
};

export const typography = {
  fontFamily: 'var(--font-geist-sans)',
  h1: {
    fontSize: defaultTheme.typography.pxToRem(48),
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: defaultTheme.typography.pxToRem(36),
    fontWeight: 600,
    lineHeight: 1.2,
  },
  h3: {
    fontSize: defaultTheme.typography.pxToRem(30),
    lineHeight: 1.2,
  },
  h4: {
    fontSize: defaultTheme.typography.pxToRem(24),
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h5: {
    fontSize: defaultTheme.typography.pxToRem(20),
    fontWeight: 600,
  },
  h6: {
    fontSize: defaultTheme.typography.pxToRem(18),
    fontWeight: 600,
  },
  subtitle1: {
    fontSize: defaultTheme.typography.pxToRem(18),
  },
  subtitle2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 500,
  },
  body1: {
    fontSize: defaultTheme.typography.pxToRem(14),
  },
  body2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 400,
  },
  caption: {
    fontSize: defaultTheme.typography.pxToRem(12),
    fontWeight: 400,
  },
};

export const shape = {
  borderRadius: 8,
};

export const zIndex = {
  appBar: 1200,
  drawer: 1100,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
};

// @ts-ignore
const defaultShadows: Shadows = [
  'none',
  'var(--template-palette-baseShadow)',
  ...defaultTheme.shadows.slice(2),
];
export const shadows = defaultShadows;
