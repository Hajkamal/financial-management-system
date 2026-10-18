import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
test('Vercel entry runs under native Node ESM without local extensionless imports',async()=>{
 const src=await fs.readFile('api/[...path].ts','utf8');assert.ok(!/from\s+["']\.{1,2}\//.test(src));
 const p='tests/.tmp-vercel-entry.mjs';const compiled=await build({entryPoints:['api/[...path].ts'],bundle:false,platform:'node',format:'esm',write:false});await fs.writeFile(p,compiled.outputFiles[0].text);let server;
 try{const {default:app}=await import(pathToFileURL(process.cwd()+'/'+p));server=app.listen(0);const root='http://127.0.0.1:'+server.address().port;const r=await fetch(root+'/api/health');assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');const denied=await fetch(root+'/api/financial-data');assert.equal(denied.status,401);}finally{if(server)await new Promise(r=>server.close(r));await fs.unlink(p);}
});

test('Nested API routes target a static Vercel function',async()=>{const cfg=JSON.parse(await fs.readFile('vercel.json','utf8'));assert.deepEqual(cfg.rewrites[0],{source:'/api/:path*',destination:'/api/index'});assert.equal(await fs.readFile('api/index.ts','utf8'),await fs.readFile('api/[...path].ts','utf8'));});

test('api/ hosts only the bundled entry functions (no stale per-path routes)',async()=>{
 const out=[];const walk=async d=>{for(const e of await fs.readdir(d,{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())await walk(p);else out.push(p.replace(/^api\//,''));}};
 await walk('api');out.sort();
 // A per-path function (e.g. api/gemini/analyze.ts) circumvents vercel.json rewrites: it skips the shared
 // middleware chain and, with an extensionless first-party import, fails to load under native Node ESM.
 assert.deepEqual(out,['[...path].ts','index.ts']);
});
