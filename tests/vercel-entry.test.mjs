import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
test('Vercel entry runs under native Node ESM without local extensionless imports',async()=>{
 const src=await fs.readFile('api/[...path].ts','utf8');assert.ok(!/from\s+["']\.{1,2}\//.test(src));
 const p='tests/.tmp-vercel-entry.mjs';const compiled=await build({entryPoints:['api/[...path].ts'],bundle:false,platform:'node',format:'esm',write:false});await fs.writeFile(p,compiled.outputFiles[0].text);let server;
 try{const {default:app}=await import(pathToFileURL(process.cwd()+'/'+p));server=app.listen(0);const root='http://127.0.0.1:'+server.address().port;const r=await fetch(root+'/api/health');assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');const denied=await fetch(root+'/api/financial-data');assert.equal(denied.status,401);}finally{if(server)await new Promise(r=>server.close(r));await fs.unlink(p);}
});
