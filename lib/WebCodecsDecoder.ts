type RenderFrame = (frame: VideoFrame) => void;

type DecoderOptions = {
  renderFrame: RenderFrame;
  onError?: (error: string) => void;
  fps?: number;
  maxDecodeQueue?: number;
  debug?: boolean;
};

type DecoderStats = {
  decodedFrames: number;
  droppedFrames: number;
  lastFrameTime: number;
  decodeErrors: number;
  isConfigured: boolean;
  codec?: string;
  maxQueueDepth: number;
  currentQueueDepth: number;
};

const DEFAULT_FPS = 60;
const DEFAULT_MAX_DECODE_QUEUE = 20; // Increased for burst absorption
const DEFAULT_MAX_PENDING_SLICES = 100; // Increased for spike buffering
const QUEUE_DROP_THRESHOLD = 0.9; // Drop non-IDR when queue > 90%

function toHex(value: number) {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function buildAvcC(sps: Uint8Array, pps: Uint8Array) {
  const avcProfile = sps[1];
  const profileCompat = sps[2];
  const avcLevel = sps[3];
  const spsLength = sps.length;
  const ppsLength = pps.length;
  const size = 7 + 2 + spsLength + 1 + 2 + ppsLength;
  const data = new Uint8Array(size);
  let offset = 0;
  data[offset++] = 0x01; // configurationVersion
  data[offset++] = avcProfile;
  data[offset++] = profileCompat;
  data[offset++] = avcLevel;
  data[offset++] = 0xff; // lengthSizeMinusOne (4 bytes)
  data[offset++] = 0xe1; // numOfSequenceParameterSets (1)
  data[offset++] = (spsLength >> 8) & 0xff;
  data[offset++] = spsLength & 0xff;
  data.set(sps, offset);
  offset += spsLength;
  data[offset++] = 0x01; // numOfPictureParameterSets
  data[offset++] = (ppsLength >> 8) & 0xff;
  data[offset++] = ppsLength & 0xff;
  data.set(pps, offset);
  return data;
}

function parseAnnexBNalUnits(data: Uint8Array) {
  const nals: Uint8Array[] = [];
  const length = data.length;
  const startIndexes: { index: number; length: number }[] = [];

  for (let i = 0; i < length - 3; i += 1) {
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) {
      startIndexes.push({ index: i, length: 3 });
      i += 2;
      continue;
    }

    if (
      i < length - 4 &&
      data[i] === 0x00 &&
      data[i + 1] === 0x00 &&
      data[i + 2] === 0x00 &&
      data[i + 3] === 0x01
    ) {
      startIndexes.push({ index: i, length: 4 });
      i += 3;
    }
  }

  if (startIndexes.length === 0) {
    if (data.length > 0) {
      nals.push(data);
    }
    return nals;
  }

  for (let i = 0; i < startIndexes.length; i += 1) {
    const start = startIndexes[i];
    const nextStart = startIndexes[i + 1];
    const nalStart = start.index + start.length;
    const nalEnd = nextStart ? nextStart.index : length;
    if (nalEnd > nalStart) {
      nals.push(data.slice(nalStart, nalEnd));
    }
  }

  return nals;
}

function extractAnnexBNalUnits(buffer: Uint8Array) {
  const startIndexes: { index: number; length: number }[] = [];

  for (let i = 0; i < buffer.length - 3; i += 1) {
    if (buffer[i] === 0x00 && buffer[i + 1] === 0x00 && buffer[i + 2] === 0x01) {
      startIndexes.push({ index: i, length: 3 });
      i += 2;
      continue;
    }

    if (
      i < buffer.length - 4 &&
      buffer[i] === 0x00 &&
      buffer[i + 1] === 0x00 &&
      buffer[i + 2] === 0x00 &&
      buffer[i + 3] === 0x01
    ) {
      startIndexes.push({ index: i, length: 4 });
      i += 3;
    }
  }

  if (startIndexes.length === 0) {
    return { nals: [] as Uint8Array[], remainder: buffer as Uint8Array };
  }

  const nals: Uint8Array[] = [];
  for (let i = 0; i < startIndexes.length; i += 1) {
    const start = startIndexes[i];
    const nextStart = startIndexes[i + 1];
    const nalStart = start.index + start.length;
    const nalEnd = nextStart ? nextStart.index : buffer.length;
    if (nalEnd > nalStart) {
      nals.push(buffer.slice(nalStart, nalEnd));
    }
  }

  const lastStart = startIndexes[startIndexes.length - 1];
  const lastNalStart = lastStart.index + lastStart.length;
  if (lastNalStart >= buffer.length) {
    return { nals, remainder: new Uint8Array() as Uint8Array };
  }

  const remainder = buffer.slice(lastStart.index);
  if (nals.length > 0) {
    nals.pop();
  }

  return { nals, remainder: remainder as Uint8Array };
}

function concatBuffers(buffers: Uint8Array[]) {
  const size = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const buffer of buffers) {
    merged.set(buffer, offset);
    offset += buffer.length;
  }
  return merged;
}

function appendBuffer(existing: Uint8Array, appending: Uint8Array): Uint8Array {
  const combined = new Uint8Array(existing.length + appending.length);
  combined.set(existing);
  combined.set(appending, existing.length);
  return combined;
}

function extractAnnexBNalUnitsStreaming(buffer: Uint8Array, startOffset: number = 0) {
  const nals: Uint8Array[] = [];
  const length = buffer.length;
  let i = startOffset;
  let lastNalStart = startOffset;

  while (i < length - 3) {
    const isStart3 = buffer[i] === 0x00 && buffer[i + 1] === 0x00 && buffer[i + 2] === 0x01;
    const isStart4 = i < length - 4 && buffer[i] === 0x00 && buffer[i + 1] === 0x00 && buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01;

    if (isStart3 || isStart4) {
      const startCodeLen = isStart4 ? 4 : 3;
      if (i > lastNalStart) {
        // Extract NAL between last start code and this one
        if (i > lastNalStart + 3 || (i > lastNalStart + 4)) {
          // Skip the start code of the previous NAL
          const prevStartCodeLen = buffer[lastNalStart + 2] === 0x01 ? 3 : 4;
          nals.push(buffer.slice(lastNalStart + prevStartCodeLen, i));
        }
      }
      lastNalStart = i;
      i += startCodeLen;
      continue;
    }
    i++;
  }

  // Return nals and the position where we should trim the buffer from
  return { nals, trimOffset: lastNalStart };
}

function toLengthPrefixed(nal: Uint8Array) {
  const size = nal.length;
  const lengthPrefix = new Uint8Array(4);
  lengthPrefix[0] = (size >>> 24) & 0xff;
  lengthPrefix[1] = (size >>> 16) & 0xff;
  lengthPrefix[2] = (size >>> 8) & 0xff;
  lengthPrefix[3] = size & 0xff;
  return concatBuffers([lengthPrefix, nal]);
}

export default class H264WebCodecsDecoder {
  private decoder: VideoDecoder | null = null;
  private readonly renderFrame: RenderFrame;
  private readonly onError?: (error: string) => void;
  private readonly maxDecodeQueue: number;
  private readonly debug: boolean;
  private sps: Uint8Array | null = null;
  private pps: Uint8Array | null = null;
  private timestamp = 0;
  private frameDuration: number;
  private pendingBuffer: Uint8Array = new Uint8Array();
  private pendingSlices: { nal: Uint8Array; isIdr: boolean }[] = [];
  private maxPendingSlices = DEFAULT_MAX_PENDING_SLICES;
  private hasKeyframe = false;
  private configPromise: Promise<boolean> | null = null;
  private flushingPending = false;
  private lastQueueWarning = 0;
  private stats: DecoderStats = {
    decodedFrames: 0,
    droppedFrames: 0,
    lastFrameTime: 0,
    decodeErrors: 0,
    isConfigured: false,
    maxQueueDepth: 0,
    currentQueueDepth: 0,
  };

  constructor({ renderFrame, onError, fps = DEFAULT_FPS, maxDecodeQueue = DEFAULT_MAX_DECODE_QUEUE, debug = false }: DecoderOptions) {
    this.renderFrame = renderFrame;
    this.onError = onError;
    this.maxDecodeQueue = maxDecodeQueue;
    this.debug = debug;
    this.frameDuration = Math.round(1_000_000 / fps);

    if (typeof VideoDecoder !== 'undefined') {
      this.decoder = new VideoDecoder({
        output: (frame) => this.handleFrame(frame),
        error: (error) => this.handleDecoderError(error),
      });
    } else {
      this.handleDecoderError(new Error('WebCodecs VideoDecoder is not supported in this browser.'));
    }
  }

  getStats() {
    return { ...this.stats };
  }

  destroy() {
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
  }

  private handleFrame(frame: VideoFrame) {
    this.stats.decodedFrames += 1;
    this.stats.lastFrameTime = Date.now();
    const renderStart = performance.now();
    this.renderFrame(frame);
    const renderTime = performance.now() - renderStart;
    if (renderTime > 10) {
      console.warn(`[WebCodecs] Slow render: ${renderTime.toFixed(1)}ms`);
    }
  }

  private handleDecoderError(error: unknown) {
    this.stats.decodeErrors += 1;
    const message = error instanceof Error ? error.message : 'Decoder error occurred.';
    console.error(`[WebCodecs] Decoder error #${this.stats.decodeErrors}: ${message}`);
    this.hasKeyframe = false;
    if (this.onError) {
      this.onError(message);
    }
  }

  private async configureIfNeeded() {
    if (this.stats.isConfigured || !this.decoder || !this.sps || !this.pps) {
      return false;
    }

    const codec = `avc1.${toHex(this.sps[1])}${toHex(this.sps[2])}${toHex(this.sps[3])}`;
    const description = buildAvcC(this.sps, this.pps);
    const config: VideoDecoderConfig = {
      codec,
      description,
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true,
    };

    const support = await VideoDecoder.isConfigSupported(config);
    if (this.debug) {
      console.log('[WebCodecs] Config support', { codec, supported: support.supported, config });
    }
    if (!support.supported) {
      this.handleDecoderError(new Error(`Codec config not supported for ${codec}.`));
      return false;
    }

    this.decoder.configure(config);
    this.stats.isConfigured = true;
    this.stats.codec = codec;
    return true;
  }

  private async ensureConfigured() {
    if (this.stats.isConfigured) {
      return true;
    }
    if (!this.configPromise) {
      this.configPromise = this.configureIfNeeded().finally(() => {
        this.configPromise = null;
      });
    }
    return this.configPromise;
  }

  private enqueueSlice(nal: Uint8Array, isIdr: boolean) {
    this.pendingSlices.push({ nal, isIdr });
    if (this.pendingSlices.length > this.maxPendingSlices) {
      const dropped = this.pendingSlices.shift();
      if (dropped && !dropped.isIdr) {
        this.stats.droppedFrames += 1;
      }
    }
  }

  private flushPendingSlices() {
    if (!this.decoder || !this.stats.isConfigured || this.flushingPending) {
      return;
    }
    this.flushingPending = true;

    while (this.pendingSlices.length > 0) {
      const slice = this.pendingSlices.shift();
      if (!slice) {
        continue;
      }

      if (slice.isIdr) {
        this.hasKeyframe = true;
      }

      if (!this.hasKeyframe && !slice.isIdr) {
        this.stats.droppedFrames += 1;
        continue;
      }

      this.decodeSlice(slice.nal, slice.isIdr);
    }

    this.flushingPending = false;
  }

  private decodeSlice(nal: Uint8Array, isIdr: boolean) {
    if (!this.decoder) {
      return;
    }

    const queueSize = this.decoder.decodeQueueSize;
    this.stats.currentQueueDepth = queueSize;
    if (queueSize > this.stats.maxQueueDepth) {
      this.stats.maxQueueDepth = queueSize;
    }

    // Aggressive drop: if queue > 90%, drop all non-IDR frames
    const dropThreshold = this.maxDecodeQueue * QUEUE_DROP_THRESHOLD;
    if (queueSize > dropThreshold && !isIdr) {
      this.stats.droppedFrames += 1;
      const now = Date.now();
      if (now - this.lastQueueWarning > 2000) {
        this.lastQueueWarning = now;
        console.warn(`[WebCodecs] Queue saturation: ${queueSize}/${this.maxDecodeQueue}, dropping deltas. Decoded: ${this.stats.decodedFrames}, Dropped: ${this.stats.droppedFrames}`);
      }
      return;
    }

    // Hard limit: never queue beyond max
    if (queueSize >= this.maxDecodeQueue && !isIdr) {
      this.stats.droppedFrames += 1;
      return;
    }

    const accessUnitData = toLengthPrefixed(nal);

      const chunk = new EncodedVideoChunk({
      type: isIdr ? 'key' : 'delta',
      timestamp: this.timestamp,
      data: accessUnitData,
    });

    this.timestamp += this.frameDuration;
    this.decoder.decode(chunk);
  }

  push(data: Uint8Array) {
    if (!this.decoder) {
      return;
    }
    if (this.debug) {
      const header = Array.from(data.slice(0, 8)).map((value) => value.toString(16).padStart(2, '0')).join(' ');
      console.log(`[WebCodecs] Received ${data.length}B`, header);
    }

    const parseStart = performance.now();
    // Append incrementally instead of full re-concatenation
    this.pendingBuffer = appendBuffer(this.pendingBuffer, data);
    const { nals, remainder } = extractAnnexBNalUnits(this.pendingBuffer);
    this.pendingBuffer = remainder;
    const parseTime = performance.now() - parseStart;
    if (parseTime > 5) {
      console.warn(`[WebCodecs] Slow parse: ${parseTime.toFixed(1)}ms for ${nals.length} NALs, buffer size: ${this.pendingBuffer.length}`);
    }

    for (const nal of nals) {
      const nalType = nal[0] & 0x1f;
      if (this.debug) {
        console.log(`[WebCodecs] NAL type ${nalType}, size ${nal.length}`);
      }

      if (nalType === 7) {
        this.sps = nal;
        continue;
      }
      if (nalType === 8) {
        this.pps = nal;
        continue;
      }

      const hasIdr = nalType === 5;
      const isSlice = nalType === 1 || nalType === 5;
      if (!isSlice) {
        continue;
      }

      this.enqueueSlice(nal, hasIdr);
      void this.ensureConfigured().then((configured) => {
        if (!configured) {
          if (this.debug) {
            console.warn('[WebCodecs] Decoder not configured yet, buffering slice.');
          }
          return;
        }
        if (this.decoder?.state !== 'configured') {
          return;
        }
        this.flushPendingSlices();
      });
    }
  }
}
