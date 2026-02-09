'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8e54e9',
    },
    secondary: {
      main: '#4776e6',
    },
    background: {
      default: '#0b0f1a',
      paper: '#121826',
    },
  },
  typography: {
    fontFamily: 'var(--font-geist-sans)',
  },
  shape: {
    borderRadius: 12,
  },
});

export default theme;
