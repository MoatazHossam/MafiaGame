'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,CircleHelp,Fingerprint,LoaderCircle,LogOut,WifiOff,X} from 'lucide-react';
import type {Command,RoomView} from '@/lib/game';
import {Home} from '@/components/mafia/home';
import {Rules} from '@/components/mafia/rules';
import {RoomBoard} from '@/components/mafia/room-board';
import {clientId} from '@/lib/client-id';
type ApiData={room?:RoomView|null;error?:string;code?:string};
export default function MafiaGame(){
  const [room,setRoom]=useState<RoomView|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[network,setNetwork]=useState(false),[stolen,setStolen]=useState(false),[rules,setRules]=useState(false),[toast,setToast]=useState('');
  const client=useRef(''),roomRef=useRef<RoomView|null>(null),stolenRef=useRef(false),polling=useRef(false),busyRef=useRef(false),initial=useRef(false);
  const notify=useCallback((text:string)=>setToast(text),[]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id);},[toast]);
  const accept=useCallback((next:RoomView|null)=>{
    if(next&&roomRef.current?.code===next.code&&roomRef.current.revision>next.revision)return;
    roomRef.current=next;setRoom(next);
  },[]);
  const request=useCallback(async(payload:Record<string,unknown>,retry=false):Promise<ApiData>=>{
    const text=JSON.stringify({...payload,clientId:client.current});let response:Response;
    const send=()=>fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:text,cache:'no-store'});
    try{response=await send();}catch(e){if(!retry)throw e;response=await send();}
    const data=await response.json() as ApiData;
    if(data.code==='TAB_REPLACED'){stolenRef.current=true;setStolen(true);}
    if(data.room!==undefined)accept(data.room);
    if(data.code==='NOT_MEMBER'||data.code==='ROOM_EXPIRED'||data.code==='NO_SESSION'){accept(null);if(data.error)notify(data.error);}
    if(!response.ok)throw new Error(data.error??'حصلت مشكلة في الاتصال. جرب تاني.');
    setNetwork(false);return data;
  },[accept,notify]);
  const poll=useCallback(async()=>{if(polling.current||!roomRef.current||stolenRef.current)return;polling.current=true;try{await request({mode:'poll'});}catch{if(roomRef.current&&!stolenRef.current)setNetwork(true);}finally{polling.current=false;}},[request]);
  useEffect(()=>{if(initial.current)return;initial.current=true;client.current=clientId();request({mode:'resume'}).catch(()=>setNetwork(true)).finally(()=>setLoading(false));},[request]);
  useEffect(()=>{const id=setInterval(poll,1800);const onFocus=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',onFocus);window.addEventListener('online',onFocus);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',onFocus);window.removeEventListener('online',onFocus);};},[poll]);
  useEffect(()=>{if(room?.code)window.scrollTo({top:0,behavior:'auto'});},[room?.code]);
  async function enter(data:Record<string,unknown>){if(busyRef.current)return;busyRef.current=true;setBusy(true);try{await request(data);setNetwork(false);}catch(e){notify(e instanceof Error?e.message:'راجع الاتصال وجرب تاني.');}finally{busyRef.current=false;setBusy(false);}}
  async function command(type:Command['type'],extra:Partial<Command>={}){if(!roomRef.current||busyRef.current)return;busyRef.current=true;setBusy(true);try{await request({mode:'command',command:{id:clientId(),phaseId:roomRef.current.phaseId,type,...extra}},true);}catch(e){notify(e instanceof Error?e.message:'راجع الاتصال وجرب تاني.');}finally{busyRef.current=false;setBusy(false);}}
  async function leave(){if(room&&!['lobby','pending','finished','aborted'].includes(room.phase)){notify('للخروج مؤقتًا اقفل الصفحة وارجع بنفس المتصفح. صاحب الغرفة يقدر يلغي المباراة.');return;}try{await request({mode:'leave'});accept(null);stolenRef.current=false;setStolen(false);history.replaceState(null,'',location.pathname);}catch(e){notify(e instanceof Error?e.message:'تعذر الخروج. حاول تاني.');}}
  async function reclaim(){try{await request({mode:'resume'});stolenRef.current=false;setStolen(false);setNetwork(false);}catch{notify('راجع الاتصال وجرب تاني.');}}
  return <div className={`site ${room&&['night','private','reveal'].includes(room.phase)?'night-mode':''}`}>
    <header className="site-header"><a className="brand" href="/" aria-label="مافيا الرئيسية"><span className="brand-mark"><Fingerprint size={26}/></span><span>مافيا<span className="brand-dot">.</span><small>كلنا صحاب… لحد ما ييجي الليل</small></span></a><div className="header-actions"><button className="text-button" onClick={()=>setRules(true)}><CircleHelp size={18}/><span>إزاي نلعب؟</span></button>{room&&<button className="icon-button" title="الخروج من الغرفة" aria-label="الخروج من الغرفة" onClick={leave}><LogOut size={18}/></button>}</div></header>
    {toast&&<div className="toast" role="status">{toast}<button onClick={()=>setToast('')} aria-label="إغلاق الرسالة"><X size={16}/></button></div>}
    {network&&<div className="connection-banner"><WifiOff size={17}/><span>الاتصال مش مستقر. بنحاول نرجع لنفس الجولة.</span><button onClick={()=>room?poll():reclaim()}>حاول تاني</button></div>}
    {loading?<main className="loading-screen"><Fingerprint size={48}/><LoaderCircle className="spin"/><p>بنجهز القعدة…</p></main>:!room?<Home busy={busy} onEnter={enter}/>:<RoomBoard room={room} busy={busy} stolen={stolen} command={command} reclaim={reclaim} notify={notify} showRules={()=>setRules(true)}/>}
    <footer className="site-footer"><span><Fingerprint size={18}/> مافيا<span className="brand-dot">.</span></span><p>المتعة في الشك… والصحوبية تكمل بعد اللعبة.</p><button className="text-button" onClick={()=>setRules(true)}>قواعد القعدة <ArrowLeft size={14}/></button></footer>
    {rules&&<Rules close={()=>setRules(false)}/>}
  </div>;
}
