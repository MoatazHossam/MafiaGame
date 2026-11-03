'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,Link as LinkIcon,LoaderCircle,RefreshCw,ShieldCheck,Users} from 'lucide-react';
import type {InviteInfo,InviteRequest} from '@/lib/invitations';
import type {RoomView} from '@/lib/game';
import {avatars} from '@/lib/presentation';
import {AvatarPicker} from './avatar-picker';
type Props={invitation:InviteRequest;existingRoom:RoomView|null;busy:boolean;clientId:string;onEnter:(data:Record<string,unknown>)=>Promise<string|null>;onContinue:()=>void;onLeave:()=>Promise<void>;onHome:()=>void};
export function JoinRoom({invitation,existingRoom,busy,clientId,onEnter,onContinue,onLeave,onHome}:Props){
  const [name,setName]=useState(''),[avatar,setAvatar]=useState(0),[info,setInfo]=useState<InviteInfo|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{try{setName(localStorage.getItem('mafia_name')??'');setAvatar(Number(localStorage.getItem('mafia_avatar'))||0);}catch{}},[]);
  useEffect(()=>{
    let cancelled=false;
    if(!invitation.code){setLoading(false);return;}
    setLoading(true);setError('');
    fetch('/api/room',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'invite',code:invitation.code,clientId})})
      .then(async response=>{const data=await response.json() as {error?:string;invitation?:InviteInfo};if(!response.ok||!data.invitation)throw new Error(data.error??'تعذر فتح الدعوة.');return data.invitation;})
      .then(next=>{if(cancelled)return;setInfo(next);setAvatar(previous=>previous>=0&&previous<avatars.length&&!next.takenAvatars.includes(previous)?previous:avatars.findIndex((_,i)=>!next.takenAvatars.includes(i)));})
      .catch(e=>{if(!cancelled){setInfo(null);setError(e instanceof Error?e.message:'راجع الاتصال وجرب تاني.');}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[invitation.code,clientId,refresh]);
  async function submit(event:React.FormEvent){event.preventDefault();if(!invitation.code)return;setError('');const message=await onEnter({mode:'join',code:invitation.code,name:name.trim(),avatar});
    if(message){setError(message);return;}
    try{localStorage.setItem('mafia_name',name.trim());localStorage.setItem('mafia_avatar',String(avatar));}catch{}
  }
  return <main className="invitation-main"><section className="invitation-heading"><span className="invite-icon"><LinkIcon size={26}/></span><h1>مكانك مستنيك.</h1>{invitation.code&&<div className="invitation-code"><small>كود الغرفة</small><strong dir="ltr">{invitation.code}</strong></div>}</section>
  <section className="entry-card invitation-card">
    {invitation.error?<div className="form-body"><p role="alert" className="inline-error">{invitation.error}</p><button className="secondary full" onClick={onHome}>ارجع للبداية</button></div>:existingRoom?<div className="form-body session-conflict"><ShieldCheck size={32}/><h2>أنت بالفعل في غرفة تانية.</h2><p>الغرفة الحالية: <b dir="ltr">{existingRoom.code}</b>. لينك الدعوة الجديد مش هيغيّر غرفتك أو دورك من غير اختيارك.</p><button className="primary full" onClick={onContinue}>ارجع لغرفتي الحالية <ArrowLeft size={17}/></button>{['lobby','pending','finished','aborted'].includes(existingRoom.phase)?<button className="secondary full" disabled={busy} onClick={onLeave}>غادر الغرفة الحالية وانضم للدعوة</button>:<p className="small-text">المباراة الحالية شغالة. كملها أو اطلب إلغاءها قبل الانتقال.</p>}</div>:
    loading?<div className="form-body invitation-loading"><LoaderCircle className="spin"/><p>بنتأكد من الغرفة…</p></div>:<form onSubmit={submit} className="form-body">
      {info&&<><h2>قعدة {info.hostName}</h2><p className="invitation-count"><Users size={16}/>{info.count} / 12</p></>}
      {(error||info?.reason)&&<p className="inline-error" role="alert">{error||info?.reason}</p>}
      {info?.joinable&&<><label htmlFor="join-name">اسمك</label><input autoFocus id="join-name" autoComplete="nickname" placeholder="اسمك في القعدة" value={name} minLength={2} maxLength={24} required onChange={e=>setName(e.target.value)}/><AvatarPicker value={avatar} onChange={setAvatar} taken={info.takenAvatars}/><button className="primary full" type="submit" disabled={busy||name.trim().length<2||avatar<0||info.takenAvatars.includes(avatar)}>{busy?<LoaderCircle size={18} className="spin"/>:<ArrowLeft size={18}/>} انضم للقعدة</button></>}
      <button className="text-button full" type="button" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/> تحديث حالة الغرفة</button><button className="text-button full" type="button" onClick={onHome}>عايز تعمل غرفة مختلفة؟</button>
    </form>}
  </section></main>;
}
