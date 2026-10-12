import express from 'express';
import { app } from './serverApp';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';


dotenv.config();
const root = path.dirname(fileURLToPath(import.meta.url));
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
