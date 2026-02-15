'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Card, CardContent, Typography, Select, MenuItem, FormControl, FormLabel, Stack } from '@mui/material';
import type GogglesDevice from '@/lib/Goggles';
import { StreamMode, POLLING_PROFILES } from '@/lib/Goggles';
import H264WebCodecsDecoder from '@/lib/WebCodecsDecoder';
import PlayerToolbar from './PlayerToolbar';
import MetricsPanel from './MetricsPanel';
import useFullscreen from '../hooks/useFullscreen';

type GogglePlayerProps = {
  device: GogglesDevice;
  onDisconnect: () => void;
};

export default function GogglePlayer({ device, onDisconnect }: GogglePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const decoderRef = useRef<H264WebCodecsDecoder | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionState, setConnectionState] = useState({
    isReconnecting: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    currentMode: StreamMode.Normal60fps_25Mbps,
    currentPollingInterval: 15,
    decoderQueueDepth: 0,
  });
  const [selectedMode, setSelectedMode] = useState<StreamMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goggleStreamMode') as StreamMode | null;
      return saved && Object.values(StreamMode).includes(saved) ? saved : StreamMode.Normal60fps_25Mbps;
    }
    return StreamMode.Normal60fps_25Mbps;
  });
  const playerIdRef = useRef(
    `player-${device.serialNumber ?? crypto.randomUUID()}`,
  );
  const frameDropCountRef = useRef(0);
  const lastMetricsLogRef = useRef(Date.now());
  const lastMetricsSnapshotRef = useRef({
    timestamp: Date.now(),
    frameCount: 0,
    totalBytes: 0,
  });
  const {
    isFullscreen,
    isSupported: isFullscreenSupported,
    toggle: toggleFullscreen,
    exit: exitFullscreen,
  } = useFullscreen(playerSurfaceRef);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas.id) {
      canvas.id = playerIdRef.current;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    decoderRef.current = new H264WebCodecsDecoder({
      renderFrame: (frame) => {
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
        }

        context.drawImage(frame, 0, 0, canvas.width, canvas.height);
        frame.close();
        setIsPlaying(true);
      },
      onError: (error) => {
        console.error(`Decoder error: ${error}`);
      },
      onQueueDepthChange: (depth: number) => {
        device.updateDecoderQueueDepth(depth);
        setConnectionState((prev) => ({ ...prev, decoderQueueDepth: depth }));
      },
      fps: 60,
      debug: true,
    });

    device.onData = (data) => {
      if (data.buffer.byteLength === 0 || !decoderRef.current) {
        return;
      }

      const frameData = new Uint8Array(data.buffer);
      const statsBefore = decoderRef.current.getStats();
      decoderRef.current.push(frameData);
      const statsAfter = decoderRef.current.getStats();
      frameDropCountRef.current += statsAfter.droppedFrames - statsBefore.droppedFrames;

      if (statsAfter.decodeErrors !== statsBefore.decodeErrors) {
        device.updateDecoderErrorCount(statsAfter.decodeErrors);
      }

      if (statsAfter.decodeErrors !== statsBefore.decodeErrors) {
        console.error(`[GogglePlayer] Decoder error detected: ${statsAfter.decodeErrors - statsBefore.decodeErrors} new error(s)`, statsAfter);
      }

      const now = Date.now();
      if (now - lastMetricsLogRef.current > 5000) {
        lastMetricsLogRef.current = now;
        const metrics = device.getMetrics();
        const decoderStats = decoderRef.current.getStats();
        const snapshot = lastMetricsSnapshotRef.current;
        const elapsedSec = Math.max(0.001, (now - snapshot.timestamp) / 1000);
        const chunkRate = (metrics.frameCount - snapshot.frameCount) / elapsedSec;
        const bitrateMbps =
          ((metrics.totalBytesReceived - snapshot.totalBytes) * 8) /
          elapsedSec /
          1_000_000;
        lastMetricsSnapshotRef.current = {
          timestamp: now,
          frameCount: metrics.frameCount,
          totalBytes: metrics.totalBytesReceived,
        };
        console.log(
          `[GogglePlayer] Video Stats: ${chunkRate.toFixed(2)} chunks/s, ${metrics.frameCount} chunks, ` +
            `Bitrate ${bitrateMbps.toFixed(2)} Mbps, ` +
            `Avg chunk ${metrics.averageFrameSize.toFixed(0)}B, ` +
            `Avg latency ${decoderStats.avgLatency}ms, ` +
            `Dropped: ${frameDropCountRef.current}, Errors: ${metrics.consecutiveErrors}`,
        );
      }
    };

    device.onLostConnection = () => {
      console.error('[GogglePlayer] Connection lost!');
      setIsPlaying(false);
      setConnectionState(device.getConnectionState());
    };

    device.onReconnect = (attempt: number) => {
      const state = device.getConnectionState();
      console.warn(`[GogglePlayer] Attempting to reconnect (${attempt}/${state.maxReconnectAttempts})...`);
      setConnectionState(state);
    };

    device.onModeChangeCallback = (mode: StreamMode) => {
      const state = device.getConnectionState();
      setConnectionState(state);
      const modeProfile = POLLING_PROFILES[mode];
      console.log(`[GogglePlayer] Mode changed to: ${modeProfile.description}`);
    };

    device.startPolling();

    return () => {
      device.stopPolling();
      decoderRef.current?.destroy();
      decoderRef.current = null;
    };
  }, [device]);

  useEffect(() => {
    return () => {
      exitFullscreen();
    };
  }, [exitFullscreen]);

  const handleModeChange = (e: any) => {
    const mode = e.target.value as StreamMode;
    setSelectedMode(mode);
    device.setStreamMode(mode);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('goggleStreamMode', mode);
    }
  };

  const handleDisconnect = () => {
    exitFullscreen();
    onDisconnect();
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" color="text.secondary">
                Device {device.serialNumber ?? 'Unknown'}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <FormLabel>
                  <Typography variant="caption">Operating Mode</Typography>
                </FormLabel>
                <Select
                  value={selectedMode}
                  onChange={handleModeChange}
                  size="small"
                >
                  {Object.entries(POLLING_PROFILES).map(([mode, profile]) => (
                    <MenuItem key={mode} value={mode}>
                      {profile.description} ({(profile.bufferSize / 1024).toFixed(0)}KB)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Polling: {connectionState.currentPollingInterval}ms | Queue: {connectionState.decoderQueueDepth} frames
            </Typography>
            <Box
              ref={playerSurfaceRef}
              className="goggle-player-surface"
              sx={{
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'common.black',
                minHeight: 480,
                '&:fullscreen': {
                  borderRadius: 0,
                  width: '100vw',
                  height: '100vh',
                },
              }}
            >
              <PlayerToolbar
                onDisconnect={handleDisconnect}
                onToggleFullscreen={toggleFullscreen}
                isFullscreen={isFullscreen}
                isFullscreenSupported={isFullscreenSupported}
              />
              <canvas
                ref={canvasRef}
                id={playerIdRef.current}
                style={{
                  width: '100%',
                  height: '100%',
                  display: isPlaying ? 'block' : 'none',
                  backgroundColor: 'black',
                }}
              />
              {!isPlaying && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    px: 2,
                    gap: 2,
                  }}
                >
                  {connectionState.isReconnecting ? (
                    <>
                      <Typography variant="h6" color="warning.main">
                        Connection Lost - Reconnecting…
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Attempt {connectionState.reconnectAttempts}/{connectionState.maxReconnectAttempts}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="h6" color="text.secondary">
                      Please power on your drone…
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
      <MetricsPanel device={device} />
    </>
  );
}