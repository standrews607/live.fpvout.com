import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Forum, GitHub } from '@mui/icons-material';
import ShopIcon from '@mui/icons-material/Shop';
import NavbarBreadcrumbs from './NavbarBreadcrumbs';
import ColorModeIconDropdown from '@/components/shared-theme/ColorModeIconDropdown';
import { GradientHeaderStack } from './styled';

export default function Header() {
  return (
    <GradientHeaderStack spacing={2}>
      {/* <Box>
        <NavbarBreadcrumbs />
      </Box> */}
      <Box>
        <Tooltip title="View the code on GitHub">
          <IconButton
            color="inherit"
            size="medium"
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
            size="medium"
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
            <IconButton color="inherit" size="medium" disabled>
              <ShopIcon />
            </IconButton>
          </span>
        </Tooltip>
        <ColorModeIconDropdown color="inherit" size="medium" />
      </Box>
    </GradientHeaderStack>
  );
}
