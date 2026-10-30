#!/usr/bin/env node
/**
 * MedGemma E2E Test Suite Orchestrator & Runner
 * 
 * Executes all 4 E2E testing tiers:
 *   - Tier 1: Feature Coverage (15 screens, monochrome tokens, shell layout, Zustand store bindings)
 *   - Tier 2: Boundary & Corner Cases (empty datasets, invalid inputs, edge screen breakpoints, clamping, mismatch)
 *   - Tier 3: Cross-Feature Interactions (case selection propagation, citation grounding, report syncing, mark highlighting)
 *   - Tier 4: Real-World Clinical Workflows (complete doctor journeys, emergency intake, QA reconciliation)
 * 
 * Usage:
 *   node scripts/e2e-test.mjs [--tier=1|2|3|4]
 *   npm run test:e2e
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, '..');

const TIERS = [
  {
    tier: 1,
    name: 'Tier 1: Feature Coverage',
    file: 'test/tier1-features.test.mjs',
    desc: 'Validates all 15 screens, #09090b/#18181b tokens, shell layout, routing & Zustand bindings',
  },
  {
    tier: 2,
    name: 'Tier 2: Boundary & Corner Cases',
    file: 'test/tier2-boundary-corner.test.mjs',
    desc: 'Validates empty data, invalid inputs, clamping, projection mismatch & responsive breakpoints',
  },
  {
    tier: 3,
    name: 'Tier 3: Cross-Feature Interactions',
    file: 'test/tier3-cross-feature.test.mjs',
    desc: 'Validates cross-module workflows (case selection, citation grounding, report review, marks)',
  },
  {
    tier: 4,
    name: 'Tier 4: Real-World Clinical Workflows',
    file: 'test/tier4-clinical-workflows.test.mjs',
    desc: 'Validates end-to-end multi-phase radiologist workflow and emergency clinical pathways',
  },
];

// CLI filter: e.g. --tier=1 or --tier 2
const tierArgMatch = process.argv.find((a) => a.startsWith('--tier='));
const targetTier = tierArgMatch ? parseInt(tierArgMatch.split('=')[1], 10) : null;

const tiersToRun = targetTier
  ? TIERS.filter((t) => t.tier === targetTier)
  : TIERS;

if (tiersToRun.length === 0) {
  console.error(`Unknown tier specified: ${targetTier}. Valid options are 1, 2, 3, or 4.`);
  process.exit(1);
}

console.log('='.repeat(78));
console.log('  MEDGEMMA CLINICAL WORKSPACE — END-TO-END AUTOMATED TEST RUNNER');
console.log('='.repeat(78));
console.log(`Execution Mode: ${targetTier ? `Single Tier (${targetTier})` : 'All Tiers (1 - 4)'}`);
console.log(`Working Directory: ${WEB_ROOT}`);
console.log(`Node Runtime: ${process.version}`);
console.log('='.repeat(78));

function runTier(tierConfig) {
  return new Promise((resolve) => {
    const fullPath = path.resolve(WEB_ROOT, tierConfig.file);
    const startTime = Date.now();
    console.log(`\n[RUNNING] ${tierConfig.name}`);
    console.log(`          File: ${tierConfig.file}`);
    console.log(`          Desc: ${tierConfig.desc}`);
    console.log('-'.repeat(78));

    const child = spawn(process.execPath, ['--test', fullPath], {
      cwd: WEB_ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      const chunk = d.toString();
      stdout += chunk;
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (d) => {
      const chunk = d.toString();
      stderr += chunk;
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Parse Node test runner summary
      const passMatch = stdout.match(/ℹ pass (\d+)/);
      const failMatch = stdout.match(/ℹ fail (\d+)/);
      const totalMatch = stdout.match(/ℹ tests (\d+)/);

      const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
      const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
      const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

      resolve({
        tier: tierConfig.tier,
        name: tierConfig.name,
        code,
        elapsed,
        passed,
        failed,
        total,
      });
    });
  });
}

async function main() {
  const overallStart = Date.now();
  const results = [];

  for (const tierConfig of tiersToRun) {
    const res = await runTier(tierConfig);
    results.push(res);
  }

  const overallElapsed = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(78));
  console.log('  TEST SUITE EXECUTION SUMMARY');
  console.log('='.repeat(78));

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let allSuccess = true;

  for (const r of results) {
    totalTests += r.total;
    totalPassed += r.passed;
    totalFailed += r.failed;
    if (r.code !== 0 || r.failed > 0) {
      allSuccess = false;
    }

    const statusBadge = r.code === 0 && r.failed === 0 ? '✔ PASS' : '✖ FAIL';
    console.log(
      `  ${statusBadge.padEnd(8)} | ${r.name.padEnd(38)} | ${String(r.passed).padStart(3)} / ${String(r.total).padEnd(3)} passed | ${r.elapsed}s`
    );
  }

  console.log('-'.repeat(78));
  console.log(
    `  TOTALS   | Total Tests: ${String(totalTests).padEnd(6)} | Passed: ${String(totalPassed).padEnd(6)} | Failed: ${String(totalFailed).padEnd(6)} | Time: ${overallElapsed}s`
  );
  console.log('='.repeat(78));

  if (allSuccess) {
    console.log('  OVERALL RESULT: SUCCESS (All tier suites passed with 100% assertions)\n');
    process.exit(0);
  } else {
    console.error('  OVERALL RESULT: FAILURE (One or more test suites failed)\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
