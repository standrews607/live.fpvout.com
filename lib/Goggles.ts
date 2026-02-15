const ENDPOINT_OUT = 3;
const ENDPOINT_IN = 4;
const INITIAL_BUFFER_SIZE = 65536; // Start with 64KB, adapt based on frame sizes
const MAX_BUFFER_SIZE = 524288; // Max 512KB
const MIN_BUFFER_SIZE = 16384; // Min 16KB
export const VID = 0x2ca3;
export const PID = 0x001f;

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

  constructor(device: USBDevice) {
    this.device = device;
    this.setupDisconnectListener();
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

        const result = await this.device.transferIn(ENDPOINT_IN, this.dynamicBufferSize);

        if (result.data && this.onDataCallback !== null) {
          const frameSize = result.data.buffer.byteLength;
          this.updateDynamicBufferSize(frameSize);
          this.metrics.frameCount++;
          this.metrics.totalBytesReceived += frameSize;
          this.metrics.averageFrameSize =
            this.metrics.totalBytesReceived / this.metrics.frameCount;
          this.metrics.lastFrameTime = Date.now();
          this.metrics.consecutiveErrors = 0; // Reset on success
          this.retryDelay = 50; // Reset exponential backoff to initial value

          this.onDataCallback(result.data);
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