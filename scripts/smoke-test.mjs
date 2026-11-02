/** Exercises the real HTTP API with eight isolated cookie jars. Creates a disposable room. */
import assert from 'node:assert/strict';
const base=new URL(process.argv[2]??'http://terminal.local:4173/');
const clients=Array.from({length:8},()=>({id:crypto.randomUUID(),cookie:'',room:null}));
async function api(client,payload){
  const response=await fetch(new URL('/api/room',base),{method:'POST',headers:{'Content-Type':'application/json',Origin:base.origin,...(client.cookie?{Cookie:client.cookie}:{})},body:JSON.stringify({...payload,clientId:client.id})});
  const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];
  const data=await response.json();assert.equal(response.status,200,`${payload.mode}: ${data.code??''} ${data.error??''}`);if(data.room!==undefined)client.room=data.room;return data;
}
async function command(client,type,extra={}){return api(client,{mode:'command',command:{id:crypto.randomUUID(),phaseId:client.room.phaseId,type,...extra}});}
const host=clients[0];let interval;
try{
  await api(host,{mode:'create',name:'اختبار الشبكة 0',avatar:0,discussionSeconds:60});
  for(let i=1;i<clients.length;i++){const c=clients[i];await api(c,{mode:'join',name:`اختبار الشبكة ${i}`,avatar:i,code:host.room.code});assert.equal(c.room.phase,'pending');await command(host,'approve',{target:c.room.self.id});}
  for(const c of clients)await api(c,{mode:'poll'});
  interval=setInterval(()=>{void Promise.all(clients.filter(c=>c.cookie).map(c=>api(c,{mode:'poll'}))).catch(e=>{console.error('Heartbeat check failed:',e.message);process.exitCode=1;});},1800);
  for(const c of clients)await command(c,'ready',{value:true});
  await command(host,'start');
  for(const c of clients){await api(c,{mode:'poll'});assert.equal(c.room.phase,'reveal');assert.ok(c.room.self.role);assert.ok(c.room.players.every(p=>p.role===null));}
  for(const c of clients)await command(c,'confirm');
  for(const c of clients)await api(c,{mode:'poll'});
  assert.ok(clients.every(c=>c.room.phase==='night'));
  for(const c of clients){await command(c,'night',{target:null,sequence:1});if(c.room.self.role!=='mafia')assert.deepEqual(c.room.self.mafiaChoices,[]);}
  const repeated={id:crypto.randomUUID(),phaseId:host.room.phaseId,type:'night',target:null,sequence:2};
  await api(host,{mode:'command',command:repeated});await api(host,{mode:'command',command:repeated});assert.equal(host.room.self.choice.sequence,2);
  await command(host,'abort');
  console.log('PASS: real HTTP + database, eight isolated players, admission, readiness, secret role projections, night actions, duplicate command, cancellation.');
}finally{
  clearInterval(interval);
  // Cancel before leaving; never print the cookie jars or private role assignments.
  if(host.room&&!['aborted','finished','lobby'].includes(host.room.phase))try{await api(host,{mode:'poll'});await command(host,'abort');}catch{}
  for(const c of clients.filter(c=>c.cookie))try{await api(c,{mode:'leave'});}catch{}
}
