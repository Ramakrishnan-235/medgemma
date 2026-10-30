#!/usr/bin/env node
/**
 * MedGemma Workspace — Root E2E Test Runner
 *
 * Runs the complete Tier 1-4 End-to-End test suite across web and clinical modules.
 *
 * Usage:
 *   node test-runner.mjs
 *   node test-runner.mjs --tier=1
 *   node test-runner.mjs --tier=2
 *   node test-runner.mjs --tier=3
 *   node test-runner.mjs --tier=4
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, 'apps', 'web');
const scriptPath = path.resolve(webDir, 'scripts', 'e2e-test.mjs');

console.log(`[MedGemma Test Runner] Launching E2E test suite from: ${webDir}`);

const args = [scriptPath, ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  cwd: webDir,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
