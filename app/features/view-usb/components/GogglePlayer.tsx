'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import JMuxer from 'jmuxer';
import type GogglesDevice from '@/lib/Goggles';
import PlayerToolbar from './PlayerToolbar';

type GogglePlayerProps = {
  device: GogglesDevice;
  onDisconnect: () => void;
};

export default function GogglePlayer({ device, onDisconnect }: GogglePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const muxerRef = useRef<JMuxer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerIdRef = useRef(
    `player-${device.serialNumber ?? crypto.randomUUID()}`,
  );

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    muxerRef.current = new JMuxer({
      node: playerIdRef.current,
      debug: false,
      mode: 'video',
      fps: 60,
    });

    device.onData = (data) => {
      if (data.buffer.byteLength === 0 || !muxerRef.current) {
        return;
      }

      muxerRef.current.feed({
        video: new Uint8Array(data.buffer),
      });

      setIsPlaying(true);
    };

    device.startPolling();

    return () => {
      device.stopPolling();
      muxerRef.current?.destroy?.();
      muxerRef.current = null;
    };
  }, [device]);

  useEffect(() => {
    if (!isPlaying || !videoRef.current) {
      return;
    }

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {
        // no-op
      });
    }
  }, [isPlaying]);

  return (
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
          <video
            ref={videoRef}
            id={playerIdRef.current}
            controls
            autoPlay
            muted
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
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                px: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary">
                Waiting to receive video…
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
