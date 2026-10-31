'use client';
import React from 'react';
import {AVATARS,type AvatarId} from '@sirocco/shared';
/** The same rendered portraits are reused by both teams; no WebGL/model building in the lobby. */
export function AvatarPicker({value,onChange,disabled,label='CHOOSE YOUR APPEARANCE'}:{value:AvatarId;onChange:(id:AvatarId)=>void;disabled:boolean;label?:string}){
 return <fieldset className="avatar-picker" disabled={disabled}><legend>{label}</legend>{AVATARS.map(a=><button type="button" key={a.id} aria-pressed={value===a.id} aria-label={a.name} onClick={()=>onChange(a.id)}><span className="avatar-thumb"><img src={`/avatars/${a.id}.webp`} width={512} height={512} alt="" decoding="async"/></span><span className="avatar-choice-name">{a.name}</span>{value===a.id&&<span className="avatar-selected" aria-hidden="true">✓</span>}</button>)}</fieldset>;
}
