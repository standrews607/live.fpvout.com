'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import type GogglesDevice from '@/lib/Goggles';
import H264WebCodecsDecoder from '@/lib/WebCodecsDecoder';
import PlayerToolbar from './PlayerToolbar';
import MetricsPanel from './MetricsPanel';

type GogglePlayerProps = {
  device: GogglesDevice;
  onDisconnect: () => void;
};

export default function GogglePlayer({ device, onDisconnect }: GogglePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decoderRef = useRef<H264WebCodecsDecoder | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionState, setConnectionState] = useState({ isReconnecting: false, reconnectAttempts: 0, maxReconnectAttempts: 5 });
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
        console.error(`[GogglePlayer] Decoder error detected: ${statsAfter.decodeErrors - statsBefore.decodeErrors} new error(s)`, statsAfter);
      }

      const now = Date.now();
      if (now - lastMetricsLogRef.current > 5000) {
        lastMetricsLogRef.current = now;
        const metrics = device.getMetrics();
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

    device.startPolling();

    return () => {
      device.stopPolling();
      decoderRef.current?.destroy();
      decoderRef.current = null;
    };
  }, [device]);

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Device {device.serialNumber ?? 'Unknown'}
          </Typography>
          <Box
            sx={{
              position: 'relative',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'common.black',
              minHeight: 480,
          }}
        >
          <PlayerToolbar onDisconnect={onDisconnect} />
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
      </CardContent>
    </Card>
    <MetricsPanel device={device} />
    </>
  );
}
