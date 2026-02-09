const ENDPOINT_OUT = 3;
const ENDPOINT_IN = 4;
const BUFFER_LENGTH = 200000;
export const VID = 0x2ca3;
export const PID = 0x001f;

interface DataCallback {
  (data: DataView): void;
}

interface ErrorCallback {
  (error: string): void;
}

export default class Goggles {
  private device: USBDevice;
  private onDataCallback: DataCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private pollData: boolean = false;

  constructor(device: USBDevice) {
    this.device = device;
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

  async connect() {
    if (!this.device.opened) {
      await this.device.open();
    }
    await this.device.claimInterface(3);
  }

  async requestVideo() {
    const writeResult = await this.sendRawData(new Uint8Array([0x52, 0x4d, 0x56, 0x54]));
    return writeResult.status === 'ok';
  }

  async startPolling() {
    this.pollData = true;
    while (this.pollData) {
      try {
        if (this.device.opened) {
          const result = await this.device.transferIn(ENDPOINT_IN, BUFFER_LENGTH);
          if (this.onDataCallback !== null && result.data) {
            this.onDataCallback(result.data);
          }
        }
      } catch (err) {
        this.pollData = false;
        if (this.onErrorCallback !== null) {
          const errorMessage = err instanceof Error ? err.message : 'Polling error occurred';
          this.onErrorCallback(errorMessage);
        }
      }
    }
  }

  async stopPolling() {
    this.pollData = false;
  }

  async disconnect() {
    await this.stopPolling();
    if (this.device.opened) {
      await this.device.close();
    }
  }

  async sendRawData(buffer: Uint8Array): Promise<USBOutTransferResult> {
    // Cast to `BufferSource` to satisfy DOM typings (ArrayBuffer vs SharedArrayBuffer mismatch)
    return this.device.transferOut(ENDPOINT_OUT, buffer as unknown as BufferSource);
  }
}