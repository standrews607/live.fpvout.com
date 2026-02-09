'use client';

import { AppBar, Box, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import { Forum, GitHub } from '@mui/icons-material';
import ShopIcon from '@mui/icons-material/Shop';

export default function HeaderBar() {
  return (
    <AppBar
      position="sticky"
      sx={{
        background:
          'linear-gradient(45deg, rgba(71,118,230,1) 0%, rgba(142,84,233,1) 100%)',
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          DigiView - Web
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View the code on GitHub">
            <IconButton
              color="inherit"
              component="a"
              href="https://github.com/fpvout/fpv-browser"
              target="_blank"
              rel="noreferrer"
            >
              <GitHub />
            </IconButton>
          </Tooltip>
          <Tooltip title="Join our Discord">
            <IconButton
              color="inherit"
              component="a"
              href="https://discord.gg/69wm92Wr"
              target="_blank"
              rel="noreferrer"
            >
              <Forum />
            </IconButton>
          </Tooltip>
          <Tooltip title="Android app coming soon">
            <span>
              <IconButton color="inherit" disabled>
                <ShopIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
