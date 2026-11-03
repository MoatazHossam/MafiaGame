import { z } from 'zod';
import { addPlayer, applyCommand, upgradeRoom, makePlayer, makeRoom, project, RuleError } from './game.ts';
import type { Room, Command } from './game.ts';
import {avatars} from './presentation.ts';

const TTL = 24 * 60 * 60 * 1000;
const cookieName = 'mafia_session';
const identity = z.object({ name: z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N} ._\-]+$/u), avatar: z.number().int().min(0).max(avatars.length-1) });
const commandSchema = z.object({ id: z.string().uuid(), phaseId: z.number().int().positive(), type: z.enum(['approve','reject','ready','start','confirm','night','vote','abort','rematch','next']), target: z.string().uuid().nullable().optional(), value: z.boolean().optional(), sequence: z.number().int().positive().max(100000).optional() }).strict();
// discussionSeconds is accepted only for compatibility with older cached clients; it has no effect.
const bodySchema = z.object({ mode: z.enum(['create','join','invite','resume','poll','command','leave']), clientId: z.string().uuid(), name: z.string().optional(), avatar: z.number().optional(), code: z.string().optional(), discussionSeconds: z.number().optional(), command: commandSchema.optional() }).strict();
type Session = { hash: string; room_code: string; member_id: string; client_id: string; expires: number };
type Stored = { code: string; state: string; version: number; expires: number };
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
function randomHex() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join(''); }
async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join(''); }
function response(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
function sessionCookie(token: string, request: Request, maxAge = TTL / 1000) { return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
async function limitedJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new RuleError('BAD_REQUEST', 'الطلب لازم يكون JSON.');
  const reader = request.body?.getReader(); if (!reader) throw new RuleError('BAD_REQUEST', 'الطلب فاضي.');
  let data = ''; let length = 0; const decoder = new TextDecoder();
  for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength;
    if (length > 8192) { await reader.cancel(); throw new RuleError('BAD_REQUEST', 'الطلب أكبر من المسموح.'); } data += decoder.decode(next.value, { stream: true }); }
  data += decoder.decode(); return bodySchema.parse(JSON.parse(data));
}
async function limit(db: D1Database, key: string, max: number, now: number) {
  const bucket = `${key}:${Math.floor(now / 60000)}`;
  const row = await db.prepare('INSERT INTO mafia_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket, now + 120000).first<{count:number}>();
  if ((row?.count ?? max + 1) > max) throw new RuleError('RATE_LIMIT', 'طلبات كتير بسرعة. استنى دقيقة وجرب تاني.');
}
async function presence(db: D1Database, s: Session, now: number) {
  await db.prepare('INSERT INTO mafia_presence (member_id,room_code,last_seen) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET last_seen=excluded.last_seen').bind(s.member_id,s.room_code,now).run();
  const rows = await db.prepare('SELECT member_id,last_seen FROM mafia_presence WHERE room_code=?').bind(s.room_code).all<{member_id:string;last_seen:number}>();
  return Object.fromEntries(rows.results.map(p => [p.member_id,p.last_seen]));
}
async function updateRoom(db: D1Database, s: Session, now: number, seen: Record<string,number>, command?: Command) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const stored = await db.prepare('SELECT code,state,version,expires FROM mafia_rooms WHERE code=? AND expires>?').bind(s.room_code,now).first<Stored>();
    if (!stored) throw new RuleError('ROOM_EXPIRED', 'الغرفة انتهت. اعملوا غرفة جديدة.');
    const room: Room = JSON.parse(stored.state); let error: RuleError | null = null;
    let changed = upgradeRoom(room);
    if (command) {
      // A rejected command must not commit any partially modified aggregate.
      const copy: Room = structuredClone(room);
      try { const applied = applyCommand(copy,s.member_id,command,now,random); if (applied) { Object.assign(room,copy); changed = true; } }
      catch (e) { if (!(e instanceof RuleError)) throw e; error = e; }
    }
    if (changed) {
      const saved = await db.prepare('UPDATE mafia_rooms SET state=?,version=version+1 WHERE code=? AND version=? AND EXISTS (SELECT 1 FROM mafia_sessions WHERE hash=? AND client_id=? AND expires>?)').bind(JSON.stringify(room),room.code,stored.version,s.hash,s.client_id,now).run();
      if (!saved.meta.changes) continue;
    }
    const view = project(room,s.member_id,now,seen,stored.version+(changed?1:0));
    return error ? response({ error: error.message, code: error.code, room: view },409) : response({ room: view });
  }
  throw new RuleError('CONFLICT', 'الغرفة بتتحدث. جرب تاني بعد لحظة.');
}
export async function handleApi(request: Request, db: D1Database, now = Date.now()): Promise<Response> {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return response({ error:'الطلب لازم ييجي من نفس الموقع.', code:'ORIGIN' },403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return response({ error:'طلب غير مسموح.',code:'ORIGIN' },403);
    const body = await limitedJson(request);
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    if (body.mode === 'invite') {
      await limit(db,`invite:${await hash(ip)}`,60,now);
      const code = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/).parse(body.code);
      const stored = await db.prepare('SELECT code,state,version,expires FROM mafia_rooms WHERE code=? AND expires>?').bind(code,now).first<Stored>();
      if (!stored) throw new RuleError('ROOM_NOT_FOUND','الغرفة انتهت أو الكود مش موجود. اطلب لينك جديد من صاحبك.');
      const room:Room = JSON.parse(stored.state);
      const full = room.players.length >= 16 || room.players.filter(p=>p.accepted).length >= 12;
      return response({invitation:{code,hostName:room.players.find(p=>p.id===room.hostId)?.name??'صاحبك',count:room.players.filter(p=>p.accepted).length,
        takenAvatars:room.players.map(p=>p.avatar),joinable:room.phase==='lobby'&&!full,
        reason:room.phase!=='lobby'?'المباراة بدأت بالفعل. استنى صاحب الغرفة يبدأ واحدة جديدة.':full?'الغرفة كاملة دلوقتي.':null}});
    }
    if (body.mode === 'create' || body.mode === 'join') {
      await limit(db,`entry:${await hash(ip)}`,30,now);
      const who = identity.parse({name:body.name,avatar:body.avatar});
      const member = makePlayer(crypto.randomUUID(),who.name.normalize('NFKC'),who.avatar,body.mode === 'create');
      const token = randomHex(); const tokenHash = await hash(token);
      if (body.mode === 'create') {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => alphabet[n % alphabet.length]).join('');
        const room = makeRoom(code,member,now);
        await db.batch([
          db.prepare('DELETE FROM mafia_rooms WHERE code IN (SELECT code FROM mafia_rooms WHERE expires<? LIMIT 100)').bind(now),
          db.prepare('DELETE FROM mafia_limits WHERE key IN (SELECT key FROM mafia_limits WHERE expires<? LIMIT 1000)').bind(now),
          db.prepare('INSERT INTO mafia_rooms (code,version,state,expires) VALUES (?,1,?,?)').bind(code,JSON.stringify(room),now+TTL),
          db.prepare('INSERT INTO mafia_sessions (hash,room_code,member_id,client_id,expires) VALUES (?,?,?,?,?)').bind(tokenHash,code,member.id,body.clientId,now+TTL),
          db.prepare('INSERT INTO mafia_presence (member_id,room_code,last_seen) VALUES (?,?,?)').bind(member.id,code,now),
        ]);
        return response({room:project(room,member.id,now,{[member.id]:now},1)},200,sessionCookie(token,request));
      }
      const code = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/).parse(body.code);
      for (let i=0;i<8;i++) {
        const row = await db.prepare('SELECT code,state,version,expires FROM mafia_rooms WHERE code=? AND expires>?').bind(code,now).first<Stored>();
        if (!row) throw new RuleError('ROOM_NOT_FOUND','مش لاقيين الغرفة. راجع الكود.');
        const room: Room = JSON.parse(row.state); addPlayer(room,member);
        const results = await db.batch([
          db.prepare('UPDATE mafia_rooms SET state=?,version=version+1 WHERE code=? AND version=?').bind(JSON.stringify(room),code,row.version),
          db.prepare("INSERT INTO mafia_sessions (hash,room_code,member_id,client_id,expires) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM mafia_rooms, json_each(mafia_rooms.state,'$.players') p WHERE code=? AND json_extract(p.value,'$.id')=?)").bind(tokenHash,code,member.id,body.clientId,row.expires,code,member.id),
          db.prepare('INSERT INTO mafia_presence (member_id,room_code,last_seen) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM mafia_sessions WHERE hash=?)').bind(member.id,code,now,tokenHash),
        ]);
        if (results[0].meta.changes) return response({room:project(room,member.id,now,{[member.id]:now},row.version+1)},200,sessionCookie(token,request,Math.max(0,Math.floor((row.expires-now)/1000))));
      }
      throw new RuleError('CONFLICT','الغرفة مزدحمة. جرب تاني.');
    }
    const token = request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return response(body.mode==='resume'?{room:null}:{error:'الجلسة انتهت. ادخل تاني.',code:'NO_SESSION'},body.mode==='resume'?200:401);
    const tokenHash = await hash(token);
    const session = await db.prepare('SELECT * FROM mafia_sessions WHERE hash=? AND expires>?').bind(tokenHash,now).first<Session>();
    if (!session) return response({room:null,code:'NO_SESSION'},body.mode==='resume'?200:401,sessionCookie('',request,0));
    if (body.mode==='resume') {
      await db.prepare('UPDATE mafia_sessions SET client_id=? WHERE hash=?').bind(body.clientId,tokenHash).run(); session.client_id = body.clientId;
    }
    if (session.client_id!==body.clientId) return response({error:'اللعبة اتفتحت في تبويب أحدث. كمل هناك أو استرجع التحكم هنا.',code:'TAB_REPLACED'},409);
    if (body.mode==='leave') {
      for(let i=0;i<8;i++) {
        const stored=await db.prepare('SELECT code,state,version,expires FROM mafia_rooms WHERE code=?').bind(session.room_code).first<Stored>();
        if(!stored)break;
        const room:Room=JSON.parse(stored.state);
        if(!['lobby','finished','aborted'].includes(room.phase))throw new RuleError('ACTIVE_GAME','المباراة شغالة. اقفل الصفحة مؤقتًا وارجع بنفس المتصفح، أو اطلب إلغاء المباراة.');
        room.players=room.players.filter(p=>p.id!==session.member_id);
        if(!room.players.length) {
          const deleted=await db.prepare('DELETE FROM mafia_rooms WHERE code=? AND version=?').bind(room.code,stored.version).run();
          if(!deleted.meta.changes)continue;
          return response({room:null},200,sessionCookie('',request,0));
        }
        if(room.hostId===session.member_id&&room.players.length){const next=room.players.find(p=>p.accepted)??room.players[0];next.accepted=true;room.hostId=next.id;}
        const result=await db.prepare('UPDATE mafia_rooms SET state=?,version=version+1 WHERE code=? AND version=? AND EXISTS (SELECT 1 FROM mafia_sessions WHERE hash=? AND client_id=?)').bind(JSON.stringify(room),room.code,stored.version,session.hash,session.client_id).run();
        if(!result.meta.changes)continue;
        await db.batch([db.prepare('DELETE FROM mafia_sessions WHERE hash=?').bind(tokenHash),db.prepare('DELETE FROM mafia_presence WHERE member_id=?').bind(session.member_id)]);
        return response({room:null},200,sessionCookie('',request,0));
      }
      throw new RuleError('CONFLICT','الغرفة بتتحدث. حاول الخروج تاني.');
    }
    if (body.mode==='command') await limit(db,`command:${tokenHash}`,120,now);
    const seen = await presence(db,session,now);
    return await updateRoom(db,session,now,seen,body.mode==='command'?commandSchema.parse(body.command):undefined);
  } catch (e) {
    if (e instanceof RuleError) return response({error:e.message,code:e.code},e.code==='RATE_LIMIT'?429:409);
    if (e instanceof z.ZodError || e instanceof SyntaxError) return response({error:'راجع البيانات المطلوبة وحاول تاني.',code:'BAD_REQUEST'},400);
    // Never log requests, room state, role assignments, cookies, or DB credentials.
    console.error('Mafia API storage/processing failure',e instanceof Error?e.name:'Unknown');
    return response({error:'تعذر حفظ الحالة دلوقتي. استنى لحظة وجرب تاني.',code:'SERVER_ERROR'},503);
  }
}
