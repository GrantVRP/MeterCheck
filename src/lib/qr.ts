// Reading codes from the camera, in the browser only.
// Uses the browser's own BarcodeDetector where it has one (Chrome on Android),
// and jsQR everywhere else (iPhone, desktop). jsQR is only downloaded if needed.

export interface QrReader {
  kind: "native" | "jsqr";
  /** The text in the code, or null if there's no code in this frame. */
  read(video: HTMLVideoElement): Promise<string | null>;
}

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface NativeDetectorClass {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

async function nativeReader(): Promise<QrReader | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const formats = (await Detector.getSupportedFormats?.()) ?? [];
    if (!formats.includes("qr_code")) return null;
    const detector = new Detector({ formats: ["qr_code"] });
    return {
      kind: "native",
      async read(video) {
        const codes = await detector.detect(video);
        return codes.find((c) => c.rawValue)?.rawValue ?? null;
      },
    };
  } catch {
    return null;
  }
}

/** Biggest side of the square jsQR looks at. Smaller is faster; 640 still reads codes from arm's length. */
const JSQR_SIZE = 640;

async function jsqrReader(): Promise<QrReader> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return {
    kind: "jsqr",
    async read(video) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!ctx || !w || !h) return null;
      // Only look at the middle square of the picture, where the guide is.
      const side = Math.min(w, h);
      const size = Math.min(side, JSQR_SIZE);
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      return jsQR(data, size, size, { inversionAttempts: "dontInvert" })?.data || null;
    },
  };
}

export async function createQrReader(): Promise<QrReader> {
  return (await nativeReader()) ?? (await jsqrReader());
}

/**
 * A JPEG of the current camera picture, for the sticker check.
 * Shrunk to at most 1024 px so it's about 150 KB.
 */
export function grabFrame(video: HTMLVideoElement, maxSide = 1024, quality = 0.7): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

/** The back camera, asked for at a size that's sharp enough but not slow. */
export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
}

export function canUseCamera(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}
