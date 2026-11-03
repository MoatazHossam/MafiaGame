'use client';
import {Check,LockKeyhole,Shuffle} from 'lucide-react';

// Public cosmetics only. Indices retain the existing server-side avatar contract.
export const characters=[
 {name:'فلفل',line:'أنا؟ ده أنا لسه داخل!',color:'#f5a44c',bg:'#655039',kind:'pointy',prop:'brow'},
 {name:'ذئب الغلابة',line:'أنا جيت عشان السناكس.',color:'#9baaca',bg:'#3d4769',kind:'pointy',prop:'glasses'},
 {name:'دبدوب',line:'صوّتوا براحة… بزعل.',color:'#bb805b',bg:'#694c58',kind:'round',prop:'bow'},
 {name:'ملك الدراما',line:'أنا عندي خطاب صغير.',color:'#edbd5e',bg:'#69513f',kind:'lion',prop:'brow'},
 {name:'باندا نعسان',line:'صحّوني وقت التصويت.',color:'#eee5d6',bg:'#41605e',kind:'panda',prop:'sleep'},
 {name:'نمر ونص',line:'اللي بصلي ده قصده إيه؟',color:'#e3a24e',bg:'#634637',kind:'tiger',prop:'brow'},
 {name:'كوالا كول',line:'مش متوتر… دي قعدتي.',color:'#b7c1cc',bg:'#575470',kind:'koala',prop:'glasses'},
 {name:'كركور',line:'أنا ساكت عشان بفكّر.',color:'#9fcf73',bg:'#3b6053',kind:'frog',prop:'moustache'},
 {name:'أبو العريف',line:'قلتلكم. حتى لو مقلتش.',color:'#bd9878',bg:'#654f6b',kind:'owl',prop:'glasses'},
 {name:'أرنوب',line:'قلبي مش ناقص اتهامات.',color:'#efc5ba',bg:'#714b60',kind:'rabbit',prop:'bow'},
 {name:'مشمش',line:'أنا شاكك في اللي شاكك فيّا.',color:'#eeb967',bg:'#655b3d',kind:'cat',prop:'moustache'},
 {name:'أخطبوط الحيرة',line:'عندي تمان آراء مختلفين.',color:'#c499d5',bg:'#584b78',kind:'octopus',prop:'brow'},
 {name:'وحيد الشك',line:'إحساسي عمره ما… أحيانًا.',color:'#dfc9ea',bg:'#595680',kind:'unicorn',prop:'glasses'},
 {name:'بطريق شيك',line:'لابس رسمي عشان التحقيق.',color:'#637c95',bg:'#3c596b',kind:'penguin',prop:'bow'},
 {name:'زلابيا',line:'وشّي كده من غير سبب.',color:'#a5a6b6',bg:'#5c5470',kind:'raccoon',prop:'brow'},
 {name:'قرد اللقطة',line:'استنوا… عندي نظرية!',color:'#c3926b',bg:'#665740',kind:'monkey',prop:'moustache'},
 {name:'رائد',line:'أنا كنت برّه الكوكب وقت الجريمة!',color:'#e5edf5',bg:'#263d68',kind:'astronaut',prop:'brow'},
] as const;

export function AvatarPortrait({index,className=''}:{index:number;className?:string}){
 const c=characters[index]??characters[0],k=c.kind;
 if(k==='astronaut')return <svg className={`avatar-portrait ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <rect x="3" y="3" width="94" height="94" rx="28" fill={c.bg}/>
  <path d="M14 23h8m-4-4v8M78 13h8m-4-4v8" stroke="#f2d38c" strokeWidth="2" strokeLinecap="round"/><circle cx="85" cy="40" r="2" fill="#b3dce9"/>
  <path d="M17 100v-9q0-18 21-22h24q21 4 21 22v9" fill="#e5edf5" stroke="#152a46" strokeWidth="2"/>
  <path d="M25 86v14m50-14v14" stroke="#8faac5" strokeWidth="5"/>
  <path d="M71 85q17 2 10-21" fill="none" stroke="#b1c7db" strokeWidth="5"/>
  <rect x="12" y="32" width="12" height="26" rx="5" fill="#9eb9d2" stroke="#152a46" strokeWidth="2"/><rect x="76" y="32" width="12" height="26" rx="5" fill="#9eb9d2" stroke="#152a46" strokeWidth="2"/>
  <ellipse cx="50" cy="42" rx="34" ry="35" fill="#f1f5f2" stroke="#9bb4cb" strokeWidth="3"/>
  <ellipse cx="50" cy="43" rx="27" ry="27" fill="#172c4a" stroke="#d8b777" strokeWidth="3"/>
  <path d="M32 47q0-19 18-19t18 19v8q-3 16-18 16T32 55Z" fill="#edb787"/>
  <path d="M32 43q-3-20 18-20t18 20l-9-9q-14 9-27 2" fill="#343146"/>
  <path d="M36 45l8-2m12 0l8-2" stroke="#614734" strokeWidth="2.5" strokeLinecap="round"/>
  <ellipse cx="41" cy="50" rx="2.5" ry="3.5" fill="#20334a"/><ellipse cx="59" cy="50" rx="2.5" ry="3.5" fill="#20334a"/>
  <path d="M43 59q7 9 15-1" fill="#fff1d6" stroke="#875f45" strokeWidth="2" strokeLinejoin="round"/>
  <path d="M29 37q3-13 13-15" fill="none" stroke="#e0f8ff" strokeWidth="4" strokeLinecap="round" opacity=".6"/>
  <path d="M27 65q23 17 46 0l-3 10q-20 13-40 0Z" fill="#b9ccdc"/>
  <rect x="37" y="82" width="27" height="16" rx="4" fill="#345579" stroke="#93b5ca" strokeWidth="2"/><path d="M41 87h11" stroke="#9bdfd4" strokeWidth="3" strokeLinecap="round"/><circle cx="57" cy="92" r="2" fill="#f79a84"/>
  <path d="M27 80l2 4 4 1-4 2-1 4-2-4-4-1 4-2Z" fill="#d4aa59"/>
 </svg>;
 const pointed=['pointy','cat','unicorn'].includes(k),round=['round','panda','tiger','raccoon','lion'].includes(k);
 return <svg className={`avatar-portrait ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <rect x="3" y="3" width="94" height="94" rx="28" fill={c.bg}/><circle cx="76" cy="23" r="17" fill="#ffffff0c"/>
  <path d="M13 100Q16 74 50 76Q84 74 87 100" fill="#16243c"/>
  {k==='lion'&&<path d="M50 9L61 14L73 11L78 24L91 29L86 43L94 54L83 63L82 77L67 78L57 90L45 82L31 88L25 75L11 72L15 58L7 47L18 37L17 23L32 21L39 9Z" fill="#a26a39"/>}
  {pointed&&<><path d="M20 42L18 9L43 29M59 29L83 9L80 43" fill={c.color} stroke="#182638" strokeWidth="3" strokeLinejoin="round"/><path d="M24 30L23 18L34 30M67 30L78 18L76 32" fill="#e8a6a2"/></>}
  {round&&<><circle cx="25" cy="30" r="15" fill={k==='panda'?'#263349':c.color}/><circle cx="75" cy="30" r="15" fill={k==='panda'?'#263349':c.color}/><circle cx="25" cy="30" r="8" fill="#d59b8b"/><circle cx="75" cy="30" r="8" fill="#d59b8b"/></>}
  {['monkey','koala'].includes(k)&&<><circle cx="19" cy="44" r="17" fill={c.color}/><circle cx="81" cy="44" r="17" fill={c.color}/><circle cx="19" cy="44" r="10" fill="#e8c4a7"/><circle cx="81" cy="44" r="10" fill="#e8c4a7"/></>}
  {k==='rabbit'&&<><ellipse cx="32" cy="24" rx="10" ry="24" transform="rotate(-14 32 24)" fill={c.color}/><ellipse cx="69" cy="24" rx="10" ry="24" transform="rotate(15 69 24)" fill={c.color}/><path d="M29 8L34 36M72 8L67 36" stroke="#d78594" strokeWidth="6" strokeLinecap="round"/></>}
  {k==='owl'&&<path d="M20 47L16 13L42 26L62 26L84 13L80 48" fill={c.color}/>}
  {k==='octopus'&&<path d="M24 67Q0 93 15 91Q29 89 32 76Q21 108 40 91Q49 78 50 76Q50 108 62 92Q62 84 62 77Q82 107 83 88Q81 81 76 67" fill={c.color} stroke={c.color} strokeWidth="6" strokeLinecap="round"/>}
  <path d={k==='frog'?'M17 55Q12 34 30 29Q35 18 46 30L55 30Q69 18 74 31Q91 35 84 58Q80 83 50 84Q20 84 17 55': 'M22 46Q21 23 50 23Q79 23 78 46L82 60Q81 84 50 85Q19 84 18 60Z'} fill={c.color} stroke="#182638" strokeWidth="2"/>
  {['pointy','cat','lion','tiger','rabbit','round','raccoon'].includes(k)&&<path d="M29 58Q38 49 50 58Q62 49 72 58L68 73Q50 88 32 73Z" fill="#f7e7cc"/>}
  {k==='monkey'&&<path d="M27 43Q36 28 50 43Q66 28 74 45L69 70Q50 85 31 70Z" fill="#f3d6ac"/>}
  {['panda','raccoon'].includes(k)&&<><ellipse cx="35" cy="49" rx="13" ry="14" transform="rotate(24 35 49)" fill="#263349"/><ellipse cx="65" cy="49" rx="13" ry="14" transform="rotate(-24 65 49)" fill="#263349"/></>}
  {k==='penguin'&&<path d="M27 49Q28 27 42 40L50 48L58 40Q73 27 74 50L72 72Q50 91 28 72Z" fill="#f3e7d0"/>}
  {k==='owl'&&<><circle cx="34" cy="49" r="17" fill="#ead5b5"/><circle cx="66" cy="49" r="17" fill="#ead5b5"/></>}
  {k==='tiger'&&<><path d="M42 26L48 41L54 25M21 49L33 54L20 58M80 49L67 54L81 59" fill="#65432c"/></>}
  {k==='unicorn'&&<><path d="M45 28L51 2L58 28" fill="#f5d586" stroke="#94764f" strokeWidth="2"/><path d="M43 25Q23 35 29 52Q20 42 25 29Q30 16 43 25" fill="#9adbc5"/></>}
  {c.prop==='sleep'?<path d="M29 50Q35 55 41 50M59 50Q65 55 71 50" fill="none" stroke="#182638" strokeWidth="3" strokeLinecap="round"/>:<><ellipse cx="35" cy="49" rx="4" ry="6" fill={k==='panda'||k==='raccoon'?'#f6eddc':'#182638'}/><ellipse cx="65" cy="49" rx="4" ry="6" fill={k==='panda'||k==='raccoon'?'#f6eddc':'#182638'}/><circle cx="36" cy="47" r="1.3" fill="white"/><circle cx="66" cy="47" r="1.3" fill="white"/></>}
  {c.prop==='brow'&&<path d="M27 37L41 41M59 36L73 32" fill="none" stroke="#182638" strokeWidth="4" strokeLinecap="round"/>}
  {c.prop==='glasses'&&<g stroke="#15253b" strokeWidth="3"><circle cx="35" cy="49" r="11" fill="#abdbe22d"/><circle cx="65" cy="49" r="11" fill="#abdbe22d"/><path d="M46 49H54M24 46L19 43M76 46L81 43"/></g>}
  {k==='koala'?<ellipse cx="50" cy="59" rx="8" ry="11" fill="#263349"/>:['penguin','owl'].includes(k)?<path d="M43 58L57 58L50 68Z" fill="#f0ad5d"/>:<path d="M44 60Q50 55 56 60L50 65Z" fill="#33304a"/>}
  {c.prop==='moustache'?<path d="M50 67Q42 57 31 68Q38 77 50 69Q62 77 70 68Q58 57 50 67" fill="#343049"/>:<path d={index%3===0?'M42 69Q50 79 60 67':'M43 70Q50 74 57 69'} fill="none" stroke="#553e45" strokeWidth="2.5" strokeLinecap="round"/>}
  {k==='cat'&&<path d="M13 61L30 64M14 70L30 68M70 64L88 61M70 68L86 72" stroke="#805d48" strokeWidth="2"/>}
  {c.prop==='bow'&&<path d="M49 88L35 81L35 96L49 91L65 97L65 81L51 88Z" fill="#ed8e86" stroke="#442e47" strokeWidth="2"/>}
  <path d="M12 18L14 14L19 13M82 87L88 84" fill="none" stroke="#ffffff30" strokeWidth="2" strokeLinecap="round"/>
 </svg>;
}

export function AvatarPicker({value,onChange,taken=[]}:{value:number;onChange:(index:number)=>void;taken?:number[]}){
 const selected=characters[value],available=characters.map((_,i)=>i).filter(i=>!taken.includes(i));
 function shuffle(){const others=available.filter(i=>i!==value);if(others.length)onChange(others[Math.floor(Math.random()*others.length)]);}
 return <section className="character-picker" aria-label="اختار شخصيتك"><div className="character-picker-heading"><b>وشّك في القعدة</b><button type="button" className="character-shuffle" onClick={shuffle} disabled={available.length<2} aria-label="اختار لي شخصية عشوائية"><Shuffle size={14}/> اختار لي</button></div>
  <div className="character-preview" aria-live="polite" aria-atomic="true">{selected&&<><div className="character-spotlight" key={value}><AvatarPortrait index={value}/></div><div><h3>{selected.name}</h3><p>«{selected.line}»</p></div><span className="character-stamp" aria-hidden="true">ده أنا!</span></>}</div>
  <div className="character-grid" role="group" aria-label="الشخصيات">{characters.map((c,i)=><button key={c.name} type="button" title={taken.includes(i)?`${c.name} — محجوز`:c.name} aria-label={taken.includes(i)?`${c.name} — محجوز`:c.name} aria-pressed={value===i} disabled={taken.includes(i)} className={value===i?'selected':''} onClick={()=>onChange(i)}><AvatarPortrait index={i}/>{taken.includes(i)?<LockKeyhole className="character-state" size={13}/>:value===i?<Check className="character-state" size={13}/>:null}</button>)}</div>
 </section>;
}
