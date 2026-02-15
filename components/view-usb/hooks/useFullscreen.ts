'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

type FullscreenControls = {
  isFullscreen: boolean;
  isSupported: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
};

export default function useFullscreen<T extends HTMLElement>(targetRef: RefObject<T | null>): FullscreenControls {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSupported = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  const updateState = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const activeElement = document.fullscreenElement;
    setIsFullscreen(!!activeElement && activeElement === targetRef.current);
  }, [targetRef]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    updateState();
    document.addEventListener('fullscreenchange', updateState);

    return () => {
      document.removeEventListener('fullscreenchange', updateState);
    };
  }, [updateState]);

  const enter = useCallback(async () => {
    const element = targetRef.current;
    if (!element || typeof element.requestFullscreen !== 'function') {
      return;
    }

    try {
      await element.requestFullscreen();
    } catch (error) {
      console.error('[useFullscreen] requestFullscreen failed', error);
    }
  }, [targetRef]);

  const exit = useCallback(async () => {
    if (typeof document === 'undefined' || !document.fullscreenElement) {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch (error) {
      console.error('[useFullscreen] exitFullscreen failed', error);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isFullscreen) {
      await exit();
      return;
    }

    await enter();
  }, [enter, exit, isFullscreen]);

  return {
    isFullscreen,
    isSupported,
    enter,
    exit,
    toggle,
  };
}
