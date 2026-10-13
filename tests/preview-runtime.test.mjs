import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tmp = 'tests/.tmp-preview-runtime.cjs';

test('dev and preview scripts target full server', async () => {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  assert.ok(pkg.scripts.dev.includes('server.ts'), 'dev script must execute server.ts');
  assert.ok(pkg.scripts.preview.includes('server.ts'), 'preview script must execute server.ts');
});

test('serverApp handles /api/health with status ok JSON', async () => {
  const out = await build({
    entryPoints: ['serverApp.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
  });
  await fs.writeFile(tmp, out.outputFiles[0].text);
  let server;
  try {
    const { app } = require(process.cwd() + '/' + tmp);
    server = app.listen(0);
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));
    const data = await res.json();
    assert.equal(data.status, 'ok');
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await fs.unlink(tmp).catch(() => {});
  }
});

test('serverApp handles /api/financial-data without returning HTML', async () => {
  const out = await build({
    entryPoints: ['serverApp.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
  });
  await fs.writeFile(tmp, out.outputFiles[0].text);
  let server;
  try {
    const { app } = require(process.cwd() + '/' + tmp);
    server = app.listen(0);
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/financial-data`);
    assert.equal(res.status, 401);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));
    const text = await res.text();
    assert.ok(!text.trim().startsWith('<'), 'API response must not be HTML');
    const data = JSON.parse(text);
    assert.ok(data.error);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await fs.unlink(tmp).catch(() => {});
  }
});

test('serverApp returns 404 JSON for nonexistent /api route, never HTML', async () => {
  const out = await build({
    entryPoints: ['serverApp.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
  });
  await fs.writeFile(tmp, out.outputFiles[0].text);
  let server;
  try {
    const { app } = require(process.cwd() + '/' + tmp);
    server = app.listen(0);
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/nonexistent-route-xyz`);
    assert.equal(res.status, 404);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));
    const text = await res.text();
    assert.ok(!text.trim().startsWith('<'), 'API 404 must be JSON, not HTML');
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await fs.unlink(tmp).catch(() => {});
  }
});

test('vite.config.ts does not contain hardcoded localhost proxy and relies on server.ts middlewareMode', async () => {
  const viteSrc = await fs.readFile('vite.config.ts', 'utf8');
  assert.ok(!viteSrc.includes("target: 'http://localhost:3000'"), 'vite.config.ts must not have hardcoded localhost:3000 proxy');
});

test('server.ts ensures /api routes bypass vite middleware and SPA static fallbacks', async () => {
  const serverSrc = await fs.readFile('server.ts', 'utf8');
  assert.ok(serverSrc.includes("req.path.startsWith('/api')"), 'server.ts must guard /api from vite.middlewares');
  assert.ok(serverSrc.includes('(?!api)'), 'server.ts static fallback must exclude /api routes');
});
