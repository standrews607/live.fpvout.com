'use client';

import { useCallback, useMemo, useState } from 'react';
import GogglesDevice, { PID, VID } from '@/lib/Goggles';
import { useNotification } from '@/lib/NotificationProvider';

export type GoggleEntry = {
  id: string;
  device: GogglesDevice;
};

export type UseGogglesResult = {
  devices: GoggleEntry[];
  connect: () => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  reconnect: (id: string) => Promise<void>;
  isConnecting: boolean;
  compatibleBrowser: boolean;
  supported: boolean;
};

const isChrome = (userAgent: string) => userAgent.includes('Chrome');

export default function useGoggles(): UseGogglesResult {
  const { notify } = useNotification();
  const [devices, setDevices] = useState<GoggleEntry[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const compatibleBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return isChrome(navigator.userAgent);
  }, []);

  const supported = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return 'usb' in navigator;
  }, []);

  const connect = useCallback(async () => {
    if (!supported) {
      console.error('[useGoggles] WebUSB is not supported in this browser');
      notify('WebUSB is not supported in this browser.', 'warning');
      return;
    }

    console.log('[useGoggles] User connecting to device...');
    setIsConnecting(true);

    try {
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: VID, productId: PID }],
      });

      console.log('[useGoggles] Device selected:', device.serialNumber);
      const newGoggles = new GogglesDevice(device);
      await newGoggles.connect();
      console.log('[useGoggles] Device connected, requesting video...');
      const ok = await newGoggles.requestVideo();

      if (!ok) {
        console.error('[useGoggles] Video request failed');
        notify('Failed to request video stream from goggles.', 'error');
        return;
      }

      // Restore saved operating mode from localStorage
      if (typeof window !== 'undefined') {
        const savedMode = localStorage.getItem('goggleStreamMode');
        if (savedMode) {
          try {
            newGoggles.setStreamMode(savedMode as any);
            console.log(`[useGoggles] Restored operating mode: ${savedMode}`);
          } catch (err) {
            console.warn('[useGoggles] Failed to restore operating mode:', err);
          }
        }
      }

      console.log('[useGoggles] Video requested successfully, adding to devices');
      setDevices((current) => {
        const serial = newGoggles.serialNumber;
        if (serial && current.some((item) => item.device.serialNumber === serial)) {
          return current;
        }

        const id = serial ?? crypto.randomUUID();
        return [...current, { id, device: newGoggles }];
      });
    } catch (err) {
      let errorMessage = 'Unable to connect to goggles.';
      let severity: 'error' | 'warning' = 'error';

      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        console.warn('[useGoggles] WebUSB permission denied');
        errorMessage = 'WebUSB permission was denied. Please try again and allow the connection.';
        severity = 'warning';
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        console.log('[useGoggles] No device selected');
        errorMessage = 'No device selected.';
        severity = 'warning';
      } else if (err instanceof Error) {
        console.error('[useGoggles] Connection error:', err);
        errorMessage = err.message;
      }

      notify(errorMessage, severity);
    } finally {
      setIsConnecting(false);
    }
  }, [supported, notify]);

  const disconnect = useCallback(async (id: string) => {
    console.log('[useGoggles] Disconnecting device:', id);
    setDevices((current) => {
      const entry = current.find((item) => item.id === id);
      if (entry) {
        entry.device.disconnect().catch((err) => {
          console.error('[useGoggles] Disconnect error:', err);
        });
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const disconnectAll = useCallback(async () => {
    console.log('[useGoggles] Disconnecting all devices');
    devices.forEach((entry) => {
      entry.device.disconnect().catch((err) => {
        console.error('[useGoggles] Disconnect error:', err);
      });
    });
    setDevices([]);
  }, [devices]);

  const reconnect = useCallback(async (id: string) => {
    console.log('[useGoggles] Manual reconnect requested for:', id);
    const entry = devices.find((item) => item.id === id);
    if (entry) {
      entry.device.reconnect().catch((err) => {
        console.error('[useGoggles] Reconnect failed:', err);
        notify('Failed to reconnect to goggles.', 'error');
      });
    }
  }, [devices, notify]);

  return {
    devices,
    connect,
    disconnect,
    disconnectAll,
    reconnect,
    isConnecting,
    compatibleBrowser,
    supported,
  };
}
