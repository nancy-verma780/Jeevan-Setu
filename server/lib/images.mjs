/**
 * Image quality gate (section IV-C of the paper), written in plain JavaScript.
 * Blur is the variance of the Laplacian (Eq. 1) on a copy whose long side is
 * 512 px; exposure is the mean grey level on 0-255.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { config } from "./config.mjs";
import { HttpError, invalid, notFound } from "./http.mjs";

export const RETAKE_MESSAGES = {
  too_dark: "The photo is too dark. Move to better light and take it again.",
  too_bright: "The photo is too bright. Avoid direct sun or flash and take it again.",
  blurred: "The photo is blurred. Hold the phone still and take it again.",
};

/** Checks the real file content, not its name or declared type. Returns RGBA pixels. */
export function decodeImage(buffer) {
  if (buffer.length > config.imageMaxBytes) throw invalid("The photo is larger than 5 MB. Take a new one or send a smaller copy.", "too_large");
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const looksLikeImage = isJpeg || isPng || buffer.subarray(0, 3).toString() === "GIF" || buffer.subarray(0, 4).toString() === "RIFF";
  if (!isJpeg && !isPng) {
    if (looksLikeImage) throw new HttpError(415, "Only JPEG or PNG photos can be used.", "unsupported_type");
    throw invalid("This file could not be read as a photo. Take the photo again.", "corrupt");
  }
  try {
    if (isJpeg) {
      const img = jpeg.decode(buffer, { useTArray: true, maxResolutionInMP: config.imageMaxPixels / 1e6, maxMemoryUsageInMB: 512 });
      return { width: img.width, height: img.height, data: img.data };
    }
    const png = PNG.sync.read(buffer);
    if (png.width * png.height > config.imageMaxPixels) throw invalid("The photo has too many pixels. Send a smaller copy.", "too_many_pixels");
    return { width: png.width, height: png.height, data: png.data };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw invalid("This file could not be read as a photo. Take the photo again.", "corrupt");
  }
}

function greySample(image, longSide) {
  const scale = Math.min(1, longSide / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const grey = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(image.width - 1, Math.floor(x / scale));
      const i = (sy * image.width + sx) * 4;
      grey[y * w + x] = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
    }
  }
  return { w, h, grey };
}

export function checkQuality(image) {
  const { w, h, grey } = greySample(image, 512);
  let sum = 0;
  for (const v of grey) sum += v;
  const brightness = sum / grey.length;
  // Eq. (1): S = Var(I * K) with K = [0 1 0; 1 -4 1; 0 1 0]
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = grey[i - w] + grey[i + w] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      n += 1;
      const delta = lap - mean;
      mean += delta / n;
      m2 += delta * (lap - mean);
    }
  }
  const blur = n > 1 ? m2 / n : 0;
  const flags = [];
  if (brightness < config.minBrightness) flags.push("too_dark");
  else if (brightness > config.maxBrightness) flags.push("too_bright");
  if (blur < config.blurThreshold) flags.push("blurred");
  return { blur: Math.round(blur * 100) / 100, brightness: Math.round(brightness * 100) / 100, flags };
}

const imageDir = () => {
  const dir = path.join(config.dataDir, "images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Re-encodes to JPEG. No metadata is written, so GPS tags and EXIF are dropped. */
export function saveJpeg(image, key = `${randomUUID().replace(/-/g, "")}.jpg`) {
  const encoded = jpeg.encode({ data: image.data, width: image.width, height: image.height }, 90);
  fs.writeFileSync(path.join(imageDir(), key), encoded.data);
  return { key, size: encoded.data.length };
}

export function readImage(key) {
  if (!/^[0-9a-f]{32}(_cam)?\.jpg$/.test(key ?? "")) throw notFound("Image not found.");
  const file = path.join(imageDir(), key);
  if (!fs.existsSync(file)) throw notFound("Image not found.");
  return fs.readFileSync(file);
}

export const heatmapKeyFor = (photoKey) => photoKey.replace(".jpg", "_cam.jpg");

export function imageOut(record) {
  return {
    id: record.id,
    created_at: record.created_at,
    width: record.width,
    height: record.height,
    size_bytes: record.size_bytes,
    analysis: {
      analyzer: record.analyzer_name,
      version: record.analyzer_version,
      prediction: record.prediction,
      confidence: record.confidence,
      abstained: record.abstained,
      has_heatmap: Boolean(record.heatmap_key),
      notice: "Preliminary, not a diagnosis",
    },
  };
}
