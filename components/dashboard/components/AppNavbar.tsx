'use client';

import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SideMenuMobile from './SideMenuMobile';
import MenuButton from './MenuButton';
import ColorModeIconDropdown from '@/components/shared-theme/ColorModeIconDropdown';
import { StyledToolbar, CustomIconBox } from './styled';

export default function AppNavbar() {
  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        sx={{
          display: { xs: 'auto', md: 'none' },
          boxShadow: 0,
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
          top: 'var(--template-frame-height, 0px)',
        }}
      >
        <StyledToolbar variant="regular">
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              flexGrow: 1,
              width: '100%',
              gap: 1,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: 'center', mr: 'auto' }}
            >
              <CustomIcon />
              <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
                DigiView - Web
              </Typography>
            </Stack>
            <ColorModeIconDropdown />
            <MenuButton aria-label="menu" onClick={toggleDrawer(true)}>
              <MenuRoundedIcon />
            </MenuButton>
          </Stack>
        </StyledToolbar>
      </AppBar>

      {/* Mobile side menu drawer */}
      <SideMenuMobile open={open} toggleDrawer={toggleDrawer} />
    </>
  );
}

function CustomIcon() {
  return (
    <CustomIconBox>
      <DashboardRoundedIcon color="inherit" sx={{ fontSize: '1rem' }} />
    </CustomIconBox>
  );
}
