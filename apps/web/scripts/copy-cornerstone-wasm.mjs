import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, "../public/assets/cs-wasm");

fs.mkdirSync(targetDir, { recursive: true });

const candidateCodecDirs = [
  path.resolve(__dirname, "../node_modules/@cornerstonejs/dicom-image-loader/dist/dynamic-import"),
  path.resolve(__dirname, "../node_modules/@cornerstonejs/codec-libjpeg-turbo-8bit/dist"),
  path.resolve(__dirname, "../node_modules/@cornerstonejs/codec-openjpeg/dist"),
];

let copiedCount = 0;
for (const srcDir of candidateCodecDirs) {
  if (!fs.existsSync(srcDir)) continue;
  for (const entry of fs.readdirSync(srcDir)) {
    if (entry.endsWith(".wasm") || entry.endsWith(".js")) {
      fs.copyFileSync(path.join(srcDir, entry), path.join(targetDir, entry));
      copiedCount += 1;
    }
  }
}

console.log(`[copy-cornerstone-wasm] Staged ${copiedCount} codec files into public/assets/cs-wasm`);

