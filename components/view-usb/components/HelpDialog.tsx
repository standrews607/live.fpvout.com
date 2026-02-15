'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  List,
  ListItem,
} from '@mui/material';

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Help</DialogTitle>
      <DialogContent>
        <List sx={{ listStyleType: 'decimal', pl: 4 }}>
          <ListItem sx={{ display: 'list-item' }}>
            If you&apos;re using Windows, make sure you have the{' '}
            <Link
              href="https://zadig.akeo.ie/"
              target="_blank"
              rel="noreferrer"
            >
              Zadig drivers
            </Link>{' '}
            installed.
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Connect your goggles to your computer.
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Click Connect to goggles.
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Wait for goggles to connect.
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Power up your drone.
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
}
