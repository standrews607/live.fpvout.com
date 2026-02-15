'use client';

import { createContext } from 'react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AppNavbar from './components/AppNavbar';
import SideMenu from './components/SideMenu';
import Copyright from './internals/components/Copyright';
import Header from './components/Header';

export type NavItem = { text: string; icon: React.ReactNode; href: string };

interface DashboardContextType {
  navigation: NavItem[];
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

interface DashboardProviderProps {
  children: React.ReactNode;
  navigation: NavItem[];
}

export default function DashboardProvider({
  children,
  navigation,
}: DashboardProviderProps) {
  return (
    <DashboardContext.Provider value={{ navigation }}>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header Bar with branding and navigation */}
        <AppNavbar />

        <Box sx={{ display: 'flex', flexGrow: 1 }}>
          {/* Left permanent drawer (desktop) */}
          <SideMenu navigation={navigation} />

          {/* Main content */}
          <Box
            component="main"
            sx={(theme) => ({
              flexGrow: 1,
              backgroundColor: theme.vars
                ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                : alpha(theme.palette.background.default, 1),
              overflow: 'auto',
            })}
          >
            <Stack
              spacing={2}
              sx={{
                alignItems: 'stretch',
                mx: 3,
                pb: 5,
                mt: 3,
                width: 'calc(100% - 48px)',
              }}
            >
              <Header />
              {children}
              <Copyright sx={{ my: 4 }} />
            </Stack>
          </Box>
        </Box>
      </Box>
    </DashboardContext.Provider>
  );
}
