'use client';

import { Box, Card, CardContent, Typography } from '@mui/material';

type StatCardProps = {
  label: string;
  value: string | number;
  unit?: string;
};

export default function StatCard({ label, value, unit }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
          {unit && (
            <Typography variant="body2" color="text.secondary">
              {unit}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
