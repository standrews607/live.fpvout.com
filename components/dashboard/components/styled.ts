'use client';

import { styled } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

/**
 * Gradient header container for dashboard header
 * Applies a vibrant purple-to-blue gradient background
 * with white text color suitable for dashboard branding
 */
export const GradientHeaderStack = styled(Stack)(({ theme }) => ({
  width: '100%',
  height: '64px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'right',
  maxWidth: '1700px',
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  background:
    'linear-gradient(45deg, rgba(71,118,230,1) 0%, rgba(142,84,233,1) 100%)',
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

/**
 * Mobile-friendly toolbar for AppNavbar
 * Stacks items vertically with proper spacing
 */
export const StyledToolbar = styled(Toolbar)({
  width: '100%',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  justifyContent: 'center',
  gap: '12px',
  flexShrink: 0,
});

/**
 * Branded icon for dashboard identity
 * Uses gradient background with inset shadow for depth
 */
export const CustomIconBox = styled(Box)({
  width: '1.5rem',
  height: '1.5rem',
  bgcolor: 'black',
  borderRadius: '999px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'center',
  backgroundImage:
    'linear-gradient(135deg, hsl(210, 98%, 60%) 0%, hsl(210, 100%, 35%) 100%)',
  color: 'hsla(210, 100%, 95%, 0.9)',
  border: '1px solid',
  borderColor: 'hsl(210, 100%, 55%)',
  boxShadow: 'inset 0 2px 5px rgba(255, 255, 255, 0.3)',
});

