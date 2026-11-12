// Uses a tiny ONNX model with random weights (server/test/fixtures) that has the
// same inputs and outputs as the real exported MobileNetV2. It checks the
// pipeline, not accuracy.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

process.env.JS_MODEL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const { analyzer, loadAnalyzer } = await import("../lib/analyzer.mjs");

function photo(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = (i * 37) % 255;
    data[i * 4 + 1] = (i * 91) % 255;
    data[i * 4 + 2] = (i * 13) % 255;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

test("ONNX model loads through WebAssembly and analyses a photo", async () => {
  assert.equal(await loadAnalyzer(), true);
  const result = await analyzer.analyze(photo(640, 480));
  assert.ok(result.confidence > 0 && result.confidence <= 1);
  assert.equal(typeof result.abstained, "boolean");
  assert.ok(result.abstained ? result.prediction === "UNCERTAIN" : ["diabetic", "pressure", "surgical", "venous"].includes(result.prediction));
  assert.equal(result.heatmap.width, 640);
  assert.equal(result.heatmap.height, 480);
});

test("model info is reported for the admin console", () => {
  const info = analyzer.info();
  assert.equal(info.loaded, true);
  assert.deepEqual(info.classes, ["diabetic", "pressure", "surgical", "venous"]);
  assert.equal(info.tau, 0.39);
});
