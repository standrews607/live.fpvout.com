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
      notify('WebUSB is not supported in this browser.', 'warning');
      return;
    }

    setIsConnecting(true);

    try {
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: VID, productId: PID }],
      });

      const newGoggles = new GogglesDevice(device);
      await newGoggles.connect();
      const ok = await newGoggles.requestVideo();

      if (!ok) {
        notify('Failed to request video stream from goggles.', 'error');
        return;
      }

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
        errorMessage = 'WebUSB permission was denied. Please try again and allow the connection.';
        severity = 'warning';
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        errorMessage = 'No device selected.';
        severity = 'warning';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      notify(errorMessage, severity);
    } finally {
      setIsConnecting(false);
    }
  }, [supported, notify]);

  const disconnect = useCallback(async (id: string) => {
    setDevices((current) => {
      const entry = current.find((item) => item.id === id);
      if (entry) {
        entry.device.disconnect().catch(() => {
          // no-op
        });
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const disconnectAll = useCallback(async () => {
    devices.forEach((entry) => {
      entry.device.disconnect().catch(() => {
        // no-op
      });
    });
    setDevices([]);
  }, [devices]);

  return {
    devices,
    connect,
    disconnect,
    disconnectAll,
    isConnecting,
    compatibleBrowser,
    supported,
  };
}
