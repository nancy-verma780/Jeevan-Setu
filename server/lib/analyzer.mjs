/**
 * Wound-photo analyzer: MobileNetV2 exported to ONNX, run with ONNX Runtime's
 * WebAssembly build (no native add-ons). The model returns the class scores and
 * the last 7 x 7 x 1280 feature map. Because the head is global average pooling
 * followed by one linear layer, Grad-CAM for class c reduces to
 * ReLU(sum_k W[c][k] * A_k), computed here from the stored classifier weights.
 *
 * Output is informational only. Nothing here feeds priority or hospital ranking.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.mjs";

const MODEL_DIR = path.resolve(process.env.JS_MODEL_DIR ?? path.join(config.dataDir, "..", "models"));
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const UNCERTAIN = "UNCERTAIN";

let session = null;
let meta = null;
let loadError = null;

export async function loadAnalyzer() {
  const onnxFile = path.join(MODEL_DIR, "wound_model.onnx");
  const metaFile = path.join(MODEL_DIR, "wound_model.json");
  if (!fs.existsSync(onnxFile) || !fs.existsSync(metaFile)) {
    loadError = "No trained model installed";
    return false;
  }
  try {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    session = await ort.InferenceSession.create(fs.readFileSync(onnxFile));
    analyzer.ort = ort;
    analyzer.name = meta.name ?? "mobilenetv2_azh";
    analyzer.version = String(meta.version ?? "1");
    loadError = null;
    return true;
  } catch (error) {
    session = null;
    loadError = `Model could not be loaded: ${error.message}`;
    return false;
  }
}

/** Bilinear sample of an RGBA image at (x, y), returns [r, g, b] in 0..255. */
function sample(img, x, y) {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(y)));
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, x - x0));
  const fy = Math.min(1, Math.max(0, y - y0));
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = img.data[(y0 * img.width + x0) * 4 + c];
    const b = img.data[(y0 * img.width + x1) * 4 + c];
    const d = img.data[(y1 * img.width + x0) * 4 + c];
    const e = img.data[(y1 * img.width + x1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
  return out;
}

/** Resize the short side to 256, centre-crop 224 (same as training), as a CHW tensor. */
function preprocess(img, size) {
  const resize = Math.round((size * 256) / 224);
  const scale = resize / Math.min(img.width, img.height);
  const crop = size / scale; // crop side in original pixels
  const left = (img.width - crop) / 2;
  const top = (img.height - crop) / 2;
  const data = new Float32Array(3 * size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgb = sample(img, left + ((x + 0.5) * crop) / size - 0.5, top + ((y + 0.5) * crop) / size - 0.5);
      for (let c = 0; c < 3; c++) data[c * size * size + y * size + x] = (rgb[c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return { data, crop: { left, top, side: crop } };
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/** Class activation map for class c from features [K, h, w] and classifier weights. */
function classMap(features, dims, weights) {
  const [, k, h, w] = dims;
  const cam = new Float32Array(h * w);
  for (let ch = 0; ch < k; ch++) {
    const wk = weights[ch];
    if (!wk) continue;
    const base = ch * h * w;
    for (let i = 0; i < h * w; i++) cam[i] += wk * features[base + i];
  }
  let max = 0;
  for (let i = 0; i < cam.length; i++) {
    cam[i] = Math.max(0, cam[i]);
    max = Math.max(max, cam[i]);
  }
  if (max > 0) for (let i = 0; i < cam.length; i++) cam[i] /= max;
  return { cam, h, w };
}

/** Warm overlay where the model looked, on a copy at most 640 px on the long side. */
function overlay(img, { cam, h, w }, crop) {
  const scale = Math.min(1, 640 / Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width * scale));
  const H = Math.max(1, Math.round(img.height * scale));
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ox = x / scale;
      const oy = y / scale;
      const rgb = sample(img, ox, oy);
      // Position inside the analysed centre crop, mapped onto the h x w grid.
      const u = ((ox - crop.left) / crop.side) * w - 0.5;
      const v = ((oy - crop.top) / crop.side) * h - 0.5;
      let weight = 0;
      if (u >= -0.5 && v >= -0.5 && u <= w - 0.5 && v <= h - 0.5) {
        const u0 = Math.max(0, Math.min(w - 1, Math.floor(u)));
        const v0 = Math.max(0, Math.min(h - 1, Math.floor(v)));
        const u1 = Math.min(w - 1, u0 + 1);
        const v1 = Math.min(h - 1, v0 + 1);
        const fu = Math.min(1, Math.max(0, u - u0));
        const fv = Math.min(1, Math.max(0, v - v0));
        weight = (cam[v0 * w + u0] * (1 - fu) + cam[v0 * w + u1] * fu) * (1 - fv) + (cam[v1 * w + u0] * (1 - fu) + cam[v1 * w + u1] * fu) * fv;
      }
      const a = 0.55 * weight;
      const i = (y * W + x) * 4;
      data[i] = rgb[0] * (1 - a) + 220 * a;
      data[i + 1] = rgb[1] * (1 - a) + 180 * weight * a;
      data[i + 2] = rgb[2] * (1 - a) + 40 * a;
      data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

export const analyzer = {
  name: "none",
  version: "0",
  ort: null,
  get ready() {
    return Boolean(session);
  },
  info() {
    return {
      loaded: Boolean(session),
      message: loadError,
      name: session ? this.name : null,
      classes: meta?.classes ?? null,
      tau: meta?.tau ?? null,
      metrics: meta?.metrics ?? null,
      trained_at: meta?.trained_at ?? null,
    };
  },
  async analyze(img) {
    if (!session) return { prediction: null, confidence: null, abstained: null, heatmap: null };
    const size = meta.input_size ?? 224;
    const { data, crop } = preprocess(img, size);
    const input = new this.ort.Tensor("float32", data, [1, 3, size, size]);
    const out = await session.run({ [session.inputNames[0]]: input });
    const logits = Array.from(out.logits.data);
    const probs = softmax(logits);
    let top = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i;
    const confidence = Math.round(probs[top] * 10000) / 10000;
    // Eq. (4): answer only when the top probability reaches tau.
    const abstained = confidence < meta.tau;
    const heat = classMap(out.features.data, out.features.dims, meta.classifier_weight[top]);
    return {
      prediction: abstained ? UNCERTAIN : meta.classes[top],
      confidence,
      abstained,
      heatmap: overlay(img, heat, crop),
    };
  },
};
