'use client';

import { IconButton, Stack, Tooltip } from '@mui/material';
import { Close } from '@mui/icons-material';

type PlayerToolbarProps = {
  onDisconnect: () => void;
};

export default function PlayerToolbar({ onDisconnect }: PlayerToolbarProps) {
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
