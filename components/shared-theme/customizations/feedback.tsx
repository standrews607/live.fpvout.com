import { Theme, alpha, Components } from '@mui/material/styles';

/* eslint-disable import/prefer-default-export */
export const feedbackCustomizations: Components<Theme> = {
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        backgroundColor: (theme.vars || theme).palette.warning[100],
        color: (theme.vars || theme).palette.text.primary,
        border: `1px solid ${(theme.vars || theme).palette.warning[300]}`,
        '& .MuiAlert-icon': {
          color: (theme.vars || theme).palette.warning[500],
        },
        ...theme.applyStyles('dark', {
          backgroundColor: (theme.vars || theme).palette.warning[900],
          border: `1px solid ${(theme.vars || theme).palette.warning[800]}`,
        }),
      }),
    },
  },
  MuiDialog: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiDialog-paper': {
          borderRadius: '10px',
          border: '1px solid',
          borderColor: (theme.vars || theme).palette.divider,
        },
      }),
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: 8,
        borderRadius: 8,
        backgroundColor: (theme.vars || theme).palette.grey[200],
        ...theme.applyStyles('dark', {
          backgroundColor: (theme.vars || theme).palette.grey[800],
        }),
      }),
    },
  },
};
