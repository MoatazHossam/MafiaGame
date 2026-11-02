'use client';
import {useEffect,useState} from 'react';
import {EyeOff,Fingerprint} from 'lucide-react';
export function Hold({children,label='اضغط باستمرار للكشف'}:{children:React.ReactNode;label?:string}){
  const [held,setHeld]=useState(false);
  useEffect(()=>{const hide=()=>setHeld(false);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',hide);return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',hide);};},[]);
  return <div className={`secret-card ${held?'is-open':''}`} role="button" tabIndex={0} aria-label={label} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setHeld(true);}} onPointerUp={()=>setHeld(false)} onPointerCancel={()=>setHeld(false)} onLostPointerCapture={()=>setHeld(false)} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setHeld(true);}}} onKeyUp={()=>setHeld(false)} onBlur={()=>setHeld(false)}>{held?<div className="secret-content">{children}</div>:<><span className="secret-emblem"><Fingerprint size={38}/></span><strong>{label}</strong><span>محدش يشوف شاشتك غيرك</span><span className="hold-hint"><EyeOff size={14}/> هتختفي أول ما ترفع صباعك</span></>}</div>;
}
