'use client';

import { useCallback, useEffect, useState } from 'react';
import type GogglesDevice from '@/lib/Goggles';

export interface MetricsData {
  frameCount: number;
  totalBytesReceived: number;
  averageFrameSize: number;
  lastFrameTime: number;
  consecutiveErrors: number;
  calculatedFps: number;
  formattedBitrate: string;
  uptime: number;
}

export interface UseMetricsResult {
  metrics: MetricsData;
  isConnected: boolean;
}

const METRICS_POLL_INTERVAL = 500; // ms, updates 2x per second

export default function useMetrics(device: GogglesDevice | null): UseMetricsResult {
  const [metrics, setMetrics] = useState<MetricsData>({
    frameCount: 0,
    totalBytesReceived: 0,
    averageFrameSize: 0,
    lastFrameTime: 0,
    consecutiveErrors: 0,
    calculatedFps: 0,
    formattedBitrate: '0 Mbps',
    uptime: 0,
  });

  const [deviceStartTime] = useState(() => Date.now());

  const updateMetrics = useCallback(() => {
    if (!device) return;

    const raw = device.getMetrics();
    const now = Date.now();
    const uptime = now - deviceStartTime;

    // Calculate actual FPS based on elapsed time since first frame
    let calculatedFps = 0;
    if (raw.lastFrameTime > 0 && uptime > 0) {
      const elapsedSec = uptime / 1000;
      calculatedFps = elapsedSec > 0 ? Math.round((raw.frameCount / elapsedSec) * 10) / 10 : 0;
    }

    // Calculate bitrate: totalBytes / time in seconds, convert to Mbps
    let bitrateMbps = 0;
    if (uptime > 0) {
      const bitrate = (raw.totalBytesReceived * 8) / (uptime / 1000); // bits per second
      bitrateMbps = bitrate / 1_000_000; // convert to Mbps
    }
    const formattedBitrate = bitrateMbps.toFixed(2);

    setMetrics({
      frameCount: raw.frameCount,
      totalBytesReceived: raw.totalBytesReceived,
      averageFrameSize: Math.round(raw.averageFrameSize),
      lastFrameTime: raw.lastFrameTime,
      consecutiveErrors: raw.consecutiveErrors,
      calculatedFps,
      formattedBitrate: `${formattedBitrate} Mbps`,
      uptime,
    });
  }, [device, deviceStartTime]);

  useEffect(() => {
    if (!device) return;

    // Initial update
    updateMetrics();

    // Poll for updates
    const interval = setInterval(updateMetrics, METRICS_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [device, updateMetrics]);

  return {
    metrics,
    isConnected: !!device,
  };
}
