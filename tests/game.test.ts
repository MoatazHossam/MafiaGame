import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, makePlayer, applyCommand, project, upgradeRoom, addPlayer, RuleError } from '../lib/game.ts';
import type { Room, Command } from '../lib/game.ts';
import {roleCounts} from '../lib/setup.ts';
const NOW = 1800000000000;
function fixture(n=8) {
  const r = makeRoom('ABCDEFGH',makePlayer(crypto.randomUUID(),'لاعب 0',0,true),NOW);
  for(let i=1;i<n;i++) addPlayer(r,makePlayer(crypto.randomUUID(),`لاعب ${i}`,i,true));
  r.players.forEach(p=>p.ready=true); return r;
}
function cmd(r:Room,id:string,type:Command['type'],extra:Partial<Command>={},now=NOW) {return applyCommand(r,id,{id:crypto.randomUUID(),phaseId:r.phaseId,type,...extra},now,()=>0.42);}
function started(n=8) {const r=fixture(n);cmd(r,r.hostId,'start');return r;}
function night(n=8) {const r=started(n);for(const p of r.players)cmd(r,p.id,'confirm');for(let i=0;i<4;i++)cmd(r,r.hostId,'next');assert.equal(r.phase,'night');return r;}
function roles(r:Room){return { mafia:r.players.filter(p=>p.role==='mafia'),doctor:r.players.find(p=>p.role==='doctor')!,detective:r.players.find(p=>p.role==='detective')!,citizen:r.players.find(p=>p.role==='citizen')! };}
const next=(r:Room,now=NOW)=>cmd(r,r.hostId,'next',{},now);
test('8–12 players have the exact proposed role counts',()=>{for(let n=8;n<=12;n++){const r=started(n),x=roles(r);assert.equal(x.mafia.length,n>=11?3:2);assert.equal(r.players.filter(p=>p.role==='doctor').length,1);assert.equal(r.players.filter(p=>p.role==='detective').length,1);assert.equal(r.phase,'reveal');}});
test('host cannot start with fewer than four or an unready member',()=>{const r=fixture(3);assert.throws(()=>cmd(r,r.hostId,'start'),RuleError);const s=fixture();s.players[2].ready=false;assert.throws(()=>cmd(s,s.hostId,'start'),RuleError);});
test('room is locked after starting',()=>{const r=started();assert.throws(()=>addPlayer(r,makePlayer(crypto.randomUUID(),'غريب',15)),RuleError);});
test('only host may start or approve',()=>{const r=fixture();assert.throws(()=>cmd(r,r.players[1].id,'start'),RuleError);});
test('name and avatar uniqueness are enforced',()=>{const r=fixture();assert.throws(()=>addPlayer(r,makePlayer('x','لاعب 0',15)),RuleError);assert.throws(()=>addPlayer(r,makePlayer('y','جديد',0)),RuleError);});
test('role confirmations stay private and only host Next opens the initial discussion',()=>{
  const r=started(),guest=r.players[1];
  cmd(r,r.hostId,'confirm');
  assert.equal(project(r,guest.id,NOW).players[0].ready,false);
  assert.equal(project(r,r.hostId,NOW).canAdvance,false);
  assert.throws(()=>next(r),{code:'ROLES_NOT_CONFIRMED'});
  assert.throws(()=>cmd(r,guest.id,'next'),{code:'HOST_ONLY'});
  for(const p of r.players)if(!p.confirmed)cmd(r,p.id,'confirm');
  assert.equal(r.phase,'reveal');
  assert.equal(project(r,r.hostId,NOW).canAdvance,true);
  assert.equal(project(r,guest.id,NOW).canAdvance,false);
  next(r);assert.equal(r.phase,'discussion');assert.equal(r.nightNumber,0);
  assert.ok(r.players.every(p=>p.alive));
  next(r);assert.equal(r.phase,'vote');
  next(r);assert.equal(r.phase,'result');assert.equal(r.stagnantCycles,0);
  next(r);assert.equal(r.phase,'night');assert.equal(r.nightNumber,1);
});
test('night remains open after everyone submits and choices can be changed much later',()=>{
  const r=night();for(const p of r.players)cmd(r,p.id,'night',{sequence:1,target:null});
  assert.equal(r.phase,'night');assert.ok(!('endsAt' in r));
  cmd(r,r.players[0].id,'night',{sequence:2,target:null},NOW+3600000);
  assert.equal(r.phase,'night');next(r,NOW+3600000);assert.equal(r.phase,'private');
});
test('civilian suspicion target is not persisted',()=>{const r=night(),x=roles(r);cmd(r,x.citizen.id,'night',{sequence:1,target:x.mafia[0].id});assert.equal(r.actions[x.citizen.id].target,null);});
test('mafia cannot target a teammate and detective cannot self-check',()=>{const r=night(),x=roles(r);assert.throws(()=>cmd(r,x.mafia[0].id,'night',{sequence:1,target:x.mafia[1].id}),RuleError);assert.throws(()=>cmd(r,x.detective.id,'night',{sequence:1,target:x.detective.id}),RuleError);});
test('protection saves the victim; no public explanation leaks the doctor',()=>{const r=night(),x=roles(r);for(const p of x.mafia)cmd(r,p.id,'night',{sequence:1,target:x.citizen.id});cmd(r,x.doctor.id,'night',{sequence:1,target:x.citizen.id});next(r);assert.equal(r.phase,'private');assert.ok(r.players.every(p=>p.alive));next(r);assert.equal(x.citizen.alive,true);assert.match(r.announcement,/من غير/);});
test('night victim stays hidden until dawn and is then revealed',()=>{const r=night(),x=roles(r);for(const p of x.mafia)cmd(r,p.id,'night',{sequence:1,target:x.citizen.id});next(r);assert.equal(project(r,x.doctor.id,r.phaseStartedAt).players.find(p=>p.id===x.citizen.id)!.role,null);next(r);assert.equal(x.citizen.alive,false);assert.equal(project(r,x.doctor.id,r.phaseStartedAt).players.find(p=>p.id===x.citizen.id)!.role,'citizen');});
test('tied mafia targets result in no kill',()=>{const r=night(),x=roles(r);cmd(r,x.mafia[0].id,'night',{sequence:1,target:x.doctor.id});cmd(r,x.mafia[1].id,'night',{sequence:1,target:x.detective.id});next(r);assert.equal(r.pendingVictim,null);});
test('investigation is private and available only during the private stage',()=>{const r=night(),x=roles(r);cmd(r,x.detective.id,'night',{sequence:1,target:x.mafia[0].id});assert.equal(project(r,x.detective.id,NOW).self.investigation,null);next(r);assert.equal(project(r,x.detective.id,r.phaseStartedAt).self.investigation?.mafia,true);assert.equal(project(r,x.doctor.id,r.phaseStartedAt).self.investigation,null);next(r);assert.equal(project(r,x.detective.id,r.phaseStartedAt).self.investigation,null);});
test('killed detective still receives the simultaneous investigation before dawn',()=>{const r=night(),x=roles(r);for(const p of x.mafia)cmd(r,p.id,'night',{sequence:1,target:x.detective.id});cmd(r,x.detective.id,'night',{sequence:1,target:x.mafia[0].id});next(r);assert.equal(project(r,x.detective.id,r.phaseStartedAt).self.investigation?.mafia,true);next(r);assert.equal(x.detective.alive,false);});
test('doctor cannot protect the same person on consecutive nights',()=>{const r=night(),x=roles(r);r.lastProtected=x.citizen.id;assert.throws(()=>cmd(r,x.doctor.id,'night',{sequence:1,target:x.citizen.id}),RuleError);cmd(r,x.doctor.id,'night',{sequence:1,target:x.doctor.id});});
test('duplicate command has one effect; reused id with changed payload is rejected',()=>{const r=night(),x=roles(r);const c:Command={id:crypto.randomUUID(),phaseId:r.phaseId,type:'night',sequence:1,target:null};assert.equal(applyCommand(r,x.doctor.id,c,NOW,()=>0),true);assert.equal(applyCommand(r,x.doctor.id,c,NOW,()=>0),false);assert.throws(()=>applyCommand(r,x.doctor.id,{...c,target:x.citizen.id},NOW,()=>0),RuleError);});
test('older choices and commands from an earlier phase are rejected',()=>{
  const r=night(),x=roles(r);cmd(r,x.doctor.id,'night',{sequence:2,target:null});
  assert.throws(()=>cmd(r,x.doctor.id,'night',{sequence:1,target:null}),{code:'STALE_CHOICE'});
  const phaseId=r.phaseId;next(r);
  assert.throws(()=>cmd(r,x.doctor.id,'night',{sequence:3,phaseId}),{code:'STALE_PHASE'});
});
test('eliminated players cannot act or discover living roles',()=>{const r=night(),x=roles(r);x.citizen.alive=false;x.citizen.revealed=true;assert.throws(()=>cmd(r,x.citizen.id,'night',{sequence:1,target:null}),RuleError);const view=project(r,x.citizen.id,NOW);assert.ok(view.players.filter(p=>p.alive).every(p=>p.role===null));assert.deepEqual(view.self.mafiaChoices,[]);});
test('non-mafia projections omit all teammate and night target data',()=>{const r=night(),x=roles(r);cmd(r,x.mafia[0].id,'night',{sequence:1,target:x.citizen.id});const v=project(r,x.doctor.id,NOW);assert.deepEqual(v.self.teammates,[]);assert.deepEqual(v.self.mafiaChoices,[]);assert.ok(!('pendingVictim'in v));assert.ok(!('actions'in v));assert.ok(!JSON.stringify(v).includes('receipts'));});
test('vote tie enters a single runoff; a second tie eliminates nobody',()=>{const r=night();r.phase='vote';r.votes={};const [a,b,...others]=r.players;for(const p of r.players)cmd(r,p.id,'vote',{sequence:1,target:p.id===a.id?b.id:p.id===b.id?a.id:others.indexOf(p)%2?a.id:b.id});next(r);assert.equal(r.phase,'runoff');assert.equal(r.finalists.length,2);next(r);assert.equal(r.phase,'result');assert.ok(r.players.every(p=>p.alive));});
test('abstentions equal to the leading candidate prevent elimination',()=>{const r=night();r.phase='vote';const a=r.players[0];for(const p of r.players.slice(1,5))cmd(r,p.id,'vote',{sequence:1,target:a.id});next(r);assert.ok(a.alive);assert.equal(r.phase,'result');});
test('votes cannot target self or a player outside the runoff',()=>{const r=night();r.phase='runoff';r.finalists=[r.players[1].id];assert.throws(()=>cmd(r,r.players[0].id,'vote',{sequence:1,target:r.players[0].id}),RuleError);assert.throws(()=>cmd(r,r.players[0].id,'vote',{sequence:1,target:r.players[2].id}),RuleError);});
test('three complete no-death cycles end with a draw',()=>{const r=night();for(let cycle=0;cycle<3;cycle++){next(r);next(r);next(r);next(r);next(r);assert.equal(r.phase,'result');next(r);}assert.equal(r.phase,'finished');assert.equal(r.outcome,'draw');});
test('rematch clears role assignments and readiness',()=>{const r=night();r.phase='finished';cmd(r,r.hostId,'rematch');assert.equal(r.phase,'lobby');assert.ok(r.players.every(p=>p.role===null&&!p.ready));});
test('old timed rooms migrate in place without resolving choices, dropping players or changing host',()=>{
  const r=night(),x=roles(r),host=r.hostId,phase=r.phaseId;
  cmd(r,x.mafia[0].id,'night',{target:x.citizen.id,sequence:1});
  const rolesBefore=r.players.map(p=>p.role);
  const legacy = r as unknown as Record<string,unknown>;
  delete legacy.flowVersion;
  Object.assign(legacy,{endsAt:NOW-1,discussionSeconds:60,pause:{since:NOW-999999,remaining:1000,reason:'connection'}});
  assert.equal(upgradeRoom(r),true);assert.equal(r.phase,'night');assert.equal(r.phaseId,phase+1);
  assert.equal(r.hostId,host);assert.equal(r.pendingVictim,null);assert.deepEqual(r.players.map(p=>p.role),rolesBefore);
  assert.ok(!('endsAt'in r));assert.ok(!('pause'in r));assert.ok(!('discussionSeconds'in r));
  assert.equal(upgradeRoom(r),false);assert.equal(r.phaseId,phase+1);
  next(r);assert.equal(r.phase,'private');
});
test('an eliminated host can still advance but cannot vote or make night choices',()=>{
  const r=night();r.players.find(p=>p.id===r.hostId)!.alive=false;
  assert.throws(()=>cmd(r,r.hostId,'night',{sequence:1,target:null}),{code:'ELIMINATED'});
  assert.equal(project(r,r.hostId,NOW).canAdvance,true);
  next(r);assert.equal(r.phase,'private');
});
test('eliminating the last mafia ends in a town win and reveals all roles',()=>{const r=night(),x=roles(r);x.mafia[0].alive=false;x.mafia[0].revealed=true;r.phase='vote';for(const p of r.players.filter(p=>p.alive&&p.id!==x.mafia[1].id))cmd(r,p.id,'vote',{sequence:1,target:x.mafia[1].id});next(r);assert.equal(r.outcome,'town');next(r);assert.equal(r.phase,'finished');assert.ok(project(r,x.citizen.id,r.phaseStartedAt).players.every(p=>p.role!==null));});
test('mafia parity after a night kill ends the match without another vote',()=>{const r=night(),x=roles(r);const town=r.players.filter(p=>p.role!=='mafia');for(const p of town.slice(0,3)){p.alive=false;p.revealed=true;}for(const p of x.mafia)cmd(r,p.id,'night',{sequence:1,target:town[3].id});next(r);next(r);assert.equal(r.outcome,'mafia');next(r);assert.equal(r.phase,'finished');});
test('a retried Next has one effect and a double click with a stale phase cannot skip a stage',()=>{
  const r=night();const c:Command={id:crypto.randomUUID(),phaseId:r.phaseId,type:'next'};
  assert.equal(applyCommand(r,r.hostId,c,NOW,()=>0),true);assert.equal(r.phase,'private');
  assert.equal(applyCommand(r,r.hostId,c,NOW+100000,()=>0),false);assert.equal(r.phase,'private');
  assert.throws(()=>applyCommand(r,r.hostId,{...c,id:crypto.randomUUID()},NOW+100000,()=>0),{code:'STALE_PHASE'});
});
test('aborted matches do not reveal surviving roles to another player',()=>{const r=night(),x=roles(r);cmd(r,r.hostId,'abort');const view=project(r,x.citizen.id,NOW);assert.ok(view.players.every(p=>p.role===null));assert.equal(view.self.role,null);assert.equal(view.outcome,null);});
test('every supported count 4–12 produces exactly one complete legal role deck',()=>{
  for(let n=4;n<=12;n++){
    const r=started(n),counts=roleCounts(n);
    for(const [role,count] of Object.entries(counts))assert.equal(r.players.filter(p=>p.role===role).length,count);
    assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),n);
    assert.ok(counts.mafia<n/2);
  }
  for(const n of [3,13,4.5])assert.throws(()=>roleCounts(n));
});
test('four-player games have one mafia and three citizens, and survive the first night into discussion',()=>{
  const r=night(4);
  const mafia=r.players.find(p=>p.role==='mafia')!,victim=r.players.find(p=>p.role==='citizen')!;
  assert.equal(r.players.filter(p=>p.role==='citizen').length,3);
  cmd(r,mafia.id,'night',{target:victim.id,sequence:1});next(r);next(r);
  assert.equal(r.outcome,null);assert.equal(r.players.filter(p=>p.alive).length,3);
  next(r);assert.equal(r.phase,'discussion');
});
