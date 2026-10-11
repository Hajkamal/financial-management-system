import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createAiHandler } from './server-security/ai-handler';

dotenv.config();
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use((req, res, next) => {
  let route: string;
  try { route = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
  if (/^\/(data|server-security|tests)(\/|$)/.test(route) || /\/(serverDb|server)\.ts$/.test(route) || route.startsWith('/.env')) return res.sendStatus(404);
  next();
});
app.use('/api', express.json({ limit: '250kb' }));
app.post('/api/gemini/analyze', createAiHandler());
// No serverDb import, shared token, JSON fallback, reset, restore or arbitrary-user
// password endpoint. Supabase Auth and protected RPCs are the only data path.
app.use('/api', (_req, res) => res.status(410).json({ error: 'Legacy API disabled. Use authenticated Supabase RPCs.' }));
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true,
      fs: { deny: ['**/.env*','**/.git/**',path.join(root,'data','**'),path.join(root,'tests','**'),path.join(root,'server-security','**'),path.join(root,'server.ts'),path.join(root,'serverDb.ts')] } }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(root,'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(root,'dist','index.html')));
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  app.listen(port,'0.0.0.0',() => console.log(`Listening on port ${port}`));
}
startServer().catch(() => { console.error('Server startup failed'); process.exitCode=1; });
