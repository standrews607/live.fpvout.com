'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  margin: 0,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  [`& .${breadcrumbsClasses.separator}`]: {
    color: (theme.vars || theme).palette.action.disabled,
    margin: 1,
  },
  [`& .${breadcrumbsClasses.ol}`]: {
    alignItems: 'center',
  },
  '& .MuiTypography-root': {
    display: 'flex',
    alignItems: 'center',
  },
}));

// Optional: map route segments to nicer labels
const segmentLabel = (seg: string) => {
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    settings: 'Settings',
    users: 'Users',
    app: 'App',
    usb: 'USB Viewer',
  };
  return map[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function NavbarBreadcrumbs() {
  const pathname = usePathname(); // e.g. "/app/usb"
  const segments = useMemo(
    () => pathname.split('/').filter(Boolean),
    [pathname]
  );

  // Build cumulative hrefs for each segment
  const crumbs = useMemo(() => {
    const paths: { label: string; href: string }[] = [];
    let acc = '';
    segments.forEach((seg, idx) => {
      acc += `/${seg}`;
      paths.push({ label: segmentLabel(seg), href: acc });
    });
    return paths;
  }, [segments]);

  // If you want to hide dynamic IDs or params, filter them here
  // Example: omit numeric IDs
  const displayCrumbs = crumbs.filter(c => !/^\d+$/.test(c.label));

  return (
    <StyledBreadcrumbs
      aria-label="breadcrumb"
      separator={<NavigateNextRoundedIcon fontSize="small" />}
    >
      {/* Optional home root */}
      <Link href="/" passHref>
        <Typography variant="body1" sx={{ textDecoration: 'none', color: 'text.secondary' }}>
          Live FPV View
        </Typography>
      </Link>

      {displayCrumbs.map((c, i) => {
        const isLast = i === displayCrumbs.length - 1;
        if (isLast) {
          return (
            <Typography key={c.href} variant="body1" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {c.label}
            </Typography>
          );
        }
        return (
          <Link key={c.href} href={c.href} passHref>
            <Typography variant="body1" sx={{ textDecoration: 'none', color: 'text.secondary' }}>
              {c.label}
            </Typography>
          </Link>
        );
      })}
    </StyledBreadcrumbs>
  );
}
