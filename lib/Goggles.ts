const ENDPOINT_OUT = 3;
const ENDPOINT_IN = 4;
const INITIAL_BUFFER_SIZE = 2097152; // Start with 2MB based on pcap analysis (170KB peak frames)
const MAX_BUFFER_SIZE = 8388608; // Max 8MB ring buffer for smooth playback
const MIN_BUFFER_SIZE = 524288; // Min 512KB to handle peak 170KB IDR frames
const POLLING_INTERVAL_MS = 15; // 15ms polling aligned to 16.67ms frame cycle (60fps)
export const VID = 0x2ca3;
export const PID = 0x001f;

export enum StreamMode {
  LowLatency120fps_50Mbps = 'lowlatency_120fps_50mbps',
  LowLatency120fps_25Mbps = 'lowlatency_120fps_25mbps',
  Normal60fps_50Mbps = 'normal_60fps_50mbps',
  Normal60fps_25Mbps = 'normal_60fps_25mbps',
}

export const POLLING_PROFILES: Record<StreamMode, { interval: number; bufferSize: number; description: string }> = {
  [StreamMode.LowLatency120fps_50Mbps]: {
    interval: 7,
    bufferSize: 4194304, // 4MB
    description: 'Low Latency 120fps @ 50Mbps',
  },
  [StreamMode.LowLatency120fps_25Mbps]: {
    interval: 7,
    bufferSize: 2097152, // 2MB
    description: 'Low Latency 120fps @ 25Mbps',
  },
  [StreamMode.Normal60fps_50Mbps]: {
    interval: 15,
    bufferSize: 2097152, // 2MB
    description: 'Normal 60fps @ 50Mbps',
  },
  [StreamMode.Normal60fps_25Mbps]: {
    interval: 15,
    bufferSize: 2097152, // 2MB
    description: 'Normal 60fps @ 25Mbps',
  },
};

interface DataCallback {
  (data: DataView): void;
}

interface ErrorCallback {
  (error: string): void;
}

interface PerformanceMetrics {
  frameCount: number;
  totalBytesReceived: number;
  averageFrameSize: number;
  lastFrameTime: number;
  consecutiveErrors: number;
}

export default class Goggles {
  private device: USBDevice;
  private onDataCallback: DataCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private pollData: boolean = false;
  private pollPromise: Promise<void> | null = null;
  private dynamicBufferSize: number = INITIAL_BUFFER_SIZE;
  private frameFrameSizes: number[] = [];
  private metrics: PerformanceMetrics = {
    frameCount: 0,
    totalBytesReceived: 0,
    averageFrameSize: 0,
    lastFrameTime: 0,
    consecutiveErrors: 0,
  };
  private retryDelay: number = 100; // ms, exponential backoff
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isReconnecting: boolean = false;
  private backoffTimeout: number | null = null;
  private onReconnectAttempt: ((attemptCount: number) => void) | null = null;
  private onConnectionLost: (() => void) | null = null;
  // Frame reassembly buffers for double-buffering
  private activeBuffer: Uint8Array = new Uint8Array(INITIAL_BUFFER_SIZE);
  private activeBufferLen: number = 0;
  private pendingFrameBuffer: Uint8Array = new Uint8Array(INITIAL_BUFFER_SIZE);
  private pendingFrameLen: number = 0;
  private lastTransferTime: number = 0;
  // Dynamic polling support
  private currentMode: StreamMode = StreamMode.Normal60fps_25Mbps;
  private adaptivePollingInterval: number = POLLING_INTERVAL_MS;
  private frameArrivalTimes: number[] = [];
  private lastFrameTimestamp: number = 0;
  private decoderQueueDepth: number = 0;
  private onModeChange: ((mode: StreamMode) => void) | null = null;
  // Polling consistency tracking
  private pollingIntervalHistory: number[] = [];
  private pollingDriftWarningThreshold = 3; // ms
  private successCount: number = 0;
  private nextPollAt: number = 0;
  private lastPollTimestamp: number = 0;

  constructor(device: USBDevice) {
    this.device = device;
    this.setupDisconnectListener();
  }

  set onModeChangeCallback(callback: ((mode: StreamMode) => void) | null) {
    this.onModeChange = callback;
  }

  getStreamMode(): StreamMode {
    return this.currentMode;
  }

  setStreamMode(mode: StreamMode): void {
    if (mode === this.currentMode) {
      console.log(`[Goggles] Already in mode: ${POLLING_PROFILES[mode].description}`);
      return;
    }

    const profile = POLLING_PROFILES[mode];
    this.currentMode = mode;
    this.adaptivePollingInterval = profile.interval;
    this.dynamicBufferSize = profile.bufferSize;
    this.frameArrivalTimes = []; // Reset adaptive tracking
    this.lastFrameTimestamp = 0;

    // Reallocate buffers if needed
    if (this.activeBuffer.length !== profile.bufferSize) {
      this.activeBuffer = new Uint8Array(profile.bufferSize);
      this.pendingFrameBuffer = new Uint8Array(profile.bufferSize);
      this.activeBufferLen = 0;
      this.pendingFrameLen = 0;
    }

    console.log(`[Goggles] Switched to mode: ${profile.description}`);
    console.log(`[Goggles] Polling interval: ${profile.interval}ms, Buffer: ${profile.bufferSize / 1024}KB`);

    if (this.onModeChange) {
      this.onModeChange(mode);
    }
  }

  updateDecoderQueueDepth(depth: number): void {
    this.decoderQueueDepth = depth;
  }

  private recordFrameArrival(): void {
    const now = performance.now();
    if (this.lastFrameTimestamp > 0) {
      const interval = now - this.lastFrameTimestamp;
      this.frameArrivalTimes.push(interval);
      if (this.frameArrivalTimes.length > 10) {
        this.frameArrivalTimes.shift(); // Keep last 10
      }
      this.updateAdaptivePollingInterval();
    }
    this.lastFrameTimestamp = now;
  }

  private updateAdaptivePollingInterval(): void {
    if (this.frameArrivalTimes.length < 5) return; // Need baseline

    const avgInterval = this.frameArrivalTimes.reduce((sum, t) => sum + t, 0) / this.frameArrivalTimes.length;
    const baseInterval = POLLING_PROFILES[this.currentMode].interval;

    // Clamp adaptive adjustment to ±2ms from base (prevent drift)
    const maxDeviation = 2;
    const targetInterval = Math.max(
      baseInterval - maxDeviation,
      Math.min(baseInterval + maxDeviation, avgInterval - 2),
    );

    // Slower EMA to prevent oscillation (0.8 instead of 0.7)
    const newInterval = Math.round(this.adaptivePollingInterval * 0.8 + targetInterval * 0.2);

    if (Math.abs(newInterval - this.adaptivePollingInterval) > 1) {
      console.log(
        `[Goggles] Adaptive polling adjusted: ${this.adaptivePollingInterval}ms → ${newInterval}ms (frame avg: ${avgInterval.toFixed(1)}ms, base: ${baseInterval}ms)`,
      );
      this.adaptivePollingInterval = newInterval;
    }
  }

  private checkPollingConsistency(): void {
    if (this.pollingIntervalHistory.length < 20) return;

    const recent = this.pollingIntervalHistory.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const stdDev = Math.sqrt(recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length);

    if (stdDev > this.pollingDriftWarningThreshold) {
      console.warn(`[Goggles] Polling drift detected: avg=${avg.toFixed(1)}ms, stdDev=${stdDev.toFixed(1)}ms`);
    }
  }

  private calculateDynamicPollingInterval(): number {
    const baseInterval = POLLING_PROFILES[this.currentMode].interval;
    
    // Adaptive adjustment from frame timing
    const framingDelta = this.frameArrivalTimes.length >= 5 
      ? this.adaptivePollingInterval - baseInterval 
      : 0;
    
    // Backpressure adjustment from decoder queue
    let backpressureDelta = 0;
    if (this.decoderQueueDepth === 0) {
      backpressureDelta = -2; // Queue empty, poll slightly faster
    } else if (this.decoderQueueDepth > 12) {
      backpressureDelta = 5; // Queue saturated, poll slower
    }
    
    const finalInterval = Math.max(baseInterval + framingDelta + backpressureDelta, 5);
    return Math.round(finalInterval);
  }

  private appendToActiveBuffer(data: Uint8Array) {
    // Grow buffer if needed (dynamic sizing)
    if (this.activeBufferLen + data.length > this.activeBuffer.length) {
      const newSize = Math.min(
        MAX_BUFFER_SIZE,
        Math.max(this.activeBuffer.length * 2, this.activeBufferLen + data.length)
      );
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.activeBuffer.slice(0, this.activeBufferLen));
      this.activeBuffer = newBuffer;
      console.log(`[Goggles] Buffer grown to ${newSize} bytes`);
    }
    this.activeBuffer.set(data, this.activeBufferLen);
    this.activeBufferLen += data.length;
  }

  private flushActiveBuffer() {
    if (this.activeBufferLen > 0 && this.onDataCallback) {
      this.recordFrameArrival(); // Track timing for adaptive polling
      const frameData = this.activeBuffer.slice(0, this.activeBufferLen);
      this.onDataCallback(new DataView(frameData.buffer, frameData.byteOffset, frameData.byteLength));
      this.activeBufferLen = 0;
      console.log(`[Goggles] Flushed frame buffer: ${frameData.length} bytes`);
    }
  }

  private setupDisconnectListener() {
    // Listen for physical device disconnection
    // USBDevice may have addEventListener on some browsers (not in standard TS types)
    const deviceWithEvent = this.device as unknown as { addEventListener?: (event: string, handler: () => void) => void };
    if (deviceWithEvent.addEventListener) {
      console.log('[Goggles] Setting up disconnect listener');
      deviceWithEvent.addEventListener('disconnect', () => {
        console.log('[Goggles] Device disconnect event fired');
        if (this.pollData) {
          console.warn('[Goggles] Polling was active, triggering reconnection');
          this.handleConnectionLost();
        }
      });
    } else {
      console.warn('[Goggles] Device does not support addEventListener - disconnect detection may not work');
    }
  }

  private handleConnectionLost() {
    console.error('[Goggles] Connection lost detected, starting reconnection sequence');
    this.pollData = false;
    this.isReconnecting = true;
    this.reconnectAttempts = 0;
    if (this.onConnectionLost) {
      console.log('[Goggles] Calling onConnectionLost callback');
      this.onConnectionLost();
    }
    this.attemptReconnect();
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Goggles] Max reconnection attempts (${this.maxReconnectAttempts}) reached, giving up`);
      this.isReconnecting = false;
      if (this.onErrorCallback) {
        this.onErrorCallback('Max reconnection attempts reached. Please reconnect manually.');
      }
      return;
    }

    this.reconnectAttempts++;
    console.log(`[Goggles] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    if (this.onReconnectAttempt) {
      this.onReconnectAttempt(this.reconnectAttempts);
    }

    // Wait 1 second between reconnect attempts
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      console.log('[Goggles] Attempting to open device...');
      if (!this.device.opened) {
        await this.device.open();
        console.log('[Goggles] Device opened successfully');
      }
      await this.device.claimInterface(3);
      console.log('[Goggles] Interface claimed successfully');
      const ok = await this.requestVideo();
      if (ok) {
        console.log('[Goggles] Video requested successfully, reconnection complete');
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.retryDelay = 50;
        this.metrics.consecutiveErrors = 0;
        this.pollData = true;
        this.pollPromise = this.pollLoop();
      } else {
        console.warn('[Goggles] Video request failed, retrying...');
        this.attemptReconnect();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Goggles] Reconnection attempt failed: ${errMsg}, will retry...`);
      this.attemptReconnect();
    }
  }

  set onReconnect(callback: ((attemptCount: number) => void) | null) {
    this.onReconnectAttempt = callback;
  }

  set onLostConnection(callback: (() => void) | null) {
    this.onConnectionLost = callback;
  }

  getConnectionState() {
    return {
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      currentMode: this.currentMode,
      currentPollingInterval: Math.round(this.adaptivePollingInterval),
      decoderQueueDepth: this.decoderQueueDepth,
    };
  }

  get serialNumber() {
    return this.device.serialNumber;
  }

  set onData(callback: DataCallback) {
    this.onDataCallback = callback;
  }

  set onError(callback: ErrorCallback) {
    this.onErrorCallback = callback;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  private updateDynamicBufferSize(frameSize: number) {
    this.frameFrameSizes.push(frameSize);
    if (this.frameFrameSizes.length > 100) {
      this.frameFrameSizes.shift();
    }

    const avg =
      this.frameFrameSizes.reduce((a, b) => a + b, 0) / this.frameFrameSizes.length;
    // Set buffer to 3x average frame size, with bounds
    const newSize = Math.max(MIN_BUFFER_SIZE, Math.min(MAX_BUFFER_SIZE, Math.ceil(avg * 3)));
    this.dynamicBufferSize = newSize;
  }

  async connect() {
    console.log('[Goggles] Connecting to device...');
    if (!this.device.opened) {
      console.log('[Goggles] Opening device...');
      await this.device.open();
      console.log('[Goggles] Device opened');
    }
    console.log('[Goggles] Claiming interface 3...');
    await this.device.claimInterface(3);
    this.retryDelay = 50; // Reset backoff on fresh connection
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    console.log('[Goggles] Connected and interface claimed');
  }

  async requestVideo() {
    const writeResult = await this.sendRawData(new Uint8Array([0x52, 0x4d, 0x56, 0x54]));
    return writeResult.status === 'ok';
  }

  async startPolling() {
    if (this.pollData) return;
    this.pollData = true;
    this.retryDelay = 50; // Start with low backoff for responsiveness
    this.metrics.consecutiveErrors = 0;
    this.isReconnecting = false;
    if (this.backoffTimeout !== null) {
      clearTimeout(this.backoffTimeout);
      this.backoffTimeout = null;
    }
    this.pollPromise = this.pollLoop();
  }

  private async pollLoop() {
    while (this.pollData) {
      try {
        if (!this.device.opened) {
          this.handleConnectionLost();
          break;
        }

        const now = performance.now();
        if (this.nextPollAt === 0) {
          this.nextPollAt = now;
        }

        // Deadline-based polling to prevent drift accumulation
        if (now < this.nextPollAt) {
          const delay = this.nextPollAt - now;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const pollStart = performance.now();
        if (this.lastPollTimestamp > 0) {
          const actualInterval = pollStart - this.lastPollTimestamp;
          this.pollingIntervalHistory.push(actualInterval);
          if (this.pollingIntervalHistory.length > 30) {
            this.pollingIntervalHistory.shift();
          }
          this.checkPollingConsistency();
        }
        this.lastPollTimestamp = pollStart;

        // Calculate dynamic polling interval based on mode, frame timing, and decoder queue
        const pollingInterval = this.calculateDynamicPollingInterval();
        this.nextPollAt = pollStart + pollingInterval;

        this.lastTransferTime = Date.now();
        const result = await this.device.transferIn(ENDPOINT_IN, this.dynamicBufferSize);

        if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
          // Aggressive backoff decay on success
          if (this.metrics.consecutiveErrors === 0) {
            this.successCount += 1;
            if (this.successCount % 5 === 0 && this.retryDelay > 50) {
              this.retryDelay = Math.max(this.retryDelay * 0.95, 50); // Decay 5% per 5 successes
              console.log(`[Goggles] Backoff decay: ${this.retryDelay.toFixed(0)}ms`);
            }
          }

          const frameData = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
          
          // Append to reassembly buffer
          this.appendToActiveBuffer(frameData);
          
          // Heuristic: if buffer contains a complete H.264 frame boundary, flush
          // A frame boundary is detected by consecutive NAL start codes or size threshold
          if (this.activeBufferLen > 200000 || // Larger frames seen in logs
              (this.activeBufferLen > 120000 && frameData.length < 1500)) { // Large chunk followed by small = frame boundary
            this.flushActiveBuffer();
            
            this.metrics.frameCount++;
            this.metrics.totalBytesReceived += this.activeBufferLen;
            this.metrics.lastFrameTime = Date.now();
            this.metrics.consecutiveErrors = 0;
            this.retryDelay = 50;
          }

          // Update dynamic buffer based on observed frame sizes
          if (frameData.length > 100000) {
            // Large frame detected, ensure buffer is large enough
            if (this.dynamicBufferSize < 1048576) {
              this.dynamicBufferSize = 1048576; // Grow to 1MB
              console.log('[Goggles] Detected large frame, growing buffer to 1MB');
            }
          }
        }

        // If we fell far behind, resync deadline to avoid runaway drift
        const driftNow = performance.now();
        if (driftNow - this.nextPollAt > pollingInterval * 2) {
          this.nextPollAt = driftNow;
        }

        // Yield to event loop to prevent blocking
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch (err) {
        this.metrics.consecutiveErrors++;
        
        // Capture comprehensive error details
        let errMsg = '';
        let errName = '';
        let errCode = '';
        let errStack = '';
        
        if (err instanceof DOMException) {
          errMsg = err.message;
          errName = err.name;
          errCode = String(err.code);
          errStack = err.stack || '';
        } else if (err instanceof Error) {
          errMsg = err.message;
          errName = err.name;
          errStack = err.stack || '';
        } else {
          errMsg = String(err);
        }
        
        console.error(`[Goggles] Poll error #${this.metrics.consecutiveErrors}: ${errMsg}`, {
          name: errName,
          code: errCode,
          message: errMsg,
          type: err?.constructor?.name,
          deviceOpened: this.device.opened,
          activeBufferLen: this.activeBufferLen,
          currentBufferSize: this.dynamicBufferSize,
          rawError: err,
          stack: errStack,
        });

        // Detect USB disconnection errors and treat as connection lost immediately
        const isDisconnectionError = 
          errMsg.includes('cancelled') || 
          errMsg.includes('disconnected') || 
          errMsg.includes('transfer was cancelled') ||
          errMsg.includes('no access') ||
          errMsg.includes('device not found') ||
          errName === 'NetworkError' && !this.device.opened;
        
        if (isDisconnectionError) {
          console.error(`[Goggles] Detected USB disconnection error: ${errMsg}`);
          this.pollData = false;
          this.handleConnectionLost();
          break;
        }

        if (this.onErrorCallback !== null) {
          this.onErrorCallback(errMsg);
        }

        // Stop after too many consecutive errors
        if (this.metrics.consecutiveErrors > 30000) {
          console.error(`[Goggles] Exceeded error threshold (${this.metrics.consecutiveErrors}), stopping poll`);
          this.pollData = false;
          this.handleConnectionLost();
          break;
        }

        // Non-blocking exponential backoff with jitter
        const jitter = Math.random() * 50;
        const backoffTime = Math.min(this.retryDelay + jitter, 500); // Cap at 500ms
        this.retryDelay = Math.min(this.retryDelay * 1.5, 500); // Cap at 500ms
        
        if (this.metrics.consecutiveErrors % 5 === 0) {
          console.log(`[Goggles] Backing off ${backoffTime.toFixed(0)}ms (attempt ${this.metrics.consecutiveErrors})`);
        }
        
        // Use a non-blocking wait via setTimeout
        await new Promise((resolve) => {
          const timeoutId = typeof window !== 'undefined' 
            ? window.setTimeout(() => {
                this.backoffTimeout = null;
                resolve(undefined);
              }, backoffTime)
            : setTimeout(() => {
                this.backoffTimeout = null;
                resolve(undefined);
              }, backoffTime) as unknown as number;
          this.backoffTimeout = timeoutId as unknown as number;
        });
      }
    }
  }

  async stopPolling() {
    this.pollData = false;
    if (this.backoffTimeout !== null) {
      clearTimeout(this.backoffTimeout);
      this.backoffTimeout = null;
    }
    if (this.pollPromise) {
      await this.pollPromise;
    }
  }

  async reconnect() {
    console.log('[Goggles] Manual reconnect requested');
    await this.stopPolling();
    this.handleConnectionLost();
  }

  async disconnect() {
    console.log('[Goggles] Disconnecting...');
    await this.stopPolling();
    if (this.device.opened) {
      console.log('[Goggles] Closing device');
      await this.device.close();
    }
    console.log('[Goggles] Disconnected');
  }

  async sendRawData(buffer: Uint8Array): Promise<USBOutTransferResult> {
    // Cast to `BufferSource` to satisfy DOM typings (ArrayBuffer vs SharedArrayBuffer mismatch)
    return this.device.transferOut(ENDPOINT_OUT, buffer as unknown as BufferSource);
  }
}