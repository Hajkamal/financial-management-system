import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { build, transform } from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let db; let createAiHandler; const temporary=path.join(root,'tests/.tmp-ai.cjs');
const ids={admin:'11111111-1111-4111-8111-111111111111',viewer:'22222222-2222-4222-8222-222222222222',pending:'33333333-3333-4333-8333-333333333333',unknown:'44444444-4444-4444-8444-444444444444'};
async function as(role,id,sql,commit=false){
 await db.exec('BEGIN');
 try {await db.exec(`SET LOCAL ROLE ${role}`); await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id||'']); const result=await db.query(sql);await db.exec(commit?'COMMIT':'ROLLBACK');return result.rows;}
 catch(e){await db.exec('ROLLBACK');throw e;}
}
before(async()=>{
 db=new PGlite();await db.exec(fs.readFileSync(path.join(root,'tests/schema-fixture.sql'),'utf8'));
 await db.exec(`INSERT INTO auth.users(id) VALUES ${Object.values(ids).map(x=>`('${x}')`).join(',')};
 INSERT INTO public.app_users(id,email,first_name,last_name,full_name,password,role,role_title,status,permissions,created_at)
 VALUES('a','admin@example.invalid','Admin','Test','Admin Test','synthetic-only','super_admin','Admin','active','{}','2026-01-01'),
 ('v','viewer@example.invalid','Viewer','Test','Viewer Test','synthetic-only','viewer','Viewer','active','{}','2026-01-01'),
 ('p','pending@example.invalid','Pending','Test','Pending Test','synthetic-only','viewer','Viewer','pending','{}','2026-01-01');
 INSERT INTO public.fiscal_years(year,title,start_date,end_date,is_closed) VALUES(1404,'History','1404/01/01','1404/12/29',false),(1405,'Current','1405/01/01','1405/12/29',false);
 INSERT INTO public.transactions(id,type,category,amount,year,month,day,date_string,title) VALUES('historic','income','other',10,1404,1,1,'1404/01/01','History');`);
 await db.exec(fs.readFileSync(path.join(root,'supabase-security-hardening.sql'),'utf8'));
 // A reviewed SQL administrator performs this mapping, not a browser user.
 await db.exec(`UPDATE public.app_users SET auth_user_id='${ids.admin}' WHERE id='a'; UPDATE public.app_users SET auth_user_id='${ids.viewer}' WHERE id='v'; UPDATE public.app_users SET auth_user_id='${ids.pending}' WHERE id='p';`);
 const compiled=await build({entryPoints:[path.join(root,'server-security/ai-handler.ts')],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});fs.writeFileSync(temporary,compiled.outputFiles[0].text);createAiHandler=require(temporary).createAiHandler;
});
after(async()=>{await db?.close();if(fs.existsSync(temporary))fs.unlinkSync(temporary);});
test('migration preserves historic transaction and fiscal year',async()=>{assert.equal((await db.query("SELECT count(*)::int n FROM public.transactions WHERE year=1404")).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM public.fiscal_years')).rows[0].n,2);});
test('migration is idempotent',async()=>{await db.exec(fs.readFileSync(path.join(root,'supabase-security-hardening.sql'),'utf8'));assert.equal((await db.query('SELECT count(*)::int n FROM public.transactions')).rows[0].n,1);});
test('anonymous cannot read financial rows',async()=>{await assert.rejects(as('anon',null,'SELECT * FROM public.transactions'),e=>e.code==='42501');});
test('anonymous cannot execute profile RPC',async()=>{await assert.rejects(as('anon',null,'SELECT public.get_my_profile()'),e=>e.code==='42501');});
test('anonymous cannot truncate',async()=>{await assert.rejects(as('anon',null,'TRUNCATE public.transactions'),e=>e.code==='42501');});
test('unmapped signed-in user sees no transactions',async()=>{assert.equal((await as('authenticated',ids.unknown,'SELECT * FROM public.transactions')).length,0);});
test('unmapped profile is rejected',async()=>{assert.equal((await as('authenticated',ids.unknown,'SELECT public.get_my_profile() p'))[0].p,null);});
test('pending profile sees no transactions',async()=>{assert.equal((await as('authenticated',ids.pending,'SELECT * FROM public.transactions')).length,0);});
test('viewer reads approved transactions',async()=>{assert.equal((await as('authenticated',ids.viewer,'SELECT id FROM public.transactions')).length,1);});
test('profile DTO never returns password',async()=>{const p=(await as('authenticated',ids.admin,'SELECT public.get_my_profile() p'))[0].p;assert.equal(p.role,'super_admin');assert.equal('password' in p,false);assert.equal(p.authUserId,ids.admin);});
test('even an admin cannot select password via browser role',async()=>{await assert.rejects(as('authenticated',ids.admin,'SELECT password FROM public.app_users'),e=>e.code==='42501');});
test('viewer cannot promote own profile',async()=>{assert.equal((await as('authenticated',ids.viewer,"UPDATE public.app_users SET role='super_admin' WHERE id='v' RETURNING id")).length,0);assert.equal((await db.query("SELECT role FROM public.app_users WHERE id='v'")).rows[0].role,'viewer');});
test('viewer cannot assign Auth UUID',async()=>{await assert.rejects(as('authenticated',ids.viewer,`UPDATE public.app_users SET auth_user_id='${ids.unknown}' WHERE id='v'`),e=>e.code==='42501');});
test('caller-controlled JWT metadata cannot grant permission',async()=>{await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.viewer]);await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({user_metadata:{role:'super_admin',status:'active'},app_metadata:{role:'super_admin'}})]);const x=(await db.query("SELECT public.get_current_user_role() r, public.has_app_permission('canManageUsers') p")).rows[0];assert.equal(x.r,'viewer');assert.equal(x.p,false);}finally{await db.exec('ROLLBACK');}});
test('direct blind transaction update denied',async()=>{await assert.rejects(as('authenticated',ids.admin,"UPDATE public.transactions SET amount=999 WHERE id='historic'"),e=>e.code==='42501');});
const record={id:'new',type:'income',category:'other',amount:50,year:1405,month:1,day:1,date_string:'1405/01/01',title:'Synthetic',created_by:'forged'};
const rpc=(r,v='NULL')=>`SELECT public.save_financial_transaction('${JSON.stringify(r)}'::jsonb,${v}) p`;
test('viewer cannot create a transaction',async()=>{await assert.rejects(as('authenticated',ids.viewer,rpc(record)),e=>e.code==='42501');});
test('admin creates transaction with trusted actor and version',async()=>{const p=(await as('authenticated',ids.admin,rpc(record),true))[0].p;assert.equal(p.created_by,'a');assert.equal(p.row_version,1);});
test('duplicate create does not overwrite existing transaction',async()=>{await assert.rejects(as('authenticated',ids.admin,rpc({...record,amount:900})),e=>e.code==='40001');assert.equal((await db.query("SELECT amount FROM public.transactions WHERE id='new'")).rows[0].amount,50);});
test('CAS edit increments row version',async()=>{const p=(await as('authenticated',ids.admin,rpc({...record,amount:60},1),true))[0].p;assert.equal(p.amount,60);assert.equal(p.row_version,2);assert.equal(p.created_by,'a');});
test('stale second writer cannot overwrite committed edit',async()=>{await assert.rejects(as('authenticated',ids.admin,rpc({...record,amount:80},1)),e=>e.code==='40001');assert.equal((await db.query("SELECT amount FROM public.transactions WHERE id='new'")).rows[0].amount,60);});
test('invalid financial amount rejected',async()=>{await assert.rejects(as('authenticated',ids.admin,rpc({...record,id:'bad',amount:-1})));assert.equal((await db.query("SELECT id FROM public.transactions WHERE id='bad'")).rows.length,0);});
test('closed fiscal year rejects edit',async()=>{await db.exec('UPDATE public.fiscal_years SET is_closed=true WHERE year=1405');try{await assert.rejects(as('authenticated',ids.admin,rpc({...record,amount:70},2)));}finally{await db.exec('UPDATE public.fiscal_years SET is_closed=false WHERE year=1405');}});
test('stale delete rejected without losing row',async()=>{await assert.rejects(as('authenticated',ids.admin,"SELECT public.delete_financial_transaction('new',1)"),e=>e.code==='40001');assert.equal((await db.query("SELECT id FROM public.transactions WHERE id='new'")).rows.length,1);});
test('deactivated profile loses access immediately',async()=>{await db.exec("UPDATE public.app_users SET status='inactive' WHERE id='v'");try{assert.equal((await as('authenticated',ids.viewer,'SELECT id FROM public.transactions')).length,0);assert.equal((await as('authenticated',ids.viewer,'SELECT public.get_my_profile() p'))[0].p,null);}finally{await db.exec("UPDATE public.app_users SET status='active' WHERE id='v'");}});
test('durable AI quota rejects sixth request',async()=>{for(let i=0;i<5;i++)assert.equal((await as('authenticated',ids.viewer,'SELECT public.consume_ai_quota() q',true))[0].q.allowed,true);assert.equal((await as('authenticated',ids.viewer,'SELECT public.consume_ai_quota() q',true))[0].q.allowed,false);});
test('pending user cannot consume AI quota',async()=>{await assert.rejects(as('authenticated',ids.pending,'SELECT public.consume_ai_quota()'),e=>e.code==='42501');});
test('quota storage cannot be read by browser',async()=>{await assert.rejects(as('authenticated',ids.admin,'SELECT * FROM app_private.ai_quota'),e=>e.code==='42501');});
function fakeResponse(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
async function api(options={}){let used=0,verified=0;const deps={env:{ENABLE_EXTERNAL_AI:'true',SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'public-synthetic',GEMINI_API_KEY:'synthetic',...options.env},createSupabase:()=>({auth:{getUser:async()=>{verified++;return options.invalid?{error:new Error('invalid'),data:{user:null}}:{error:null,data:{user:{id:ids.viewer}}};}},rpc:async()=>options.quota||{error:null,data:{allowed:true}}}),generate:async()=>{used++;if(options.providerError)throw Error('secret provider details');return 'synthetic response';}};const res=fakeResponse();await createAiHandler(deps)({method:options.method||'POST',headers:options.headers||{authorization:'Bearer '+ 'x'.repeat(30)},body:options.body||{prompt:'test'}},res);return {res,used,verified};}
test('AI API requires bearer token before provider call',async()=>{const x=await api({headers:{}});assert.equal(x.res.statusCode,401);assert.equal(x.used,0);});
test('AI API rejects invalid token',async()=>{const x=await api({invalid:true});assert.equal(x.res.statusCode,401);assert.equal(x.used,0);assert.equal(x.verified,1);});
test('AI API denies missing profile permission',async()=>{const x=await api({quota:{error:{code:'42501'},data:null}});assert.equal(x.res.statusCode,403);assert.equal(x.used,0);});
test('AI API fails closed if quota DB is unavailable',async()=>{const x=await api({quota:{error:{code:'PGRST202'},data:null}});assert.equal(x.res.statusCode,503);assert.equal(x.used,0);});
test('AI API honors durable quota result',async()=>{const x=await api({quota:{error:null,data:{allowed:false}}});assert.equal(x.res.statusCode,429);assert.equal(x.used,0);});
test('AI API external sending is off by default',async()=>{const x=await api({env:{ENABLE_EXTERNAL_AI:undefined}});assert.equal(x.res.statusCode,503);assert.equal(x.used,0);});
test('AI API rejects oversized prompt',async()=>{const x=await api({body:{prompt:'x'.repeat(8001)}});assert.equal(x.res.statusCode,400);assert.equal(x.used,0);});
test('AI API rejects wrong method',async()=>{const x=await api({method:'GET'});assert.equal(x.res.statusCode,405);assert.equal(x.used,0);});
test('AI API never returns provider secret errors',async()=>{const x=await api({providerError:true});assert.equal(x.res.statusCode,503);assert.equal(JSON.stringify(x.res.body).includes('secret provider'),false);});
test('AI API authorized mock request succeeds without wildcard CORS',async()=>{const x=await api();assert.equal(x.res.statusCode,200);assert.equal(x.used,1);assert.equal(x.res.headers['Access-Control-Allow-Origin'],undefined);});
test('phase-one guard defaults to read-only',async()=>{const code=(await transform(fs.readFileSync(path.join(root,'src/lib/financialWriteGuard.ts'),'utf8'),{loader:'ts',format:'cjs',define:{'import.meta.env.VITE_ENABLE_FINANCIAL_WRITES':'undefined'}})).code;const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);assert.equal(mod.exports.financialWritesEnabled(),false);});
test('all touched TypeScript files parse',async()=>{let n=0;async function walk(p){for(const x of fs.readdirSync(p,{withFileTypes:true})){if(x.name==='node_modules')continue;const q=path.join(p,x.name);if(x.isDirectory())await walk(q);else if(/\.tsx?$/.test(q)){await transform(fs.readFileSync(q,'utf8'),{loader:q.endsWith('tsx')?'tsx':'ts'});n++;}}}await walk(root);assert.ok(n>=12);});
