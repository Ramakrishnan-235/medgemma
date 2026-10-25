const http = require('http');

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedGemma Clinical Intelligence Workspace</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f2937;
      --text: #f9fafb;
      --muted: #9ca3af;
      --primary: #3b82f6;
      --accent: #10b981;
    }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-weight: 700;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text);
    }
    .badge {
      font-size: 0.75rem;
      background: rgba(59, 130, 246, 0.15);
      color: var(--primary);
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      font-weight: 600;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    main {
      flex: 1;
      max-width: 960px;
      margin: 2.5rem auto;
      padding: 0 1.5rem;
      width: 100%;
      box-sizing: border-box;
    }
    .hero {
      margin-bottom: 2rem;
    }
    .hero h1 {
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .hero p {
      color: var(--muted);
      font-size: 1.125rem;
      line-height: 1.6;
      margin: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
      margin-top: 2rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .card h3 {
      margin-top: 0;
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
    }
    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      margin-right: 0.5rem;
    }
    code {
      background: #1f2937;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>MedGemma</span>
      <span class="badge">1.5 4B NF4</span>
    </div>
    <div style="font-size: 0.875rem; color: var(--muted);">
      <span class="status-dot"></span>Workspace Online
    </div>
  </header>
  <main>
    <div class="hero">
      <h1>Clinical Intelligence & Multimodal Workspace</h1>
      <p>Local offline medical inference powered by MedGemma 1.5 4B with 4-bit NF4 quantization on NVIDIA CUDA.</p>
    </div>
    <div class="grid">
      <div class="card">
        <h3>FastAPI Core Backend</h3>
        <p style="color: var(--muted); font-size: 0.9rem;">Reverse-proxied under <code>/api/*</code>. Interactive docs at <code>/api/docs</code>.</p>
      </div>
      <div class="card">
        <h3>GPU Inference Service</h3>
        <p style="color: var(--muted); font-size: 0.9rem;">Runs local 4-bit NF4 tensor execution with SDPA and CPU offload budgets.</p>
      </div>
      <div class="card">
        <h3>Postgres pgvector & Redis</h3>
        <p style="color: var(--muted); font-size: 0.9rem;">Case evidence chunks with 384-dim E5 cosine vectors & Celery outbox relay.</p>
      </div>
    </div>
  </main>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'medgemma-web' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(htmlContent);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MedGemma Web Service listening on http://0.0.0.0:${PORT}`);
});
