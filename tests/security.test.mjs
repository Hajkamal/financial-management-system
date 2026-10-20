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
test('unmapped signed-in user sees no transactions',async()=>{await assert.rejects(as('authenticated',ids.unknown,'SELECT * FROM public.transactions'),e=>e.code==='42501');});
test('unmapped profile is rejected',async()=>{assert.equal((await as('authenticated',ids.unknown,'SELECT public.get_my_profile() p'))[0].p,null);});
test('pending profile sees no transactions',async()=>{await assert.rejects(as('authenticated',ids.pending,'SELECT * FROM public.transactions'),e=>e.code==='42501');});
test('browser role cannot bypass server financial reads',async()=>{await assert.rejects(as('authenticated',ids.viewer,'SELECT id FROM public.transactions'),e=>e.code==='42501');});
test('profile DTO never returns password',async()=>{const p=(await as('authenticated',ids.admin,'SELECT public.get_my_profile() p'))[0].p;assert.equal(p.role,'super_admin');assert.equal('password' in p,false);assert.equal(p.authUserId,ids.admin);});
test('even an admin cannot select password via browser role',async()=>{await assert.rejects(as('authenticated',ids.admin,'SELECT password FROM public.app_users'),e=>e.code==='42501');});
test('viewer cannot promote own profile',async()=>{await assert.rejects(as('authenticated',ids.viewer,"UPDATE public.app_users SET role='super_admin' WHERE id='v' RETURNING id"),e=>e.code==='42501');assert.equal((await db.query("SELECT role FROM public.app_users WHERE id='v'")).rows[0].role,'viewer');});
test('viewer cannot assign Auth UUID',async()=>{await assert.rejects(as('authenticated',ids.viewer,`UPDATE public.app_users SET auth_user_id='${ids.unknown}' WHERE id='v'`),e=>e.code==='42501');});
test('caller-controlled JWT metadata cannot grant permission',async()=>{await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[ids.viewer]);await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({user_metadata:{role:'super_admin',status:'active'},app_metadata:{role:'super_admin'}})]);const x=(await db.query("SELECT public.get_current_user_role() r, public.has_app_permission('canManageUsers') p")).rows[0];assert.equal(x.r,'viewer');assert.equal(x.p,false);}finally{await db.exec('ROLLBACK');}});
test('direct blind transaction update denied',async()=>{await assert.rejects(as('authenticated',ids.admin,"UPDATE public.transactions SET amount=999 WHERE id='historic'"),e=>e.code==='42501');});

const snap=async()=> (await db.query('SELECT public.get_server_snapshot() p')).rows[0].p;
async function commit(s,changes={},overrides={}) {
 const actor=s.app_users.find(u=>u.auth_user_id===ids.admin);
 const values={data:{...s,...changes},revision:s.revision,actor:ids.admin,stamp:actor.db_updated_at,backup:'synthetic_encrypted_placeholder_'.repeat(2),audit:{id:Math.random().toString(16),userName:'forged'},...overrides};
 return db.query('SELECT public.commit_financial_snapshot($1::jsonb,$2,$3::uuid,$4::timestamptz,$5,$6::jsonb) r',[JSON.stringify(values.data),values.revision,values.actor,values.stamp,values.backup,JSON.stringify(values.audit)]);
}
test('even admin cannot mutate profile through leftover column grants',async()=>{await assert.rejects(as('authenticated',ids.admin,"UPDATE public.app_users SET role='viewer' WHERE id='a'"),e=>e.code==='42501');});
test('browser cannot call privileged snapshot commit',async()=>{await assert.rejects(as('authenticated',ids.admin,"SELECT public.commit_financial_snapshot('{}',0,NULL,NULL,'placeholder','{}')"),e=>e.code==='42501');});
test('browser cannot call legacy single transaction RPC',async()=>{await assert.rejects(as('authenticated',ids.admin,"SELECT public.save_financial_transaction('{}',NULL)"),e=>e.code==='42501');});
test('snapshot does not return legacy passwords',async()=>{assert.ok((await snap()).app_users.every(u=>!('password' in u)));});
test('atomic snapshot writes two rows with one revision and one encrypted archive',async()=>{const s=await snap();await commit(s,{transactions:[...s.transactions,{...s.transactions[0],id:'new',year:1405,amount:50}],settings:{selectedYear:1405}});const after=await snap();assert.equal(after.transactions.length,2);assert.equal(after.revision,s.revision+1);assert.equal((await db.query('SELECT count(*)::int n FROM app_private.financial_backups')).rows[0].n,1);});
test('stale second writer cannot overwrite committed data',async()=>{const s=await snap();await commit(s);await assert.rejects(commit(s,{transactions:[]}),e=>e.code==='40001');assert.equal((await snap()).transactions.length,2);});
test('missing table prevents a partial commit',async()=>{const s=await snap();const data={...s};delete data.members;await assert.rejects(commit(s,{}, {data}));assert.equal((await snap()).revision,s.revision);});
test('foreign key error rolls back financial changes and backup together',async()=>{const s=await snap();const n=(await db.query('SELECT count(*)::int n FROM app_private.financial_backups')).rows[0].n;await assert.rejects(commit(s,{transactions:[],salary_matrix:[{id:'bad',employee_id:'missing',year:1405,month:1,amount:50,status:'paid'}]}),e=>e.code==='23503');assert.equal((await snap()).transactions.length,2);assert.equal((await snap()).revision,s.revision);assert.equal((await db.query('SELECT count(*)::int n FROM app_private.financial_backups')).rows[0].n,n);});
test('financial commit requires a backup',async()=>{const s=await snap();await assert.rejects(commit(s,{}, {backup:''}));assert.equal((await snap()).revision,s.revision);});
test('actor status changes between authorization and commit block writes',async()=>{const s=await snap();await db.exec("UPDATE public.app_users SET status='inactive' WHERE id='a'");const fresh=await snap();await assert.rejects(commit(s,{}, {revision:fresh.revision}),e=>e.code==='42501');await db.exec("UPDATE public.app_users SET status='active' WHERE id='a'");});
test('last active administrator cannot be deleted',async()=>{const s=await snap();const a=s.app_users.find(u=>u.id==='a');await assert.rejects(db.query("SELECT public.save_user_profile($1::jsonb,$2::uuid,true,$3,$2::uuid,$4::timestamptz,$5,$6::jsonb)",[JSON.stringify({id:'a'}),ids.admin,s.revision,a.db_updated_at,'synthetic_encrypted_placeholder_'.repeat(2),JSON.stringify({id:'test-delete'})]),/Last active administrator/);});
test('audit actor name comes from trusted profile',async()=>{const s=await snap();const audit={id:'trusted-audit',userName:'Forged'};await commit(s,{}, {audit});const row=(await db.query('SELECT entry FROM app_private.audit_log WHERE id=$1',[audit.id])).rows[0].entry;assert.equal(row.userName,'Admin Test');});
test('password recovery changes revoke old app sessions',async()=>{await db.query('UPDATE auth.users SET encrypted_password=$1 WHERE id=$2',['new-synthetic-hash',ids.viewer]);assert.equal((await as('authenticated',ids.viewer,'SELECT public.get_my_profile() p'))[0].p,null);await db.exec("UPDATE public.app_users SET sessions_valid_after='epoch' WHERE id='v'");});
test('deactivated profile loses access immediately',async()=>{await db.exec("UPDATE public.app_users SET status='inactive' WHERE id='v'");try{await assert.rejects(as('authenticated',ids.viewer,'SELECT id FROM public.transactions'),e=>e.code==='42501');assert.equal((await as('authenticated',ids.viewer,'SELECT public.get_my_profile() p'))[0].p,null);}finally{await db.exec("UPDATE public.app_users SET status='active' WHERE id='v'");}});
test('durable AI quota rejects sixth request',async()=>{for(let i=0;i<5;i++)assert.equal((await as('authenticated',ids.viewer,'SELECT public.consume_ai_quota() q',true))[0].q.allowed,true);assert.equal((await as('authenticated',ids.viewer,'SELECT public.consume_ai_quota() q',true))[0].q.allowed,false);});
test('pending user cannot consume AI quota',async()=>{await assert.rejects(as('authenticated',ids.pending,'SELECT public.consume_ai_quota()'),e=>e.code==='42501');});
test('AI refund RPC returns a consumed unit to the same user',async()=>{assert.equal((await as('authenticated',ids.admin,'SELECT public.consume_ai_quota() q',true))[0].q.allowed,true);await as('authenticated',ids.admin,'SELECT public.refund_ai_quota()',true);assert.equal((await as('authenticated',ids.admin,'SELECT public.consume_ai_quota() q',true))[0].q.allowed,true);});
test('pending user cannot refund AI quota',async()=>{await assert.rejects(as('authenticated',ids.pending,'SELECT public.refund_ai_quota()'),e=>e.code==='42501');});
test('anonymous cannot refund AI quota',async()=>{await assert.rejects(as('anon',null,'SELECT public.refund_ai_quota()'),e=>e.code==='42501');});
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
test('legacy write guard remains read-only',async()=>{const code=(await transform(fs.readFileSync(path.join(root,'src/lib/financialWriteGuard.ts'),'utf8'),{loader:'ts',format:'cjs',define:{'import.meta.env.VITE_ENABLE_FINANCIAL_WRITES':'undefined'}})).code;const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);assert.equal(mod.exports.financialWritesEnabled(),false);});
test('all touched TypeScript files parse',async()=>{let n=0;async function walk(p){for(const x of fs.readdirSync(p,{withFileTypes:true})){if(x.name==='node_modules')continue;const q=path.join(p,x.name);if(x.isDirectory())await walk(q);else if(/\.tsx?$/.test(q)){await transform(fs.readFileSync(q,'utf8'),{loader:q.endsWith('tsx')?'tsx':'ts'});n++;}}}await walk(root);assert.ok(n>=12);});

test('unchanged financial documents retain timestamps and row versions',async()=>{const before=await snap();await commit(before);const after=await snap();for(const old of before.transactions){const current=after.transactions.find(x=>x.id===old.id);assert.equal(current.updated_at,old.updated_at);assert.equal(current.db_updated_at,old.db_updated_at);assert.equal(current.row_version,old.row_version);}});
