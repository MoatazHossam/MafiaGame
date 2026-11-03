import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi} from '../lib/server.ts';

function database() {
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')))sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));
  function prepare(sql:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args as [])??null;},async all(){return {results:sqlite.prepare(sql).all(...args as [])};},async run(){const result=sqlite.prepare(sql).run(...args as []);return {success:true,meta:{changes:Number(result.changes)}};}};}
  const db={prepare,async batch(statements:ReturnType<typeof prepare>[]){sqlite.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
  return {db,sqlite};
}
async function call(db:D1Database,body:Record<string,unknown>,cookie='',now=1800000000000,origin='http://local'){
  const response=await handleApi(new Request('http://local/api/room',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)}),db,now);
  const data=await response.json() as any;return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]??cookie};
}
const name=(n:number)=>({name:`لاعب ${n}`,avatar:n,clientId:crypto.randomUUID()});

test('astronaut avatar persists, appears as occupied in invitations, and cannot be selected twice',async()=>{
  const {db,sqlite}=database();try{
    const host={...name(0),avatar:16},first=await call(db,{mode:'create',...host});
    assert.equal(first.response.status,200);assert.equal(first.data.room.players[0].avatar,16);
    const preview=await call(db,{mode:'invite',clientId:crypto.randomUUID(),code:first.data.room.code});
    assert.deepEqual(preview.data.invitation.takenAvatars,[16]);
    const duplicate=await call(db,{mode:'join',...name(1),avatar:16,code:first.data.room.code});
    assert.equal(duplicate.data.code,'AVATAR_TAKEN');
    const invalid=await call(db,{mode:'join',...name(2),avatar:17,code:first.data.room.code});
    assert.equal(invalid.data.code,'BAD_REQUEST');
    const resumed=await call(db,{mode:'resume',clientId:host.clientId},first.cookie);
    assert.equal(resumed.data.room.players[0].avatar,16);
  }finally{sqlite.close();}
});

async function manualMatch(db:D1Database,n=6){
  const host=name(0),first=await call(db,{mode:'create',...host});
  const clients=[{identity:host,...first}];
  for(let i=1;i<n;i++){
    const identity=name(i),guest=await call(db,{mode:'join',code:first.data.room.code,...identity});clients.push({identity,...guest});
    await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'approve',target:guest.data.room.self.id}},first.cookie);
  }
  for(const c of clients)await call(db,{mode:'command',clientId:c.identity.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'ready',value:true}},c.cookie);
  const started=await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'start'}},first.cookie);
  assert.equal(started.response.status,200);
  return {clients,phaseId:started.data.room.phaseId};
}

test('real API is host-paced, starts with discussion, and never advances or transfers host during long idle periods',async()=>{
  const {db,sqlite}=database();try{
    const {clients,phaseId}=await manualMatch(db);const [host,guest]=clients;
    const send=(c:typeof host,type:string,phaseId:number,extra:Record<string,unknown>={},now=1800000000000)=>call(db,{mode:'command',clientId:c.identity.clientId,command:{id:crypto.randomUUID(),phaseId,type,...extra}},c.cookie,now);
    const early=await send(host,'next',phaseId);assert.equal(early.data.code,'ROLES_NOT_CONFIRMED');
    for(const c of clients){const confirmed=await send(c,'confirm',phaseId);assert.equal(confirmed.data.room.phase,'reveal');}
    const denied=await send(guest,'next',phaseId);assert.equal(denied.data.code,'HOST_ONLY');
    const later=1800000000000+600000;
    const idle=await call(db,{mode:'poll',clientId:guest.identity.clientId},guest.cookie,later);
    assert.equal(idle.data.room.phase,'reveal');assert.equal(idle.data.room.hostId,host.data.room.self.id);
    assert.ok(!('endsAt'in idle.data.room));assert.ok(!('discussionSeconds'in idle.data.room));
    const discussion=await send(host,'next',phaseId,{},later);assert.equal(discussion.data.room.phase,'discussion');assert.ok(discussion.data.room.players.every((p:any)=>p.alive));
    const waiting=await call(db,{mode:'poll',clientId:guest.identity.clientId},guest.cookie,later+600000);assert.equal(waiting.data.room.phase,'discussion');assert.equal(waiting.data.room.hostId,host.data.room.self.id);
    const vote=await send(host,'next',discussion.data.room.phaseId,{},later+600000);assert.equal(vote.data.room.phase,'vote');
    const stale=await send(host,'next',discussion.data.room.phaseId,{},later+600000);assert.equal(stale.data.code,'STALE_PHASE');assert.equal(stale.data.room.phase,'vote');
    const lateChoice=await send(guest,'vote',vote.data.room.phaseId,{target:host.data.room.self.id,sequence:1},later+1200000);assert.equal(lateChoice.response.status,200);
    const result=await send(host,'next',vote.data.room.phaseId,{},later+1200000);assert.equal(result.data.room.phase,'result');
    const night=await send(host,'next',result.data.room.phaseId,{},later+1200000);assert.equal(night.data.room.phase,'night');
    assert.ok(night.data.room.players.every((p:any)=>p.role===null));
    const repeated={id:crypto.randomUUID(),phaseId:night.data.room.phaseId,type:'next'};
    const first=await call(db,{mode:'command',clientId:host.identity.clientId,command:repeated},host.cookie,later+1200000);assert.equal(first.data.room.phase,'private');
    const retry=await call(db,{mode:'command',clientId:host.identity.clientId,command:repeated},host.cookie,later+1200000);assert.equal(retry.data.room.phase,'private');
  }finally{sqlite.close();}
});

test('polling a legacy timed and paused room upgrades it without killing anyone or discarding roles',async()=>{
  const {db,sqlite}=database();try{
    const {clients}=await manualMatch(db);const [host,guest]=clients;
    const stored=JSON.parse((sqlite.prepare('SELECT state FROM mafia_rooms').get() as any).state);
    delete stored.flowVersion;stored.phase='night';stored.endsAt=1800000000000-1;stored.discussionSeconds=60;stored.pause={since:1800000000000-999999,remaining:1000,reason:'connection'};
    const hostId=stored.hostId,phaseId=stored.phaseId,roles=stored.players.map((p:any)=>p.role);
    sqlite.prepare('UPDATE mafia_rooms SET state=?').run(JSON.stringify(stored));
    const poll=await call(db,{mode:'poll',clientId:guest.identity.clientId},guest.cookie,1800000000000+600000);
    assert.equal(poll.response.status,200);assert.equal(poll.data.room.phase,'night');assert.equal(poll.data.room.hostId,hostId);
    assert.ok(poll.data.room.players.every((p:any)=>p.alive&&p.role===null));assert.equal(poll.data.room.phaseId,phaseId+1);
    const migrated=JSON.parse((sqlite.prepare('SELECT state FROM mafia_rooms').get() as any).state);
    assert.deepEqual(migrated.players.map((p:any)=>p.role),roles);assert.ok(!('endsAt'in migrated));assert.ok(!('pause'in migrated));
    const old=await call(db,{mode:'command',clientId:host.identity.clientId,command:{id:crypto.randomUUID(),phaseId,type:'next'}},host.cookie,1800000000000+600000);
    assert.equal(old.data.code,'STALE_PHASE');assert.equal(old.data.room.phase,'night');
  }finally{sqlite.close();}
});
test('API creates a durable room and a protected guest cookie; resume restores it',async()=>{const {db,sqlite}=database();try{const identity=name(0),a=await call(db,{mode:'create',...identity});assert.equal(a.response.status,200);assert.equal(a.data.room.code.length,8);assert.match(a.response.headers.get('set-cookie')!,/HttpOnly/);assert.match(a.response.headers.get('cache-control')!,/no-store/);const b=await call(db,{mode:'resume',clientId:crypto.randomUUID()},a.cookie);assert.equal(b.data.room.self.id,a.data.room.self.id);assert.equal(b.data.room.code,a.data.room.code);}finally{sqlite.close();}});
test('host approval is required; rejected member loses access; stale tab cannot command',async()=>{const {db,sqlite}=database();try{const host=name(0),a=await call(db,{mode:'create',...host}),guest=name(1),b=await call(db,{mode:'join',code:a.data.room.code,...guest});assert.equal(b.data.room.phase,'pending');const approve={id:crypto.randomUUID(),phaseId:1,type:'approve',target:b.data.room.self.id};const denied=await call(db,{mode:'command',clientId:guest.clientId,command:approve},b.cookie);assert.equal(denied.response.status,409);assert.equal(denied.data.code,'HOST_ONLY');await call(db,{mode:'command',clientId:host.clientId,command:approve},a.cookie);const accepted=await call(db,{mode:'poll',clientId:guest.clientId},b.cookie);assert.equal(accepted.data.room.phase,'lobby');await call(db,{mode:'resume',clientId:crypto.randomUUID()},a.cookie);const old=await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'ready',value:true}},a.cookie);assert.equal(old.data.code,'TAB_REPLACED');}finally{sqlite.close();}});
test('cross-origin and oversized commands are rejected before state changes',async()=>{const {db,sqlite}=database();try{const bad=await call(db,{mode:'create',...name(0)},'',undefined,'https://evil.test');assert.equal(bad.response.status,403);const long=await call(db,{mode:'create',...name(0),name:'x'.repeat(9000)});assert.equal(long.response.status,409);assert.equal(Number((sqlite.prepare('SELECT count(*) AS n FROM mafia_rooms').get() as any).n),0);}finally{sqlite.close();}});
test('unknown cookies cannot poll another room',async()=>{const {db,sqlite}=database();try{const a=await call(db,{mode:'create',...name(0)});const bad=await call(db,{mode:'poll',clientId:crypto.randomUUID()},'mafia_session='+'a'.repeat(64));assert.equal(bad.response.status,401);assert.equal(bad.data.room,null);assert.ok(a.data.room);}finally{sqlite.close();}});
test('eight isolated guest sessions start and receive only their own private projection',async()=>{const {db,sqlite}=database();try{const host=name(0),a=await call(db,{mode:'create',...host});const clients=[{identity:host,...a}];for(let i=1;i<8;i++){const identity=name(i),guest=await call(db,{mode:'join',code:a.data.room.code,...identity});clients.push({identity,...guest});await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'approve',target:guest.data.room.self.id}},a.cookie);}for(const c of clients)await call(db,{mode:'command',clientId:c.identity.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'ready',value:true}},c.cookie);const started=await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'start'}},a.cookie);assert.equal(started.data.room.phase,'reveal');for(const c of clients){const p=await call(db,{mode:'poll',clientId:c.identity.clientId},c.cookie);assert.ok(p.data.room.self.role);assert.ok(p.data.room.players.every((x:any)=>x.role===null));assert.ok(!('actions'in p.data.room));assert.equal(p.data.room.history.length,0);}const stored=JSON.parse((sqlite.prepare('SELECT state FROM mafia_rooms').get() as any).state);assert.equal(stored.players.filter((p:any)=>p.role==='mafia').length,2);}finally{sqlite.close();}});
test('expired rooms cannot be restored',async()=>{const {db,sqlite}=database();try{const identity=name(0),a=await call(db,{mode:'create',...identity});const b=await call(db,{mode:'resume',clientId:identity.clientId},a.cookie,1800000000000+25*3600000);assert.equal(b.data.room,null);}finally{sqlite.close();}});
test('leaving the last lobby slot deletes the empty room and invalidates its session',async()=>{const {db,sqlite}=database();try{const identity=name(0),a=await call(db,{mode:'create',...identity});const b=await call(db,{mode:'leave',clientId:identity.clientId},a.cookie);assert.equal(b.response.status,200);assert.equal(b.data.room,null);assert.equal((sqlite.prepare('SELECT count(*) n FROM mafia_rooms').get() as any).n,0);assert.equal((sqlite.prepare('SELECT count(*) n FROM mafia_sessions').get() as any).n,0);}finally{sqlite.close();}});
test('a stale tab cannot sign out a newer tab',async()=>{const {db,sqlite}=database();try{const identity=name(0),a=await call(db,{mode:'create',...identity});const newer=crypto.randomUUID();await call(db,{mode:'resume',clientId:newer},a.cookie);const leave=await call(db,{mode:'leave',clientId:identity.clientId},a.cookie);assert.equal(leave.data.code,'TAB_REPLACED');const poll=await call(db,{mode:'poll',clientId:newer},a.cookie);assert.equal(poll.response.status,200);}finally{sqlite.close();}});
test('lobby host exit transfers management and removes the old seat',async()=>{const {db,sqlite}=database();try{const host=name(0),a=await call(db,{mode:'create',...host}),guest=name(1),b=await call(db,{mode:'join',code:a.data.room.code,...guest});await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'approve',target:b.data.room.self.id}},a.cookie);await call(db,{mode:'leave',clientId:host.clientId},a.cookie);const next=await call(db,{mode:'poll',clientId:guest.clientId},b.cookie);assert.equal(next.data.room.hostId,b.data.room.self.id);assert.equal(next.data.room.players.length,1);}finally{sqlite.close();}});
test('a fresh invitation previews only public join information, then joins the exact room and resumes that seat',async()=>{
  const {db,sqlite}=database();try{
    const host=name(0),a=await call(db,{mode:'create',...host}),guest=name(1);
    const preview=await call(db,{mode:'invite',clientId:guest.clientId,code:a.data.room.code});
    assert.equal(preview.response.status,200);assert.equal(preview.data.invitation.code,a.data.room.code);
    assert.deepEqual(preview.data.invitation.takenAvatars,[0]);assert.equal(preview.data.invitation.joinable,true);
    assert.deepEqual(Object.keys(preview.data.invitation).sort(),['code','count','hostName','joinable','reason','takenAvatars'].sort());
    assert.equal(preview.response.headers.get('set-cookie'),null);
    const joined=await call(db,{mode:'join',...guest,code:preview.data.invitation.code});
    assert.equal(joined.data.room.code,a.data.room.code);assert.equal(joined.data.room.phase,'pending');
    const resume=await call(db,{mode:'resume',clientId:crypto.randomUUID()},joined.cookie);
    assert.equal(resume.data.room.self.id,joined.data.room.self.id);assert.equal(resume.data.room.code,a.data.room.code);
  }finally{sqlite.close();}
});
test('invitation previews report locked and expired rooms without revealing roles',async()=>{
  const {db,sqlite}=database();try{
    const a=await call(db,{mode:'create',...name(0)}),clientId=crypto.randomUUID();
    const stored=JSON.parse((sqlite.prepare('SELECT state FROM mafia_rooms').get() as any).state);
    stored.phase='night';stored.players[0].role='mafia';
    sqlite.prepare('UPDATE mafia_rooms SET state=?').run(JSON.stringify(stored));
    const locked=await call(db,{mode:'invite',clientId,code:a.data.room.code});
    assert.equal(locked.data.invitation.joinable,false);assert.ok(locked.data.invitation.reason);
    assert.ok(!JSON.stringify(locked.data).includes('"role"'));assert.ok(!JSON.stringify(locked.data).includes('"players"'));
    const expired=await call(db,{mode:'invite',clientId,code:a.data.room.code},'',1800000000000+25*3600000);
    assert.equal(expired.data.code,'ROOM_NOT_FOUND');
  }finally{sqlite.close();}
});
test('four isolated guest sessions can ready, start and receive the small-group setup',async()=>{
  const {db,sqlite}=database();try{
    const host=name(0),first=await call(db,{mode:'create',...host});const clients=[{identity:host,...first}];
    for(let i=1;i<4;i++){const identity=name(i),guest=await call(db,{mode:'join',code:first.data.room.code,...identity});clients.push({identity,...guest});await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'approve',target:guest.data.room.self.id}},first.cookie);}
    for(const c of clients)await call(db,{mode:'command',clientId:c.identity.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'ready',value:true}},c.cookie);
    const started=await call(db,{mode:'command',clientId:host.clientId,command:{id:crypto.randomUUID(),phaseId:1,type:'start'}},first.cookie);
    assert.equal(started.response.status,200);assert.equal(started.data.room.phase,'reveal');
    const stored=JSON.parse((sqlite.prepare('SELECT state FROM mafia_rooms').get() as any).state);
    assert.equal(stored.players.filter((p:any)=>p.role==='mafia').length,1);assert.equal(stored.players.filter((p:any)=>p.role==='citizen').length,3);
  }finally{sqlite.close();}
});
