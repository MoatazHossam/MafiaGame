'use client';
import {useEffect} from 'react';

/** Keep the page still while the dialog remains the only scrolling surface. */
export function useModalScrollLock(open:boolean){
  useEffect(()=>{
    if(!open)return;
    const root=document.documentElement,body=document.body;
    const rootOverflow=root.style.overflow,bodyOverflow=body.style.overflow;
    root.style.overflow='hidden';body.style.overflow='hidden';
    return()=>{root.style.overflow=rootOverflow;body.style.overflow=bodyOverflow;};
  },[open]);
}
