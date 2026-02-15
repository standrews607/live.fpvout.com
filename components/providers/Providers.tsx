'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { NotificationProvider } from '@/lib/NotificationProvider';
import AppTheme from '../shared-theme/AppTheme';

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <AppRouterCacheProvider>
      <AppTheme>
        <CssBaseline enableColorScheme />
          <NotificationProvider>
            <ServiceWorkerRegister />
            {children}
          </NotificationProvider>
      </AppTheme>
    </AppRouterCacheProvider>
  );
}
