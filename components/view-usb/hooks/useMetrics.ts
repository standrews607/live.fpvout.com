'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type GogglesDevice from '@/lib/Goggles';

export interface MetricsData {
  frameCount: number;
  totalBytesReceived: number;
  averageFrameSize: number;
  lastFrameTime: number;
  consecutiveErrors: number;
  decoderErrorCount: number;
  calculatedFps: number;
  formattedBitrate: string;
  uptime: number;
}

export interface UseMetricsResult {
  metrics: MetricsData;
  isConnected: boolean;
}

const METRICS_POLL_INTERVAL = 500; // ms, updates 2x per second
const BITRATE_WINDOW_SIZE = 60; // Track last 60 frames for ~1 second rolling window

interface FrameSnapshot {
  timestamp: number;
  cumulativeBytes: number;
}

export default function useMetrics(device: GogglesDevice | null): UseMetricsResult {
  const [metrics, setMetrics] = useState<MetricsData>({
    frameCount: 0,
    totalBytesReceived: 0,
    averageFrameSize: 0,
    lastFrameTime: 0,
    consecutiveErrors: 0,
    decoderErrorCount: 0,
    calculatedFps: 0,
    formattedBitrate: '0 Mbps',
    uptime: 0,
  });

  const [deviceStartTime] = useState(() => Date.now());
  const frameHistoryRef = useRef<FrameSnapshot[]>([]);
  const lastFrameCountRef = useRef(0);

  const updateMetrics = useCallback(() => {
    if (!device) return;

    const raw = device.getMetrics();
    const now = Date.now();
    const uptime = now - deviceStartTime;

    // Track frame snapshots for per-frame bitrate calculation
    if (raw.frameCount > lastFrameCountRef.current) {
      frameHistoryRef.current.push({
        timestamp: now,
        cumulativeBytes: raw.totalBytesReceived,
      });
      lastFrameCountRef.current = raw.frameCount;

      // Keep only recent frames for rolling window calculation
      if (frameHistoryRef.current.length > BITRATE_WINDOW_SIZE) {
        frameHistoryRef.current.shift();
      }
    }

    // Calculate actual FPS based on elapsed time since first frame
    let calculatedFps = 0;
    if (raw.lastFrameTime > 0 && uptime > 0) {
      const elapsedSec = uptime / 1000;
      calculatedFps = elapsedSec > 0 ? Math.round((raw.frameCount / elapsedSec) * 10) / 10 : 0;
    }

    // Calculate bitrate using rolling window of recent frames (per-frame approach)
    let bitrateMbps = 0;
    if (frameHistoryRef.current.length >= 2) {
      const oldest = frameHistoryRef.current[0];
      const newest = frameHistoryRef.current[frameHistoryRef.current.length - 1];
      const timeWindowSec = (newest.timestamp - oldest.timestamp) / 1000;
      const bytesInWindow = newest.cumulativeBytes - oldest.cumulativeBytes;

      if (timeWindowSec > 0) {
        const bitrate = (bytesInWindow * 8) / timeWindowSec; // bits per second
        bitrateMbps = bitrate / 1_000_000; // convert to Mbps
      }
    }
    const formattedBitrate = bitrateMbps.toFixed(2);

    setMetrics({
      frameCount: raw.frameCount,
      totalBytesReceived: raw.totalBytesReceived,
      averageFrameSize: Math.round(raw.averageFrameSize),
      lastFrameTime: raw.lastFrameTime,
      consecutiveErrors: raw.consecutiveErrors,
      decoderErrorCount: raw.decoderErrorCount,
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
