'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { NotificationProvider } from '@/lib/NotificationProvider';

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotificationProvider>
          <ServiceWorkerRegister />
          {children}
        </NotificationProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
