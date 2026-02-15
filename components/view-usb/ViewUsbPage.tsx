'use client';

import { useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import HelpDialog from './components/HelpDialog';
import GogglePlayer from './components/GogglePlayer';
import useGoggles from './hooks/useGoggles';
import { NoSsr } from '@mui/material';

export default function ViewUsbPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const { devices, connect, disconnect, disconnectAll, isConnecting, compatibleBrowser, supported } =
    useGoggles();

  const connectDisabled = useMemo(
    () => !supported || !compatibleBrowser || isConnecting,
    [compatibleBrowser, isConnecting, supported],
  );

  return (
    <NoSsr>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 2, md: 0 }}
              sx={{ 
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                width: '100%'
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {devices.length} goggles connected
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={connect}
                  disabled={connectDisabled}
                >
                  {isConnecting ? 'Connecting…' : 'Connect to goggles'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={disconnectAll}
                  disabled={devices.length === 0}
                >
                  Disconnect All
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HelpOutline />}
                  onClick={() => setHelpOpen(true)}
                >
                  Help
                </Button>
              </Stack>
            </Stack>

          {supported && !compatibleBrowser && (
            <Alert severity="warning">
              Your browser is not compatible, please use Google Chrome.
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
            }}
          >
            {devices.map((entry) => (
              <GogglePlayer
                key={entry.id}
                device={entry.device}
                onDisconnect={() => disconnect(entry.id)}
              />
            ))}
          </Box>
        </Stack>
      </Container>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
    </NoSsr>
  );
}
