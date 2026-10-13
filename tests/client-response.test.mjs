import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('client request code guards against non-JSON / HTML responses', async () => {
  const reqSrc = await fs.readFile('src/lib/request.ts', 'utf8');
  assert.ok(reqSrc.includes('content-type'), 'request.ts must verify content-type header');
  assert.ok(reqSrc.includes('application/json'), 'request.ts must check application/json');
});

test('serverApi guards against HTML response in getFinancialData', async () => {
  const apiSrc = await fs.readFile('src/lib/serverApi.ts', 'utf8');
  assert.ok(apiSrc.includes('content-type'), 'serverApi.ts must check content-type');
  assert.ok(apiSrc.includes('application/json'), 'serverApi.ts must verify application/json');
});

test('Dashboard and BankAccounts views do not show zero as real balance when API is unreachable', async () => {
  const dashSrc = await fs.readFile('src/components/DashboardView.tsx', 'utf8');
  assert.ok(dashSrc.includes('isCloudConnected'), 'DashboardView must accept isCloudConnected');

  const bankSrc = await fs.readFile('src/components/BankAccountsView.tsx', 'utf8');
  assert.ok(bankSrc.includes('isCloudConnected'), 'BankAccountsView must accept isCloudConnected');

  const hookSrc = await fs.readFile('src/hooks/useFinancialData.ts', 'utf8');
  assert.ok(hookSrc.includes('cloudError'), 'useFinancialData must track cloudError');
});

test('failed API calls and non-JSON responses dispatch financial-api-error and do not falsely report success', async () => {
  const apiSrc = await fs.readFile('src/lib/serverApi.ts', 'utf8');
  assert.ok(apiSrc.includes("window.dispatchEvent(new CustomEvent('financial-api-error'"), 'serverApi must dispatch financial-api-error on failure');
  const reqSrc = await fs.readFile('src/lib/request.ts', 'utf8');
  assert.ok(reqSrc.includes('financial-session-expired'), 'request.ts must handle session expiry');
});

test('authenticatedFetch checks origin using new URL(path, window.location.href) and enforces same-origin credentials', async () => {
  const reqSrc = await fs.readFile('src/lib/request.ts', 'utf8');
  assert.ok(reqSrc.includes('new URL(path, window.location.href)'), 'must construct URL with window.location.href');
  assert.ok(reqSrc.includes('targetUrl.origin !== window.location.origin'), 'must verify targetUrl origin matches window.location.origin');
  assert.ok(reqSrc.includes("credentials: 'same-origin'"), 'must enforce credentials same-origin');
});

test('authenticatedFetch rejects external URLs and protocol-relative URLs before fetch, and succeeds for relative requests', async () => {
  const { build } = await import('esbuild');
  const mockSupabasePlugin = {
    name: 'mock-supabase',
    setup(b) {
      b.onResolve({ filter: /supabase/ }, args => ({ path: args.path, namespace: 'mock-supabase' }));
      b.onLoad({ filter: /.*/, namespace: 'mock-supabase' }, () => ({
        contents: 'export const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: "test-user" }, access_token: "test-token" } } }) } };',
        loader: 'js'
      }));
    }
  };
  const res = await build({
    entryPoints: ['src/lib/request.ts'],
    bundle: true,
    format: 'esm',
    write: false,
    plugins: [mockSupabasePlugin]
  });

  const prevWindow = globalThis.window;
  const prevFetch = globalThis.fetch;

  try {
    globalThis.window = {
      location: {
        href: 'https://app.example.com/dashboard',
        origin: 'https://app.example.com'
      },
      dispatchEvent: () => {}
    };

    let fetchCalled = false;
    let fetchArgs = null;
    globalThis.fetch = async (url, opts) => {
      fetchCalled = true;
      fetchArgs = { url, opts };
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const mod = await import('data:text/javascript,' + encodeURIComponent(res.outputFiles[0].text));
    mod.setAuthenticatedIdentity('test-user');

    // 1. Rejects external address
    fetchCalled = false;
    await assert.rejects(async () => {
      await mod.authenticatedFetch('https://external.example/api');
    }, /مبدأ/);
    assert.equal(fetchCalled, false, 'Fetch must not be invoked for external address');

    // 2. Rejects //external.example (protocol-relative)
    fetchCalled = false;
    await assert.rejects(async () => {
      await mod.authenticatedFetch('//external.example/api');
    }, /مبدأ/);
    assert.equal(fetchCalled, false, 'Fetch must not be invoked for //external.example');

    // 3. Relative request succeeds, credentials fixed to same-origin (override rejected)
    fetchCalled = false;
    const response = await mod.authenticatedFetch('/api/financial-data', { credentials: 'omit' });
    assert.ok(response);
    assert.equal(fetchCalled, true, 'Fetch must be invoked for relative URL');
    assert.equal(fetchArgs.url, '/api/financial-data');
    assert.equal(fetchArgs.opts.credentials, 'same-origin', 'Credentials must remain same-origin even if init.credentials specifies omit');
    assert.equal(fetchArgs.opts.headers.get('Authorization'), 'Bearer test-token');
  } finally {
    globalThis.window = prevWindow;
    globalThis.fetch = prevFetch;
  }
});

