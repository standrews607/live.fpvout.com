'use client';

import { Box, Card, CardContent, Typography } from '@mui/material';
import type GogglesDevice from '@/lib/Goggles';
import useMetrics from '../hooks/useMetrics';
import StatCard from './StatCard';

type MetricsPanelProps = {
  device: GogglesDevice;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export default function MetricsPanel({ device }: MetricsPanelProps) {
  const { metrics, isConnected } = useMetrics(device);

  if (!isConnected) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Video Metrics
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          <StatCard label="FPS" value={metrics.calculatedFps} />
          <StatCard label="Bitrate" value={metrics.formattedBitrate} />
          <StatCard label="Frames" value={metrics.frameCount} />
          <StatCard label="Avg Frame Size" value={formatBytes(metrics.averageFrameSize)} />
          <StatCard label="Total Data" value={formatBytes(metrics.totalBytesReceived)} />
          <StatCard label="Uptime" value={formatDuration(metrics.uptime)} />
          <StatCard
            label="Errors"
            value={metrics.consecutiveErrors}
            unit={metrics.consecutiveErrors > 0 ? '⚠️' : '✓'}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
