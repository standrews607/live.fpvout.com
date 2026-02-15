'use client';

import { styled } from '@mui/material/styles';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import MenuContent from './MenuContent';
import type { NavItem } from '../DashboardProvider';
import { Typography } from '@mui/material';

const drawerWidth = 300;

const Drawer = styled(MuiDrawer)({
  width: drawerWidth,
  flexShrink: 0,
  boxSizing: 'border-box',
  mt: 10,
  [`& .${drawerClasses.paper}`]: {
    width: drawerWidth,
    boxSizing: 'border-box',
  },
});

interface SideMenuProps {
  navigation: NavItem[];
}

export default function SideMenu({ navigation }: SideMenuProps) {
  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          mt: 'calc(var(--template-frame-height, 0px) + 4px)',
          justifyContent: 'center',
          p: 1.75,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          DigiView Web
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'divider', opacity: 0.8 }} />
      <Box
        sx={{
          overflow: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MenuContent navigation={navigation} />
      </Box>
    </Drawer>
  );
}
