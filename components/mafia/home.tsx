'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,Link as LinkIcon,LoaderCircle,Moon,Plus,Users} from 'lucide-react';
import {CityArtwork} from './art';
import {AvatarPicker} from './avatar-picker';
import {RolePortrait} from './game-art';
export function Home({busy,onEnter}:{busy:boolean;onEnter:(data:Record<string,unknown>)=>Promise<string|null>}){
  const [mode,setMode]=useState<'create'|'join'>('create'),[name,setName]=useState(''),[avatar,setAvatar]=useState(0),[code,setCode]=useState('');
  useEffect(()=>{try{setName(localStorage.getItem('mafia_name')??'');const a=Number(localStorage.getItem('mafia_avatar'));if(a>=0&&a<16)setAvatar(a);}catch{}},[]);
  async function enter(e:React.FormEvent){e.preventDefault();const error=await onEnter({mode,name:name.trim(),avatar,...(mode==='join'?{code:code.trim().toUpperCase()}:{})});if(error)return;try{localStorage.setItem('mafia_name',name.trim());localStorage.setItem('mafia_avatar',String(avatar));}catch{}}
  return <main className="game-home compact-home">
    <section className="game-home-layout">
      <div className="game-home-stage">
        <div className="stage-copy"><h1>المدينة نامت.<br/>والخيانة <em>صحيت.</em></h1><div className="game-specs"><span><Users size={15}/> 4–12 لاعب</span><span><Moon size={15}/> الراوي علينا</span></div></div>
        <div className="city-stage"><CityArtwork/><div className="scene-card scene-card-doctor"><RolePortrait role="doctor"/><b>الدكتور</b></div><div className="scene-card scene-card-mafia"><RolePortrait role="mafia"/><b>المافيا</b></div></div>
      </div>
      <div id="play" className="game-entry-column">
        <form className="entry-card" onSubmit={enter}>
          <div className="form-tabs"><button type="button" className={mode==='create'?'active':''} onClick={()=>setMode('create')}><Plus size={18}/> اعمل غرفة</button><button type="button" className={mode==='join'?'active':''} onClick={()=>setMode('join')}><LinkIcon size={18}/> ادخل بكود</button></div>
          <div className="form-body">
            <label htmlFor="name">اسمك</label><input id="name" name="name" autoComplete="nickname" value={name} minLength={2} maxLength={24} placeholder="هنناديك إيه؟" required onChange={e=>setName(e.target.value)}/>
            <AvatarPicker value={avatar} onChange={setAvatar}/>
            {mode==='join'&&<><label htmlFor="code">كود الغرفة</label><input id="code" name="code" className="code-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,8))} placeholder="ABCDEFGH" minLength={8} maxLength={8} required autoComplete="off" spellCheck={false}/></>}
            <button className="primary full" disabled={busy||name.trim().length<2} type="submit">{busy?<LoaderCircle className="spin" size={18}/>:<ArrowLeft size={18}/>} {mode==='create'?'يلا نلعب':'ادخل الغرفة'}</button>
          </div>
        </form>
      </div>
    </section>
  </main>;
}
