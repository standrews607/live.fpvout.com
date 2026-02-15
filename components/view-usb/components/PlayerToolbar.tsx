'use client';

import { IconButton, Stack, Tooltip } from '@mui/material';
import { Close, Fullscreen, FullscreenExit } from '@mui/icons-material';

type PlayerToolbarProps = {
  onDisconnect: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  isFullscreenSupported?: boolean;
};

export default function PlayerToolbar({
  onDisconnect,
  onToggleFullscreen,
  isFullscreen,
  isFullscreenSupported = true,
}: PlayerToolbarProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        justifyContent: 'flex-end',
        p: 1,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
        <span>
          <IconButton
            size="small"
            onClick={onToggleFullscreen}
            disabled={!isFullscreenSupported}
            sx={{
              color: 'common.white',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Disconnect">
        <IconButton
          size="small"
          onClick={onDisconnect}
          sx={{
            color: 'common.white',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
