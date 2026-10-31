'use client';
import dynamic from 'next/dynamic';
import {useCallback,useEffect,useState} from 'react';
import {AVATARS,type AvatarId} from '@sirocco/shared';
const LivePreview=dynamic(()=>import('./AvatarPreview').then(m=>m.AvatarPreview),{ssr:false});
export function AvatarPortrait({avatar,interactive}:{avatar:AvatarId;interactive:boolean}){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(false),[avatar]);const shown=useCallback(()=>setReady(true),[avatar]);
 return <div className="avatar-portrait" data-ready={ready}><img className="avatar-preview-canvas avatar-preview-fallback" src={`/avatars/${avatar}.webp`} alt={`${AVATARS.find(a=>a.id===avatar)?.name??'Operator'} appearance`} width={512} height={512} decoding="async"/>{interactive&&<LivePreview avatar={avatar} onReady={shown}/>}</div>;
}
