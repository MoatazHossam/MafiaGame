/** Authoritative, transport-independent Mafia rules. Never send Room to a client. */
import {MIN_PLAYERS,MAX_PLAYERS,roleCounts} from './setup.ts';
export type Role = 'mafia' | 'doctor' | 'detective' | 'citizen';
export type Phase = 'lobby' | 'reveal' | 'night' | 'private' | 'dawn' | 'discussion' | 'vote' | 'runoff' | 'result' | 'finished' | 'aborted';
export type Outcome = 'mafia' | 'town' | 'draw' | null;
export type Player = { id: string; name: string; avatar: number; accepted: boolean; ready: boolean; alive: boolean; role: Role | null; revealed: boolean; confirmed: boolean };
type Choice = { target: string | null; sequence: number };
export type Command = { id: string; phaseId: number; type: 'approve' | 'reject' | 'ready' | 'start' | 'confirm' | 'night' | 'vote' | 'abort' | 'rematch'; target?: string | null; value?: boolean; sequence?: number };
export type Room = {
  code: string; hostId: string; phase: Phase; phaseId: number; endsAt: number | null; createdAt: number; phaseStartedAt: number;
  discussionSeconds: number; nightNumber: number; players: Player[]; outcome: Outcome;
  actions: Record<string, Choice>; votes: Record<string, Choice>; investigations: Record<string, { target: string; mafia: boolean }>;
  lastProtected: string | null; pendingVictim: string | null; finalists: string[]; history: { text: string; at: number }[];
  announcement: string; cycleHadDeath: boolean; stagnantCycles: number;
  pause: { since: number; remaining: number; reason: 'connection' | 'recovery' } | null;
  receipts: Record<string, string>;
};
export class RuleError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
function fail(code: string, message: string): never { throw new RuleError(code, message); }
export const ROLE_NAMES: Record<Role, string> = { mafia: 'مافيا', doctor: 'الدكتور', detective: 'المحقق', citizen: 'مواطن' };
export function makeRoom(code: string, host: Player, now: number, discussionSeconds = 120): Room {
  return { code, hostId: host.id, phase: 'lobby', phaseId: 1, endsAt: null, phaseStartedAt: now, createdAt: now, discussionSeconds,
    nightNumber: 0, players: [host], outcome: null, actions: {}, votes: {}, investigations: {}, lastProtected: null, pendingVictim: null,
    finalists: [], history: [], announcement: '', cycleHadDeath: false, stagnantCycles: 0, pause: null, receipts: {} };
}
export function makePlayer(id: string, name: string, avatar: number, accepted = false): Player {
  return { id, name, avatar, accepted, ready: false, alive: true, role: null, revealed: false, confirmed: false };
}
function enter(r: Room, phase: Phase, seconds: number | null, now: number) {
  r.phase = phase; r.phaseId++; r.phaseStartedAt = now; r.endsAt = seconds === null ? null : now + seconds * 1000;
}
function note(r: Room, text: string, now: number) { r.announcement = text; r.history.push({ text, at: now }); r.history = r.history.slice(-100); }
function winner(r: Room): Outcome {
  const alive = r.players.filter(p => p.accepted && p.alive);
  const mafia = alive.filter(p => p.role === 'mafia').length;
  if (!mafia) return 'town';
  return mafia >= alive.length - mafia ? 'mafia' : null;
}
function startNight(r: Room, now: number) {
  r.nightNumber++; r.actions = {}; r.votes = {}; r.investigations = {}; r.pendingVictim = null; r.finalists = []; r.cycleHadDeath = false;
  enter(r, 'night', 45, now);
}
function eliminate(r: Room, id: string | null, prefix: string, now: number) {
  const p = r.players.find(p => p.id === id && p.alive && p.accepted);
  if (p) { p.alive = false; p.revealed = true; r.cycleHadDeath = true; note(r, `${prefix}: ${p.name} — ${ROLE_NAMES[p.role!]}`, now); }
  else note(r, prefix === 'ضحية الليلة' ? 'عدّت الليلة من غير ما حد يخرج.' : 'محدش خرج من التصويت.', now);
  r.outcome = winner(r);
}
function resolveNight(r: Room, now: number) {
  const alive = r.players.filter(p => p.accepted && p.alive);
  const counts: Record<string, number> = {};
  for (const p of alive.filter(p => p.role === 'mafia')) {
    const id = r.actions[p.id]?.target;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const target = ranked.length && (!ranked[1] || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
  const doctor = alive.find(p => p.role === 'doctor');
  const protectedId = doctor ? r.actions[doctor.id]?.target ?? null : null;
  r.lastProtected = protectedId;
  r.pendingVictim = target !== protectedId ? target : null;
  const detective = alive.find(p => p.role === 'detective');
  const investigated = detective ? r.actions[detective.id]?.target : null;
  if (detective && investigated) r.investigations[detective.id] = { target: investigated, mafia: r.players.find(p => p.id === investigated)?.role === 'mafia' };
  enter(r, 'private', 8, now);
}
function resolveVote(r: Room, now: number) {
  const alive = r.players.filter(p => p.accepted && p.alive);
  const counts: Record<string, number> = {}; let abstain = 0;
  for (const p of alive) {
    const id = r.votes[p.id]?.target;
    if (id) counts[id] = (counts[id] ?? 0) + 1; else abstain++;
  }
  const top = Math.max(0, ...Object.values(counts));
  const tied = Object.keys(counts).filter(id => counts[id] === top);
  if (r.phase === 'vote' && top > abstain && tied.length > 1) {
    r.finalists = tied; r.votes = {}; enter(r, 'runoff', 20, now); return;
  }
  const selected = top > abstain && tied.length === 1 ? tied[0] : null;
  const tally = Object.entries(counts).map(([id, n]) => `${r.players.find(p => p.id === id)!.name}: ${n}`).join('، ');
  note(r, `نتيجة التصويت: ${tally || 'لا أصوات'}؛ امتناع: ${abstain}.`, now);
  eliminate(r, selected, 'خرج بالتصويت', now);
  r.stagnantCycles = r.cycleHadDeath ? 0 : r.stagnantCycles + 1;
  if (!r.outcome && r.stagnantCycles >= 3) { r.outcome = 'draw'; note(r, 'تعادل: ثلاث دورات متتالية من غير خروج أي لاعب.', now); }
  enter(r, 'result', 8, now);
}
/** Progress one stage per request. Missed client timers never authorize a late action. */
export function advance(r: Room, now: number): boolean {
  if (r.pause || r.endsAt === null || now < r.endsAt) return false;
  switch (r.phase) {
    case 'reveal':
      for (const p of r.players) { p.role = null; p.ready = false; p.confirmed = false; }
      note(r, 'رجعنا للغرفة لأن مش كل اللاعبين أكدوا معرفة أدوارهم. التوزيع القادم جديد.', now); enter(r, 'lobby', null, now); break;
    case 'night': resolveNight(r, now); break;
    case 'private': eliminate(r, r.pendingVictim, 'ضحية الليلة', now); r.pendingVictim = null; enter(r, 'dawn', 8, now); break;
    case 'dawn': if (r.outcome) enter(r, 'finished', null, now); else enter(r, 'discussion', r.discussionSeconds, now); break;
    case 'discussion': r.votes = {}; enter(r, 'vote', 30, now); break;
    case 'vote': case 'runoff': resolveVote(r, now); break;
    case 'result': if (r.outcome) enter(r, 'finished', null, now); else startNight(r, now); break;
    default: return false;
  }
  return true;
}
export function addPlayer(r: Room, player: Player) {
  if (r.phase !== 'lobby') fail('ROOM_LOCKED', 'اللعبة بدأت. استنوا المباراة الجاية.');
  if (r.players.length >= 16 || r.players.filter(p => p.accepted).length >= 12) fail('ROOM_FULL', 'الغرفة كاملة.');
  if (r.players.some(p => p.name.trim().toLocaleLowerCase() === player.name.trim().toLocaleLowerCase())) fail('NAME_TAKEN', 'الاسم ده موجود. اختار اسم مختلف.');
  if (r.players.some(p => p.avatar === player.avatar)) fail('AVATAR_TAKEN', 'الشخصية دي اتاخدت. اختار شخصية تانية.');
  r.players.push(player);
}
export function applyCommand(r: Room, actorId: string, c: Command, now: number, random: () => number): boolean {
  const actor = r.players.find(p => p.id === actorId);
  if (!actor) fail('NOT_MEMBER', 'أنت مش عضو في الغرفة.');
  const key = `${actorId}:${c.id}`; const fingerprint = JSON.stringify(c);
  if (r.receipts[key]) { if (r.receipts[key] !== fingerprint) fail('REUSED_ID', 'معرف الأمر اتستخدم بمحتوى مختلف.'); return false; }
  if (c.phaseId !== r.phaseId) fail('STALE_PHASE', 'المرحلة اتغيرت. الشاشة هتتحدث دلوقتي.');
  if (c.type !== 'abort' && r.pause) fail('PAUSED', 'اللعبة متوقفة لحد رجوع الاتصال.');
  if (r.endsAt !== null && now >= r.endsAt) fail('PHASE_ENDED', 'وقت المرحلة خلص.');
  const host = () => { if (r.hostId !== actorId) fail('HOST_ONLY', 'الإجراء ده لصاحب الغرفة بس.'); };
  const inPhase = (...phases: Phase[]) => { if (!phases.includes(r.phase)) fail('WRONG_PHASE', 'الإجراء مش متاح في المرحلة دي.'); };
  switch (c.type) {
    case 'approve': case 'reject': {
      host(); inPhase('lobby'); const p = r.players.find(p => p.id === c.target);
      if (!p || p.accepted || p.id === actorId) fail('INVALID_PLAYER', 'طلب الدخول مش موجود.');
      if (c.type === 'reject') r.players = r.players.filter(x => x.id !== p.id);
      else { if (r.players.filter(p => p.accepted).length >= 12) fail('ROOM_FULL', 'الحد الأقصى 12 لاعب.'); p.accepted = true; }
      break;
    }
    case 'ready': inPhase('lobby'); if (!actor.accepted) fail('PENDING', 'استنى قبول الدخول.'); actor.ready = c.value === true; break;
    case 'start': {
      host(); inPhase('lobby'); const players = r.players.filter(p => p.accepted);
      if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS || players.some(p => !p.ready)) fail('NOT_READY', 'محتاجين من 4 لـ12 لاعب، وكلهم جاهزين.');
      r.players = players;
      const counts = roleCounts(players.length);
      const roles: Role[] = (Object.entries(counts) as [Role,number][]).flatMap(([role,count])=>Array<Role>(count).fill(role));
      for (let i = roles.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [roles[i], roles[j]] = [roles[j], roles[i]]; }
      players.forEach((p, i) => { p.role = roles[i]; p.alive = true; p.revealed = false; p.confirmed = false; });
      r.history = []; r.outcome = null; r.stagnantCycles = 0; r.nightNumber = 0; r.lastProtected = null;
      enter(r, 'reveal', 30, now); break;
    }
    case 'confirm': inPhase('reveal'); if (!actor.accepted) fail('PENDING', 'الدخول غير مقبول.'); actor.confirmed = true;
      if (r.players.every(p => p.confirmed)) startNight(r, now); break;
    case 'night': case 'vote': {
      inPhase(...(c.type === 'night' ? ['night'] as Phase[] : ['vote', 'runoff'] as Phase[]));
      if (!actor.accepted || !actor.alive) fail('ELIMINATED', 'اللي خرج يتفرج من غير اختيارات.');
      const choices = c.type === 'night' ? r.actions : r.votes;
      if (!Number.isInteger(c.sequence) || c.sequence! <= (choices[actorId]?.sequence ?? 0)) fail('STALE_CHOICE', 'وصل اختيار أحدث بالفعل.');
      let targetId = c.target ?? null;
      if (c.type === 'night' && actor.role === 'citizen') targetId = null;
      const target = targetId ? r.players.find(p => p.id === targetId && p.accepted && p.alive) : null;
      if (targetId && !target) fail('INVALID_TARGET', 'اختار لاعب عايش في نفس المباراة.');
      if (target) {
        if (c.type === 'vote' && target.id === actorId) fail('SELF_VOTE', 'مينفعش تصوّت لنفسك.');
        if (c.type === 'vote' && r.phase === 'runoff' && !r.finalists.includes(target.id)) fail('INVALID_TARGET', 'اختار حد من جولة الحسم.');
        if (c.type === 'night' && actor.role === 'mafia' && target.role === 'mafia') fail('TEAM_TARGET', 'المافيا مينفعش تختار حد من فريقها.');
        if (c.type === 'night' && actor.role === 'detective' && target.id === actorId) fail('SELF_CHECK', 'اختار حد غير نفسك.');
        if (c.type === 'night' && actor.role === 'doctor' && target.id === r.lastProtected) fail('REPEAT_PROTECTION', 'مينفعش تحمي نفس الشخص ليلتين ورا بعض.');
      }
      choices[actorId] = { target: targetId, sequence: c.sequence! }; break;
    }
    case 'abort': host(); if (['lobby', 'finished', 'aborted'].includes(r.phase)) fail('WRONG_PHASE', 'مفيش مباراة شغالة.'); r.pause = null; note(r, 'المباراة اتلغت بواسطة صاحب الغرفة.', now); enter(r, 'aborted', null, now); break;
    case 'rematch': {
      host(); inPhase('finished', 'aborted');
      for (const p of r.players) { p.role = null; p.ready = false; p.alive = true; p.revealed = false; p.confirmed = false; }
      r.outcome = null; r.actions = {}; r.votes = {}; r.investigations = {}; r.history = []; r.announcement = ''; r.pendingVictim = null; r.finalists = []; r.pause = null;
      enter(r, 'lobby', null, now); break;
    }
  }
  r.receipts[key] = fingerprint;
  const keys = Object.keys(r.receipts); if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete r.receipts[k];
  return true;
}
export function checkPresence(r: Room, seen: Record<string, number>, now: number): boolean {
  let changed = false;
  const hostSeen = seen[r.hostId] ?? r.createdAt;
  if (now - hostSeen > 30_000) {
    const next = r.players.find(p => p.accepted && now - (seen[p.id] ?? 0) < 12_000);
    if (next && next.id !== r.hostId) { r.hostId = next.id; changed = true; }
  }
  if (['lobby', 'finished', 'aborted'].includes(r.phase)) return changed;
  const missing = r.players.filter(p => p.accepted && p.alive && now - (seen[p.id] ?? r.phaseStartedAt) > 12_000);
  if (r.pause) {
    if (now - r.pause.since >= 120_000) { r.pause = null; note(r, 'المباراة اتلغت بسبب انقطاع الاتصال لأكثر من دقيقتين.', now); enter(r, 'aborted', null, now); return true; }
    if (!missing.length) { r.endsAt = now + Math.max(3000, r.pause.remaining); r.pause = null; r.phaseId++; return true; }
  } else if (missing.length) {
    const since = Math.min(...missing.map(p => (seen[p.id] ?? r.phaseStartedAt) + 12_000));
    r.pause = { since, remaining: Math.max(3000, (r.endsAt ?? now) - since), reason: 'connection' }; r.endsAt = null; r.phaseId++; changed = true;
    if (now - since >= 120_000) { r.pause = null; note(r, 'المباراة اتلغت لأن اللاعبين انقطعوا عن الاتصال.', now); enter(r, 'aborted', null, now); }
  }
  return changed;
}
/** Explicit allowlist projection: secrets never enter a public room snapshot. */
export function project(r: Room, actorId: string, now: number, seen: Record<string, number> = {}, revision = 0) {
  const self = r.players.find(p => p.id === actorId);
  if (!self) fail('NOT_MEMBER', 'طلب الدخول اترفض أو العضوية انتهت.');
  const allowed = self.accepted;
  const showOwnRole = allowed && self.role !== null && !['lobby', 'aborted'].includes(r.phase);
  const others = r.players.filter(p => p.accepted || (allowed && r.hostId === actorId) || p.id === actorId);
  return {
    code: r.code, revision, hostId: r.hostId, phase: allowed ? (r.pause ? 'paused' as const : r.phase) : 'pending' as const,
    phaseId: r.phaseId, endsAt: allowed ? r.endsAt : null, serverNow: now, nightNumber: allowed ? r.nightNumber : 0,
    discussionSeconds: r.discussionSeconds, outcome: r.phase === 'finished' ? r.outcome : null,
    announcement: allowed ? r.announcement : '', history: allowed ? r.history.slice(-12) : [],
    finalists: allowed && r.phase === 'runoff' ? r.finalists : [], pausedSince: r.pause?.since ?? null,
    players: others.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, accepted: p.accepted,
      ready: r.phase === 'lobby' ? p.ready : false, alive: allowed ? p.alive : true,
      online: now - (seen[p.id] ?? 0) < 12_000,
      role: allowed && (r.phase === 'finished' || p.revealed) ? p.role : null })),
    self: { id: self.id, accepted: self.accepted, alive: self.alive, role: showOwnRole ? self.role : null,
      confirmed: self.confirmed, protectedLastNight: showOwnRole && self.role === 'doctor' ? r.lastProtected : null,
      teammates: showOwnRole && self.role === 'mafia' ? r.players.filter(p => p.role === 'mafia' && p.id !== actorId).map(p => p.id) : [],
      choice: allowed && r.phase === 'night' ? r.actions[actorId] ?? null : allowed && ['vote', 'runoff'].includes(r.phase) ? r.votes[actorId] ?? null : null,
      investigation: showOwnRole && self.role === 'detective' && r.phase === 'private' ? r.investigations[actorId] ?? null : null,
      mafiaChoices: showOwnRole && self.role === 'mafia' && r.phase === 'night' ? r.players.filter(p => p.role === 'mafia' && p.alive).map(p => ({ player: p.id, target: r.actions[p.id]?.target ?? null })) : [] }
  };
}
export type RoomView = ReturnType<typeof project>;
