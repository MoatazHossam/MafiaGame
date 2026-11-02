export type InviteRequest = {code: string | null; error: string | null};
export type InviteInfo = {code: string; hostName: string; count: number; takenAvatars: number[]; joinable: boolean; reason: string | null};
export function readInvitation(pathCode?: string, search = ''): InviteRequest | null {
  const query = new URLSearchParams(search);
  if (pathCode === undefined && !query.has('room')) return null;
  const code = (pathCode ?? query.get('room') ?? '').trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code)
    ? {code, error: null}
    : {code: null, error: 'لينك الدعوة مش صحيح. اطلب من صاحب الغرفة يبعت اللينك كامل.'};
}
export function invitationPath(code: string) {
  const request = readInvitation(code);
  if (!request?.code) throw new Error('Invalid invitation code');
  return `/join/${request.code}`;
}
export function invitationUrl(origin: string, code: string) {return `${origin}${invitationPath(code)}`;}
