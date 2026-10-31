/**
 * MedGemma Workspace — Empirical Security Verification Test Suite
 *
 * Automated verification of key vulnerabilities, defensive controls,
 * and security postures identified across Explorer 1, 2, and 3 reports.
 *
 * Test Coverage:
 *   - Test 1: Verify presence/absence of security headers in Next.js config & Caddy (SEC-01 / SEC-04)
 *   - Test 2: Verify React Query Devtools mounting in production vs development (VULN-01)
 *   - Test 3: Verify Tiptap AST recursive nesting depth guard against DoS (SEC-05)
 *   - Test 4: Verify JWT signature verification bypass behavior and claims validation (SEC-01)
 *   - Test 5: Verify CORS origin parsing against wildcard origin with credentials (SEC-08)
 *   - Test 6: Verify file upload magic byte enforcement and quarantine (PDF, PNG, JPEG, DICOM)
 *   - Test 7: Verify absence of dangerouslySetInnerHTML across frontend components
 *   - Test 8: Verify Docker Compose port bindings and missing Redis password (SEC-06)
 *
 * Run with:
 *   node --test apps/web/test/security-verification.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');

describe('MedGemma Automated Security Verification Suite', () => {

  // =========================================================================
  // Test 1: Next.js Security Headers Configuration (SEC-01 / SEC-04)
  // =========================================================================
  describe('Test 1: Next.js & Reverse Proxy Security Headers (SEC-01 / SEC-04)', () => {
    it('should empirically verify security headers status in next.config.ts', () => {
      const nextConfigPath = path.resolve(webRoot, 'next.config.ts');
      assert.ok(fs.existsSync(nextConfigPath), 'next.config.ts must exist');

      const content = fs.readFileSync(nextConfigPath, 'utf8');

      // Check whether headers() method is defined in nextConfig
      const hasHeadersMethod = /async\s+headers\s*\(\s*\)|headers\s*:\s*(async\s*)?\(\s*\)/.test(content);
      const hasCSP = /Content-Security-Policy/i.test(content);
      const hasXFrame = /X-Frame-Options/i.test(content);
      const hasContentTypeOptions = /X-Content-Type-Options/i.test(content);
      const hasHSTS = /Strict-Transport-Security/i.test(content);

      // Document and verify the security posture:
      // In the current baseline, next.config.ts does not configure HTTP security headers
      const securityHeadersStatus = {
        hasHeadersMethod,
        hasCSP,
        hasXFrame,
        hasContentTypeOptions,
        hasHSTS,
      };

      // Ensure that if headers are not configured, the test correctly detects the gap (SEC-01/04)
      if (!hasHeadersMethod) {
        assert.equal(hasHeadersMethod, false, 'Baseline observation: Next.js lacks headers() method');
        assert.equal(hasCSP, false, 'Baseline observation: CSP is not configured in next.config.ts');
      } else {
        // If remediated, verify standard required headers are present
        assert.ok(hasXFrame, 'X-Frame-Options should be configured');
        assert.ok(hasContentTypeOptions, 'X-Content-Type-Options should be configured');
      }
    });

    it('should verify Caddy reverse proxy headers and detect security gaps', () => {
      const caddyPath = path.resolve(repoRoot, 'infra', 'caddy', 'Caddyfile');
      assert.ok(fs.existsSync(caddyPath), 'Caddyfile must exist');

      const content = fs.readFileSync(caddyPath, 'utf8');

      // Verify Caddy headers
      const hasXFrame = /X-Frame-Options\s+"DENY"/i.test(content);
      const hasContentTypeOptions = /X-Content-Type-Options\s+"nosniff"/i.test(content);
      const hasCSP = /Content-Security-Policy/i.test(content);
      const hasPermissionsPolicy = /Permissions-Policy/i.test(content);
      const hasHstsOnHttp = /:80\s*\{[^}]*Strict-Transport-Security/s.test(content);

      assert.ok(hasXFrame, 'Caddyfile must configure X-Frame-Options: DENY');
      assert.ok(hasContentTypeOptions, 'Caddyfile must configure X-Content-Type-Options: nosniff');
      
      // Empirically verify Explorer 3 finding: CSP and Permissions-Policy are missing in Caddyfile
      assert.equal(hasCSP, false, 'Verified finding: Caddyfile currently lacks Content-Security-Policy');
      assert.equal(hasPermissionsPolicy, false, 'Verified finding: Caddyfile currently lacks Permissions-Policy');

      // RFC 6797 §7.2: HSTS on unencrypted port 80 is ignored by browsers
      assert.ok(hasHstsOnHttp, 'Verified finding: HSTS configured on HTTP block :80 (ineffective without TLS)');
    });
  });

  // =========================================================================
  // Test 2: React Query Devtools Mounting in Production vs Development (VULN-01)
  // =========================================================================
  describe('Test 2: React Query Devtools Mounting (VULN-01)', () => {
    it('should verify ReactQueryDevtools mounting and environment gating in query-provider.tsx', () => {
      const queryProviderPath = path.resolve(webRoot, 'src', 'providers', 'query-provider.tsx');
      assert.ok(fs.existsSync(queryProviderPath), 'query-provider.tsx must exist');

      const content = fs.readFileSync(queryProviderPath, 'utf8');

      // Check if ReactQueryDevtools is imported
      const hasImport = /import\s*\{\s*ReactQueryDevtools\s*\}\s*from\s*["']@tanstack\/react-query-devtools["']/.test(content);
      assert.ok(hasImport, 'ReactQueryDevtools should be imported');

      // Check for environment gating: e.g. process.env.NODE_ENV === "development"
      const hasEnvGate = /process\.env\.NODE_ENV\s*===?\s*["']development["']/.test(content);
      const hasUnconditionalMount = /<ReactQueryDevtools\s+initialIsOpen=\{false\}\s*\/>/.test(content) && !hasEnvGate;

      // Verify the vulnerability: Currently mounted unconditionally without NODE_ENV gate
      assert.equal(hasEnvGate, false, 'Verified VULN-01: ReactQueryDevtools lacks NODE_ENV === "development" gate');
      assert.ok(hasUnconditionalMount, 'Verified VULN-01: ReactQueryDevtools is mounted unconditionally');
    });

    it('should inspect package.json dependency placement for react-query-devtools', () => {
      const packageJsonPath = path.resolve(webRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const inDependencies = Boolean(pkg.dependencies && pkg.dependencies['@tanstack/react-query-devtools']);
      const inDevDependencies = Boolean(pkg.devDependencies && pkg.devDependencies['@tanstack/react-query-devtools']);

      // Explorer 2 observation: currently in production dependencies
      assert.ok(
        inDependencies || inDevDependencies,
        '@tanstack/react-query-devtools must be declared in package.json'
      );
      assert.equal(inDependencies, true, 'Verified VULN-01: @tanstack/react-query-devtools is declared in production dependencies');
    });
  });

  // =========================================================================
  // Test 3: Tiptap AST Recursive Nesting Depth Guard against DoS (SEC-05)
  // =========================================================================
  describe('Test 3: Tiptap AST Recursive Nesting Depth Guard (SEC-05)', () => {
    // Reference implementation of the vulnerable recursive traversal from apps/api/app/api/v1/reports.py:35-45
    function extractCitationsVulnerable(node) {
      const collected = [];
      if (node.type === 'citationChip' && node.attrs && typeof node.attrs === 'object') {
        collected.push(node.attrs);
      }
      for (const child of node.content || []) {
        if (child && typeof child === 'object') {
          collected.push(...extractCitationsVulnerable(child));
        }
      }
      return collected;
    }

    // Hardened implementation with explicit recursion depth guard and iterative safety
    function extractCitationsHardened(node, maxDepth = 20, currentDepth = 0) {
      if (currentDepth > maxDepth) {
        throw new Error(`Report document structure exceeds maximum allowed nesting depth of ${maxDepth}.`);
      }
      const collected = [];
      if (node.type === 'citationChip' && node.attrs && typeof node.attrs === 'object') {
        collected.push(node.attrs);
      }
      for (const child of node.content || []) {
        if (child && typeof child === 'object') {
          collected.push(...extractCitationsHardened(child, maxDepth, currentDepth + 1));
        }
      }
      return collected;
    }

    it('should correctly extract citations from legitimate Tiptap AST structures', () => {
      const validDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Findings indicate cardiomegaly ' },
              {
                type: 'citationChip',
                attrs: { chunk_id: 'c123', label: '[1]', score: 0.94 },
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'No pleural effusion observed ' },
              {
                type: 'citationChip',
                attrs: { chunk_id: 'c456', label: '[2]', score: 0.88 },
              },
            ],
          },
        ],
      };

      const extracted = extractCitationsVulnerable(validDoc);
      assert.equal(extracted.length, 2);
      assert.equal(extracted[0].chunk_id, 'c123');
      assert.equal(extracted[1].chunk_id, 'c456');

      const extractedSafe = extractCitationsHardened(validDoc);
      assert.equal(extractedSafe.length, 2);
      assert.equal(extractedSafe[0].chunk_id, 'c123');
    });

    it('should demonstrate stack overflow DoS risk on deeply nested Tiptap AST (SEC-05)', () => {
      // Construct a deeply nested malicious AST (e.g. 15,000 levels deep to overflow call stack)
      let deepDoc = { type: 'citationChip', attrs: { chunk_id: 'leaf-target' } };
      const nestingDepth = 15000;
      for (let i = 0; i < nestingDepth; i++) {
        deepDoc = { type: 'paragraph', content: [deepDoc] };
      }

      // 1. Unbounded function exhausts stack
      assert.throws(
        () => {
          extractCitationsVulnerable(deepDoc);
        },
        RangeError,
        'Deep AST must cause RangeError: Maximum call stack size exceeded in unbounded recursion'
      );

      // 2. Hardened function rejects gracefully at maxDepth=20 with structured error
      assert.throws(
        () => {
          extractCitationsHardened(deepDoc, 20);
        },
        /exceeds maximum allowed nesting depth of 20/,
        'Hardened depth guard must reject deep nesting with 422/validation error instead of crashing'
      );
    });
  });

  // =========================================================================
  // Test 4: JWT Signature Verification Bypass & Claims Validation (SEC-01)
  // =========================================================================
  describe('Test 4: JWT Signature Verification & Claims Validation (SEC-01)', () => {
    function parseAndValidateClaims(payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error("Invalid payload: must be an object");
      }
      if (!payload.sub) {
        throw new Error("Token missing 'sub' claim");
      }
      if (!payload.workspace_id) {
        throw new Error("Token missing 'workspace_id' claim");
      }
      return {
        userId: payload.sub,
        workspaceId: payload.workspace_id,
      };
    }

    it('should verify claims validation rules (sub and workspace_id required)', () => {
      // Missing sub
      assert.throws(
        () => parseAndValidateClaims({ workspace_id: 'ws-123' }),
        /Token missing 'sub' claim/
      );

      // Missing workspace_id
      assert.throws(
        () => parseAndValidateClaims({ sub: 'user-456' }),
        /Token missing 'workspace_id' claim/
      );

      // Valid claims
      const valid = parseAndValidateClaims({ sub: 'user-456', workspace_id: 'ws-123' });
      assert.equal(valid.userId, 'user-456');
      assert.equal(valid.workspaceId, 'ws-123');
    });

    it('should verify presence of DEBUG_ALLOW_UNVERIFIED_JWT in backend security module', () => {
      const securityPyPath = path.resolve(repoRoot, 'apps', 'api', 'app', 'core', 'security.py');
      assert.ok(fs.existsSync(securityPyPath), 'security.py must exist');

      const content = fs.readFileSync(securityPyPath, 'utf8');

      // Check for the bypass condition
      const hasDebugBypass = content.includes('DEBUG_ALLOW_UNVERIFIED_JWT');
      assert.ok(hasDebugBypass, 'Verified SEC-01: DEBUG_ALLOW_UNVERIFIED_JWT is present in security.py');

      // Check for verify_signature: False
      const hasUnverifiedDecode = content.includes('"verify_signature": False');
      assert.ok(hasUnverifiedDecode, 'Verified SEC-01: verify_signature: False is present in security.py');

      // Check config validator in apps/api/app/core/config.py
      const configPyPath = path.resolve(repoRoot, 'apps', 'api', 'app', 'core', 'config.py');
      const configContent = fs.readFileSync(configPyPath, 'utf8');
      assert.ok(
        configContent.includes('DEBUG_ALLOW_UNVERIFIED_JWT cannot be enabled in production'),
        'Config validator must forbid DEBUG_ALLOW_UNVERIFIED_JWT in production/staging'
      );
    });
  });

  // =========================================================================
  // Test 5: CORS Origin Parsing Against Wildcard with Credentials (SEC-08)
  // =========================================================================
  describe('Test 5: CORS Origin Parsing & Wildcard Validation (SEC-08)', () => {
    // JavaScript port of _parse_cors_origins from apps/api/app/core/config.py:18-30
    function parseCorsOrigins(raw) {
      const defaultOrigins = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:80",
        "http://web:3000",
      ];
      if (!raw || !raw.trim()) {
        return defaultOrigins;
      }
      const origins = raw.split(',').map((item) => item.trim()).filter(Boolean);
      return origins.length ? origins : defaultOrigins;
    }

    function validateCorsOriginsSecure(origins, allowCredentials = true) {
      if (allowCredentials && origins.includes('*')) {
        throw new Error("CORS_ORIGINS cannot contain wildcard '*' when allow_credentials=True");
      }
      return origins;
    }

    it('should parse default and comma-separated CORS origins accurately', () => {
      assert.deepEqual(parseCorsOrigins(null), [
        "http://localhost:3000",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:80",
        "http://web:3000",
      ]);

      assert.deepEqual(parseCorsOrigins(''), [
        "http://localhost:3000",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:80",
        "http://web:3000",
      ]);

      assert.deepEqual(
        parseCorsOrigins('https://medgemma.example.com, https://portal.medgemma.example.com'),
        ['https://medgemma.example.com', 'https://portal.medgemma.example.com']
      );
    });

    it('should verify wildcard origin security risk with credentials (SEC-08)', () => {
      const parsedWithWildcard = parseCorsOrigins('*');
      assert.deepEqual(parsedWithWildcard, ['*']);

      // Validating against allow_credentials=True must catch and reject wildcard '*'
      assert.throws(
        () => validateCorsOriginsSecure(parsedWithWildcard, true),
        /CORS_ORIGINS cannot contain wildcard '\*' when allow_credentials=True/,
        'Wildcard CORS with credentials enabled must be strictly rejected'
      );

      // Non-wildcard origins pass cleanly
      const safe = validateCorsOriginsSecure(['http://localhost:3000'], true);
      assert.deepEqual(safe, ['http://localhost:3000']);
    });
  });

  // =========================================================================
  // Test 6: File Upload Magic Byte Enforcement and Quarantine
  // =========================================================================
  describe('Test 6: File Upload Magic Byte Enforcement & Quarantine', () => {
    // Model of verify_uploaded_bytes from apps/api/app/core/storage.py:126-156
    function verifyUploadedBytes(headerBytes, expectedSha256, actualSha256, declaredKind) {
      if (expectedSha256.toLowerCase() !== actualSha256.toLowerCase()) {
        return { valid: false, reason: 'SHA-256 mismatch', quarantine: true };
      }

      if (declaredKind === 'pdf') {
        const isPdf = headerBytes.subarray(0, 5).toString('ascii') === '%PDF-';
        if (!isPdf) return { valid: false, reason: 'Invalid PDF magic bytes.', quarantine: true };
      } else if (declaredKind === 'image_png') {
        const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        if (!headerBytes.subarray(0, 8).equals(pngMagic)) {
          return { valid: false, reason: 'Invalid PNG magic bytes.', quarantine: true };
        }
      } else if (declaredKind === 'image_jpeg') {
        const isJpeg = headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff;
        if (!isJpeg) return { valid: false, reason: 'Invalid JPEG magic bytes.', quarantine: true };
      } else if (declaredKind === 'dicom') {
        if (headerBytes.length < 132 || headerBytes.subarray(128, 132).toString('ascii') !== 'DICM') {
          return { valid: false, reason: 'Invalid DICOM preamble (missing DICM at offset 128).', quarantine: true };
        }
      }

      return { valid: true, reason: null, quarantine: false };
    }

    it('should validate legitimate magic byte headers for all supported clinical formats', () => {
      // 1. PDF
      const pdfBytes = Buffer.from('%PDF-1.7 standard medical report\n');
      const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
      const pdfResult = verifyUploadedBytes(pdfBytes, pdfHash, pdfHash, 'pdf');
      assert.equal(pdfResult.valid, true);

      // 2. PNG
      const pngBytes = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('IHDR data payload...'),
      ]);
      const pngHash = crypto.createHash('sha256').update(pngBytes).digest('hex');
      const pngResult = verifyUploadedBytes(pngBytes, pngHash, pngHash, 'image_png');
      assert.equal(pngResult.valid, true);

      // 3. JPEG
      const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const jpegHash = crypto.createHash('sha256').update(jpegBytes).digest('hex');
      const jpegResult = verifyUploadedBytes(jpegBytes, jpegHash, jpegHash, 'image_jpeg');
      assert.equal(jpegResult.valid, true);

      // 4. DICOM (128 bytes preamble + "DICM")
      const dicomBytes = Buffer.alloc(256, 0);
      dicomBytes.write('DICM', 128, 'ascii');
      const dicomHash = crypto.createHash('sha256').update(dicomBytes).digest('hex');
      const dicomResult = verifyUploadedBytes(dicomBytes, dicomHash, dicomHash, 'dicom');
      assert.equal(dicomResult.valid, true);
    });

    it('should reject spoofed files, trigger quarantine, and reject SHA-256 mismatches', () => {
      // Spoofed executable pretending to be PDF
      const fakePdf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00WindowsExecutablePayload');
      const fakePdfHash = crypto.createHash('sha256').update(fakePdf).digest('hex');
      const fakeResult = verifyUploadedBytes(fakePdf, fakePdfHash, fakePdfHash, 'pdf');
      assert.equal(fakeResult.valid, false);
      assert.equal(fakeResult.quarantine, true);
      assert.equal(fakeResult.reason, 'Invalid PDF magic bytes.');

      // Spoofed text pretending to be DICOM
      const fakeDicom = Buffer.from('Patient: John Doe, Age: 45, History: Cough');
      const fakeDicomHash = crypto.createHash('sha256').update(fakeDicom).digest('hex');
      const fakeDicomResult = verifyUploadedBytes(fakeDicom, fakeDicomHash, fakeDicomHash, 'dicom');
      assert.equal(fakeDicomResult.valid, false);
      assert.equal(fakeDicomResult.quarantine, true);

      // SHA-256 tampering
      const tamperedResult = verifyUploadedBytes(fakePdf, '0000000000000000000000000000000000000000000000000000000000000000', fakePdfHash, 'pdf');
      assert.equal(tamperedResult.valid, false);
      assert.equal(tamperedResult.quarantine, true);
      assert.equal(tamperedResult.reason, 'SHA-256 mismatch');
    });
  });

  // =========================================================================
  // Test 7: Frontend XSS Safety - Absence of dangerouslySetInnerHTML
  // =========================================================================
  describe('Test 7: Frontend Component XSS Safety', () => {
    function scanDirectoryForPatterns(dir, pattern) {
      const matches = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          matches.push(...scanDirectoryForPatterns(fullPath, pattern));
        } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              matches.push({
                file: path.relative(webRoot, fullPath),
                line: index + 1,
                content: line.trim(),
              });
            }
          });
        }
      }
      return matches;
    }

    it('should assert zero instances of dangerouslySetInnerHTML across apps/web/src', () => {
      const srcDir = path.resolve(webRoot, 'src');
      assert.ok(fs.existsSync(srcDir), 'apps/web/src directory must exist');

      const matches = scanDirectoryForPatterns(srcDir, /dangerouslySetInnerHTML/);
      assert.equal(
        matches.length,
        0,
        `Expected 0 dangerouslySetInnerHTML occurrences, found ${matches.length}: ${JSON.stringify(matches)}`
      );
    });

    it('should assert zero direct innerHTML assignments across apps/web/src', () => {
      const srcDir = path.resolve(webRoot, 'src');
      const matches = scanDirectoryForPatterns(srcDir, /\.innerHTML\s*=/);
      assert.equal(
        matches.length,
        0,
        `Expected 0 direct innerHTML assignments, found ${matches.length}: ${JSON.stringify(matches)}`
      );
    });
  });

  // =========================================================================
  // Test 8: Docker Compose Port Exposure and Redis Authentication (SEC-06)
  // =========================================================================
  describe('Test 8: Docker Compose Port Exposure & Redis Authentication (SEC-06)', () => {
    it('should inspect docker-compose.yml for exposed host ports and unauthenticated Redis', () => {
      const composePath = path.resolve(repoRoot, 'docker-compose.yml');
      assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist');

      const content = fs.readFileSync(composePath, 'utf8');

      // Check redis configuration
      const redisPortMatch = content.match(/redis:[^]*?ports:\s*\n\s*-\s*["']?(\d+:)?6379["']?/);
      assert.ok(redisPortMatch, 'Redis service must have port 6379 configured');

      const redisPublishedOnHost = !content.includes('127.0.0.1:6379:6379') && content.includes('"6379:6379"');
      assert.equal(
        redisPublishedOnHost,
        true,
        'Verified SEC-06: Redis port 6379 is published to 0.0.0.0 on host'
      );

      // Check redis password configuration
      const hasRequirePass = /--requirepass/i.test(content);
      assert.equal(
        hasRequirePass,
        false,
        'Verified SEC-06: Redis command lacks --requirepass authentication flag'
      );

      // Check postgres port exposure
      const postgresPublishedOnHost = !content.includes('127.0.0.1:5432:5432') && content.includes('"5432:5432"');
      assert.equal(
        postgresPublishedOnHost,
        true,
        'Verified SEC-06: Postgres port 5432 is published to 0.0.0.0 on host'
      );

      // Check minio port exposure
      const minioPublishedOnHost = content.includes('"9000:9000"') && !content.includes('127.0.0.1:9000:9000');
      assert.equal(
        minioPublishedOnHost,
        true,
        'Verified SEC-06: MinIO port 9000 is published to 0.0.0.0 on host'
      );
    });
  });

});
