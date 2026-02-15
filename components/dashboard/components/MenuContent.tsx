'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import type { NavItem } from '../DashboardProvider';

interface MenuContentProps {
  navigation: NavItem[];
}

export default function MenuContent({ navigation }: MenuContentProps) {
  const pathname = usePathname();

  const renderList = (items: NavItem[]) => (
    <List dense>
      {items.map((item) => {
        const selected = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        return (
          <ListItem key={item.href} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              component={Link}
              href={item.href}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              sx={{
                pl: 2.5,
                pr: 1.5,
                py: 1.5,
                '&.Mui-selected, &.Mui-selected:hover': {
                  bgcolor: 'action.selected',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: 2,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem' }} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );

  return (
    <Stack sx={{ flexGrow: 1, p: 1, gap: 1 }}>
      {renderList(navigation)}
    </Stack>
  );
}
