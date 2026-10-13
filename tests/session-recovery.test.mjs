import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const files=['tests/.tmp-session-hook.mjs','tests/.tmp-session-request.mjs'];let hook,request;
const pump=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
function plugin(){return {name:'session-harness',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'session-test'}));
 b.onResolve({filter:/^(\.\.\/lib\/supabase|\.\/supabase)$/},()=>({path:'supabase',namespace:'session-test'}));
 b.onResolve({filter:/^\.\.\/lib\/request$/},()=>({path:'request',namespace:'session-test'}));
 b.onLoad({filter:/.*/,namespace:'session-test'},a=>({loader:'js',contents:a.path==='react'?`
 export const useState=initial=>{const c=globalThis.__sessionHarness,i=c.stateCursor++;c.states[i]=initial;return [initial,v=>{c.states[i]=typeof v==='function'?v(c.states[i]):v;}];};
 export const useRef=value=>({current:value});export const useEffect=fn=>{globalThis.__sessionHarness.cleanup=fn();};
 `:a.path==='request'?`
 export const clearRequestState=()=>{const c=globalThis.__sessionHarness;c.clears++;c.gate=false;};
 export const setSessionVerificationPending=v=>{globalThis.__sessionHarness.gate=v;};
 export const setAuthenticatedIdentity=id=>{globalThis.__sessionHarness.identity=id;};
 export const authenticatedFetch=async()=>({ok:true});
 `:`
 export const supabase={auth:{getSession:()=>globalThis.__sessionHarness.getSession(),getUser:()=>globalThis.__sessionHarness.getUser(),onAuthStateChange:cb=>{globalThis.__sessionHarness.authEvent=cb;return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{const c=globalThis.__sessionHarness;c.signOuts++;c.authEvent?.('SIGNED_OUT',null);return {error:null};}},rpc:()=>globalThis.__sessionHarness.getProfile()};
 `}));}};}
before(async()=>{
 for(const [i,entry] of ['src/hooks/useAuthManager.ts','src/lib/request.ts'].entries()){
  const r=await build({entryPoints:[entry],bundle:true,format:'esm',platform:'node',write:false,plugins:[plugin()]});await fs.writeFile(files[i],r.outputFiles[0].text);
 }
 hook=await import(pathToFileURL(process.cwd()+'/'+files[0]));request=await import(pathToFileURL(process.cwd()+'/'+files[1]));
});
after(async()=>{for(const p of files)await fs.unlink(p).catch(()=>{});});
async function harness(run){
 const saved={window:globalThis.window,fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,harness:globalThis.__sessionHarness};
 const c={states:[],stateCursor:0,clears:0,signOuts:0,gate:false,identity:null,mode:'ok',candidate:{access_token:'synthetic-token',user:{id:'synthetic-user'}},authEvent:null,timer:null,cleanup:null};
 c.getSession=async()=>{if(c.mode==='session-network')throw new TypeError('synthetic network error');return {data:{session:c.candidate},error:null};};
 c.getUser=async()=>{if(c.deferred)return await c.deferred;if(c.mode==='user-network')throw new TypeError('synthetic network error');if(c.mode==='user-503')return {data:{user:null},error:{status:503}};if(c.mode==='invalid')return {data:{user:null},error:{status:401}};return {data:{user:c.candidate.user},error:null};};
 c.getProfile=async()=>{if(c.mode==='profile-network')return {data:null,error:{code:'',message:'synthetic transport error'}};return {data:{authUserId:c.candidate.user.id,status:c.mode==='inactive'?'inactive':'active',permissions:{}},error:null};};
 const target=new EventTarget();globalThis.window={location:{href:'https://example.invalid/dashboard',origin:'https://example.invalid'},addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),dispatchEvent:target.dispatchEvent.bind(target)};
 globalThis.__sessionHarness=c;globalThis.setInterval=fn=>{c.timer=fn;return 1;};globalThis.clearInterval=()=>{};
 try{c.actions=hook.useAuthManager({});await pump();await run(c);}
 finally{c.cleanup?.();Object.assign(globalThis,{window:saved.window,fetch:saved.fetch,setInterval:saved.setInterval,clearInterval:saved.clearInterval,__sessionHarness:saved.harness});}
}
for(const mode of ['user-network','user-503','profile-network','session-network'])test(`Temporary ${mode} retains verified login, pauses requests, and recovers`,async()=>harness(async c=>{
 assert.equal(c.states[0].id,'synthetic-user');const profile=c.states[2];c.mode=mode;c.timer();await pump();
 assert.equal(c.signOuts,0);assert.equal(c.states[0].id,'synthetic-user');assert.equal(c.states[2],profile);assert.equal(c.gate,true);assert.ok(c.states[4]);
 c.mode='ok';c.actions.retrySessionValidation();await pump();assert.equal(c.gate,false);assert.equal(c.states[4],null);assert.equal(c.states[0].id,'synthetic-user');
}));
test('Definitively invalid session still clears identity and signs out',async()=>harness(async c=>{c.mode='invalid';c.timer();await pump();assert.equal(c.states[0],null);assert.equal(c.states[2],null);assert.equal(c.signOuts,1);}));
test('Inactive account is not retained as an authorized profile',async()=>harness(async c=>{c.mode='inactive';c.timer();await pump();assert.equal(c.states[0],null);assert.equal(c.states[2],null);assert.equal(c.signOuts,1);}));
test('An expiry event still signs out and cannot be undone by a stale successful check',async()=>harness(async c=>{
 let resolve;c.deferred=new Promise(r=>resolve=r);c.timer();await pump();window.dispatchEvent(new Event('financial-session-expired'));resolve({data:{user:c.candidate.user},error:null});await pump();assert.equal(c.states[0],null);assert.equal(c.states[2],null);assert.equal(c.signOuts,1);
}));
test('A late successful validation cannot undo explicit logout',async()=>harness(async c=>{
 let resolve;c.deferred=new Promise(r=>resolve=r);c.timer();await pump();await c.actions.handleLogout();resolve({data:{user:c.candidate.user},error:null});await pump();assert.equal(c.states[0],null);assert.equal(c.states[2],null);
}));
test('A different identity cannot keep the previous verified profile during an outage',async()=>harness(async c=>{
 c.candidate={access_token:'other-synthetic-token',user:{id:'other-user'}};c.mode='user-network';c.authEvent('SIGNED_IN',c.candidate);await new Promise(r=>setTimeout(r,10));await pump();assert.equal(c.states[0],null);assert.equal(c.states[2],null);assert.equal(c.gate,true);
}));
test('Verification pause blocks fetch and does not emit saved until identity is reverified',async()=>harness(async c=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}',{headers:{'Content-Type':'application/json'}});};request.clearRequestState();request.setAuthenticatedIdentity('synthetic-user');request.setSessionVerificationPending(true);
 await assert.rejects(request.authenticatedFetch('/api/financial-data'),/تأیید/);assert.equal(calls,0);await assert.rejects(request.apiFetch('/api/financial-data/transaction',{method:'POST',body:'{}'}),/تأیید/);assert.equal(calls,0);
 request.setSessionVerificationPending(false);await request.authenticatedFetch('/api/financial-data');assert.equal(calls,1);
}));

test('Pausing and recovering while token lookup is pending still cancels the old request',async()=>harness(async c=>{
 let resolve;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
 request.clearRequestState();request.setAuthenticatedIdentity('synthetic-user');
 c.getSession=()=>new Promise(r=>resolve=r);
 const pending=request.authenticatedFetch('/api/financial-data');
 await pump();request.setSessionVerificationPending(true);request.setSessionVerificationPending(false);
 resolve({data:{session:c.candidate},error:null});await assert.rejects(pending,/نشست تغییر/);assert.equal(calls,0);
}));
test('Temporary provider status takes precedence over misleading invalid-token code',async()=>{
 const out=await build({entryPoints:['src/utils/authFailure.ts'],bundle:true,format:'esm',write:false});const helper=await import('data:text/javascript,'+encodeURIComponent(out.outputFiles[0].text));
 for(const status of [408,429,500,503])assert.equal(helper.isDefinitiveAuthFailure({status,code:'bad_jwt'}),false);
 assert.equal(helper.isDefinitiveAuthFailure({status:401}),true);assert.equal(helper.isDefinitiveAuthFailure({code:'bad_jwt',status:400}),true);assert.equal(helper.isDefinitiveAuthFailure(new TypeError('network')),false);
});

test('Uncertain session keeps a recovery control outside the inert application UI',async()=>{
 const source=await fs.readFile('src/App.tsx','utf8');assert.ok(source.includes('inert={Boolean(sessionCheckError)}'));assert.ok(source.includes('onClick={retrySessionValidation}'));assert.ok(source.includes('تلاش مجدد بررسی نشست'));
});
test('Successful token refresh retains the login and uses the refreshed session',async()=>harness(async c=>{
 c.candidate={...c.candidate,access_token:'synthetic-refreshed-token'};c.authEvent('TOKEN_REFRESHED',c.candidate);await new Promise(r=>setTimeout(r,10));await pump();
 assert.equal(c.states[0].id,'synthetic-user');assert.equal(c.states[1].access_token,'synthetic-refreshed-token');assert.equal(c.signOuts,0);assert.equal(c.gate,false);
}));
test('A genuinely missing stored session still clears the verified screen',async()=>harness(async c=>{
 c.candidate=null;c.timer();await pump();assert.equal(c.states[0],null);assert.equal(c.states[2],null);assert.equal(c.states[4],null);
}));
